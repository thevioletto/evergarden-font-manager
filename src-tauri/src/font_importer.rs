/// Font importer: copies dropped files to ImportedFonts/, parses metadata,
/// installs to OS fonts dir. Port of font-importer.ts.

use crate::db::set_os_installed;
use crate::font_installer::install_font_to_os;
use crate::font_scanner::{get_imported_fonts_directory, process_font_file};
use crate::watcher::IMPORTING_PATHS;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::Path;

const FONT_EXTENSIONS: &[&str] = &["ttf", "otf", "woff", "woff2"];

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportResult {
    pub imported: u32,
    pub failed: u32,
    pub errors: Vec<String>,
}

fn is_font_file(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| FONT_EXTENSIONS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn file_hash(path: &Path) -> Option<String> {
    let data = std::fs::read(path).ok()?;
    let mut hasher = Sha256::new();
    hasher.update(&data);
    Some(hex::encode(hasher.finalize()))
}

fn copy_to_imported_dir(source: &Path, user_data: &str) -> Result<std::path::PathBuf, String> {
    let dir = get_imported_fonts_directory(user_data);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let base = source.file_name().ok_or("No filename")?;
    let dest = dir.join(base);

    if dest.exists() {
        // Same content → reuse
        if file_hash(source) == file_hash(&dest) {
            return Ok(dest);
        }
        // Different content → find a free numbered name
        let stem = Path::new(base)
            .file_stem()
            .unwrap_or(base)
            .to_string_lossy()
            .into_owned();
        let ext = Path::new(base)
            .extension()
            .map(|e| format!(".{}", e.to_string_lossy()))
            .unwrap_or_default();
        let mut n = 1u32;
        loop {
            let candidate = dir.join(format!("{stem}-{n}{ext}"));
            if !candidate.exists() {
                std::fs::copy(source, &candidate).map_err(|e| e.to_string())?;
                return Ok(candidate);
            }
            n += 1;
        }
    }

    std::fs::copy(source, &dest).map_err(|e| e.to_string())?;
    Ok(dest)
}

pub fn import_font_files<F>(
    source_paths: &[String],
    user_data: &str,
    on_progress: F,
) -> ImportResult
where
    F: Fn(u32),
{
    let mut result = ImportResult {
        imported: 0,
        failed: 0,
        errors: Vec::new(),
    };

    let paths: Vec<&String> = source_paths
        .iter()
        .filter(|p| is_font_file(Path::new(p.as_str())))
        .collect();

    for (i, src_str) in paths.iter().enumerate() {
        let src = Path::new(src_str.as_str());
        match import_one(src, user_data) {
            Ok(_) => result.imported += 1,
            Err(e) => {
                result.failed += 1;
                let name = src.file_name().unwrap_or_default().to_string_lossy();
                result.errors.push(format!("{name}: {e}"));
            }
        }
        on_progress(i as u32 + 1);
    }

    result
}

fn import_one(src: &Path, user_data: &str) -> Result<(), String> {
    let staged = copy_to_imported_dir(src, user_data)?;

    // Suppress watcher
    {
        let mut lock = IMPORTING_PATHS.lock().unwrap();
        lock.insert(staged.to_string_lossy().into_owned());
    }

    let meta = process_font_file(&staged, user_data);

    // Unmark after 3s
    let staged_clone = staged.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(3));
        let mut lock = IMPORTING_PATHS.lock().unwrap();
        lock.remove(&staged_clone.to_string_lossy().into_owned());
    });

    let meta = meta.ok_or_else(|| "could not parse font".to_string())?;

    // Install to OS (Windows only)
    #[cfg(target_os = "windows")]
    {
        match install_font_to_os(
            &staged.to_string_lossy(),
            &meta.family,
            &meta.subfamily,
        ) {
            Ok(installed_path) => {
                let path_clone = installed_path.clone();
                {
                    let mut lock = IMPORTING_PATHS.lock().unwrap();
                    lock.insert(installed_path.clone());
                }
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(3));
                    let mut lock = IMPORTING_PATHS.lock().unwrap();
                    lock.remove(&path_clone);
                });
                let _ = set_os_installed(&staged.to_string_lossy(), true);
            }
            Err(e) => {
                eprintln!("[importer] OS install failed (non-fatal): {e}");
            }
        }
    }

    Ok(())
}
