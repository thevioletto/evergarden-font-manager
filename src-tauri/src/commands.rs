/// Tauri command handlers — one per IPC call from the frontend.
/// Replaces all ipcMain.handle(...) registrations in electron/main.ts.

use crate::db::{
    delete_font_by_path, get_all_fonts, get_font_variants, get_font_variants_for_uninstall,
    get_recent_fonts, toggle_favorite,
};
use crate::font_importer::{import_font_files, ImportResult};
use crate::font_installer::{
    get_imported_fonts_directory_str, is_installed_in_windows_fonts_dir, uninstall_font_from_os,
};
use crate::font_scanner::scan_fonts;
use crate::metadata_bridge::generate_bridge_from_database;
use tauri::{AppHandle, Emitter, Manager};

// ── scan-fonts ────────────────────────────────────────────────────────────────
#[tauri::command]
pub async fn scan_fonts_cmd(app: AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let user_data = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .into_owned();

    let app_clone = app.clone();
    let ud = user_data.clone();

    tokio::task::spawn_blocking(move || {
        scan_fonts(&ud, |count| {
            let _ = app_clone.emit("scan-progress", count);
        });
        generate_bridge_from_database(&ud);
        get_all_fonts()
    })
    .await
    .map_err(|e| e.to_string())?
}

// ── get-fonts ─────────────────────────────────────────────────────────────────
#[tauri::command]
pub async fn get_fonts_cmd() -> Result<Vec<serde_json::Value>, String> {
    get_all_fonts()
}

// ── toggle-favorite ───────────────────────────────────────────────────────────
#[tauri::command]
pub async fn toggle_favorite_cmd(family: String, is_favorite: bool) -> Result<(), String> {
    toggle_favorite(&family, is_favorite)
}

// ── get-font-variants ─────────────────────────────────────────────────────────
#[tauri::command]
pub async fn get_font_variants_cmd(family: String) -> Result<Vec<serde_json::Value>, String> {
    let mut variants = get_font_variants(&family)?;

    // Auto-repair / backfill features if metadata_json was empty from previous scan
    for variant in &mut variants {
        let needs_repair = variant
            .get("metadata_json")
            .and_then(|m| m.as_str())
            .map(|s| {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(s) {
                    parsed
                        .get("features")
                        .and_then(|f| f.as_array())
                        .map_or(true, |a| a.is_empty())
                } else {
                    true
                }
            })
            .unwrap_or(true);

        if needs_repair {
            if let Some(file_path_str) = variant.get("file_path").and_then(|p| p.as_str()) {
                let path = std::path::Path::new(file_path_str);
                if path.exists() {
                    if let Ok(data) = std::fs::read(path) {
                        if let Ok(face) = ttf_parser::Face::parse(&data, 0) {
                            let features = crate::font_scanner::extract_opentype_features(&face);
                            let character_set = crate::font_scanner::extract_character_set(&face);
                            let num_glyphs = face.number_of_glyphs() as u32;
                            let units_per_em = face.units_per_em();
                            let metadata_json = serde_json::json!({
                                "upm": units_per_em,
                                "glyphs": num_glyphs,
                                "features": features,
                                "characterSet": character_set,
                            })
                            .to_string();

                            let _ = crate::db::update_font_metadata(file_path_str, &metadata_json);
                            if let Some(obj) = variant.as_object_mut() {
                                obj.insert(
                                    "metadata_json".to_string(),
                                    serde_json::Value::String(metadata_json),
                                );
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(variants)
}

// ── reveal-in-folder ──────────────────────────────────────────────────────────
#[tauri::command]
pub async fn reveal_in_folder_cmd(_app: AppHandle, file_path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &file_path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &file_path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        let parent = std::path::Path::new(&file_path)
            .parent()
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_else(|| file_path.clone());
        std::process::Command::new("xdg-open")
            .arg(&parent)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ── get-recent-fonts ──────────────────────────────────────────────────────────
#[tauri::command]
pub async fn get_recent_fonts_cmd() -> Result<Vec<serde_json::Value>, String> {
    get_recent_fonts(30)
}

// ── get-app-version ───────────────────────────────────────────────────────────
#[tauri::command]
pub async fn get_app_version_cmd(app: AppHandle) -> Result<String, String> {
    Ok(app.package_info().version.to_string())
}

// ── import-dropped-fonts ──────────────────────────────────────────────────────
#[tauri::command]
pub async fn import_dropped_fonts_cmd(
    app: AppHandle,
    paths: Vec<String>,
) -> Result<ImportResult, String> {
    let user_data = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .into_owned();

    let app_clone = app.clone();
    let ud = user_data.clone();

    let result = tokio::task::spawn_blocking(move || {
        import_font_files(&paths, &ud, |processed| {
            let _ = app_clone.emit("import-progress", processed);
        })
    })
    .await
    .map_err(|e| e.to_string())?;

    generate_bridge_from_database(&user_data);
    Ok(result)
}

// ── uninstall-font ────────────────────────────────────────────────────────────
#[tauri::command]
pub async fn uninstall_font_cmd(
    app: AppHandle,
    family: String,
) -> Result<serde_json::Value, String> {
    let user_data = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .into_owned();

    let imported_dir = get_imported_fonts_directory_str(&user_data);

    let variants = get_font_variants_for_uninstall(&family)?;
    if variants.is_empty() {
        return Ok(serde_json::json!({ "success": false, "error": "Font not found." }));
    }

    for (file_path, _, _) in &variants {
        let norm = std::path::Path::new(file_path)
            .to_string_lossy()
            .to_lowercase();
        let in_imported = norm.starts_with(&imported_dir.to_lowercase());
        let in_win_fonts = is_installed_in_windows_fonts_dir(file_path);
        if !in_imported && !in_win_fonts {
            return Ok(serde_json::json!({
                "success": false,
                "error": "Only imported fonts can be uninstalled."
            }));
        }
    }

    for (file_path, fam, sub) in &variants {
        // 1. Remove from OS (Windows only)
        #[cfg(target_os = "windows")]
        {
            if let Err(e) = uninstall_font_from_os(fam, sub, file_path) {
                eprintln!("[uninstall] OS warning: {e}");
            }
        }

        // 2. Delete staged copy
        let staged = std::path::Path::new(&imported_dir).join(
            std::path::Path::new(file_path)
                .file_name()
                .unwrap_or_default(),
        );
        for p in &[std::path::Path::new(file_path), staged.as_path()] {
            if p.exists() {
                let _ = std::fs::remove_file(p);
            }
        }

        // 3. Remove from DB
        delete_font_by_path(file_path)?;
    }

    generate_bridge_from_database(&user_data);
    Ok(serde_json::json!({ "success": true }))
}
