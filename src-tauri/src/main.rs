// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod categorization;
mod commands;
mod db;
mod font_importer;
mod font_installer;
mod font_scanner;
mod metadata_bridge;
mod migration;
mod online_metadata;
mod watcher;

use commands::{
    get_app_version_cmd, get_font_variants_cmd, get_fonts_cmd, get_recent_fonts_cmd,
    import_dropped_fonts_cmd, reveal_in_folder_cmd, scan_fonts_cmd, toggle_favorite_cmd,
    uninstall_font_cmd,
};
use font_scanner::get_imported_fonts_directory;
use metadata_bridge::{generate_bridge_from_database, load_bridge};
use online_metadata::preload_online_metadata;
use tauri::{
    http::{Request, Response},
    Manager,
};

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let user_data = app
                .path()
                .app_data_dir()
                .expect("Could not get app data dir")
                .to_string_lossy()
                .into_owned();

            // Try to migrate existing Electron data (different userData path)
            try_migrate_from_electron(&user_data);

            // Ensure ImportedFonts directory exists
            let imported_dir = get_imported_fonts_directory(&user_data);
            std::fs::create_dir_all(&imported_dir)
                .expect("Could not create ImportedFonts directory");

            // Init DB
            let db_path = std::path::Path::new(&user_data)
                .join("fonts.db")
                .to_string_lossy()
                .into_owned();
            db::init_database(&db_path).expect("Database init failed");

            // Run category migration
            if let Err(e) = migration::migrate_fonts_with_categories() {
                eprintln!("[migration] error: {e}");
            }

            // Load metadata bridge
            load_bridge(&user_data);
            generate_bridge_from_database(&user_data);

            // Preload online metadata in background thread
            preload_online_metadata(user_data.clone());

            // Start FS watcher — keep the handle alive for the app lifetime
            let _watcher = watcher::start_watcher(user_data.clone());
            // Box it to keep it alive (leaking is intentional: it lives as long as the process)
            if let Some(w) = _watcher {
                Box::leak(Box::new(w));
            }

            Ok(())
        })
        // Register font:// custom protocol so @font-face src: url("font://local/...") works
        .register_uri_scheme_protocol("font", |_app, request| {
            font_protocol_handler(request)
        })
        .invoke_handler(tauri::generate_handler![
            scan_fonts_cmd,
            get_fonts_cmd,
            toggle_favorite_cmd,
            get_font_variants_cmd,
            reveal_in_folder_cmd,
            get_recent_fonts_cmd,
            get_app_version_cmd,
            import_dropped_fonts_cmd,
            uninstall_font_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Serve local font files via font://local/<path>
/// Mirrors the Electron protocol.handle("font", ...) logic.
fn font_protocol_handler(request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    let uri = request.uri().to_string();
    // Strip "font://local/" prefix
    let prefix = "font://local/";
    let without_prefix = if uri.starts_with(prefix) {
        &uri[prefix.len()..]
    } else {
        uri.trim_start_matches("font://")
    };

    let trimmed = without_prefix.trim_start_matches('/');
    let decoded = percent_encoding::percent_decode_str(trimmed)
        .decode_utf8_lossy()
        .into_owned();

    #[cfg(target_os = "windows")]
    let file_path = std::path::PathBuf::from(decoded.replace('/', "\\"));
    #[cfg(not(target_os = "windows"))]
    let file_path = std::path::PathBuf::from(if decoded.starts_with('/') {
        decoded
    } else {
        format!("/{decoded}")
    });

    let ext = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let content_type = match ext.as_str() {
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        _ => "application/octet-stream",
    };

    match std::fs::read(&file_path) {
        Ok(data) => Response::builder()
            .status(200)
            .header("Content-Type", content_type)
            .header("Access-Control-Allow-Origin", "*")
            .body(data)
            .unwrap(),
        Err(e) => {
            eprintln!("[font://] error reading {:?}: {e}", file_path);
            Response::builder()
                .status(404)
                .body(b"Not found".to_vec())
                .unwrap()
        }
    }
}

/// One-time migration: if the Electron app userData exists at the old path,
/// copy fonts.db and caches over to Tauri's userData.
fn try_migrate_from_electron(tauri_user_data: &str) {
    // Electron uses: %APPDATA%\evergarden-font-manager
    // Tauri uses:    %APPDATA%\com.evergarden.fontmanager
    let electron_data = {
        #[cfg(target_os = "windows")]
        {
            std::env::var("APPDATA")
                .map(|a| std::path::PathBuf::from(a).join("evergarden-font-manager"))
                .ok()
        }
        #[cfg(target_os = "macos")]
        {
            dirs::data_dir()
                .map(|d| d.join("evergarden-font-manager"))
        }
        #[cfg(target_os = "linux")]
        {
            dirs::data_dir()
                .map(|d| d.join("evergarden-font-manager"))
        }
    };

    let Some(old_dir) = electron_data else { return };
    if !old_dir.exists() {
        return;
    }

    let new_dir = std::path::Path::new(tauri_user_data);
    let migrate_files = ["fonts.db", "font-metadata-bridge.json", "online-font-metadata-cache.json"];

    for file in &migrate_files {
        let src = old_dir.join(file);
        let dst = new_dir.join(file);
        if src.exists() && !dst.exists() {
            if let Err(e) = std::fs::copy(&src, &dst) {
                eprintln!("[migrate] failed to copy {file}: {e}");
            } else {
                eprintln!("[migrate] copied {file} from Electron userData");
            }
        }
    }

    // Also migrate ImportedFonts
    let old_imported = old_dir.join("ImportedFonts");
    let new_imported = new_dir.join("ImportedFonts");
    if old_imported.exists() && !new_imported.exists() {
        if let Err(e) = copy_dir_all(&old_imported, &new_imported) {
            eprintln!("[migrate] ImportedFonts copy error: {e}");
        }
    }
}

fn copy_dir_all(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)?.flatten() {
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(&entry.path(), &dst.join(entry.file_name()))?;
        } else {
            std::fs::copy(entry.path(), dst.join(entry.file_name()))?;
        }
    }
    Ok(())
}
