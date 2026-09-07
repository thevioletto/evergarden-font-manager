/// Font scanner: reads system font directories, parses metadata via ttf-parser,
/// saves to DB. Port of font-scanner.ts.

use crate::categorization::categorize_font_family;
use crate::db::{save_font, FontData};
use crate::online_metadata::get_online_category_for_family;
use sha2::{Digest, Sha256};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

const FONT_EXTENSIONS: &[&str] = &["ttf", "otf", "woff", "woff2"];

pub fn get_imported_fonts_directory(user_data: &str) -> std::path::PathBuf {
    std::path::Path::new(user_data).join("ImportedFonts")
}

pub fn get_system_font_directories(user_data: &str) -> Vec<std::path::PathBuf> {
    let mut dirs = Vec::new();

    #[cfg(target_os = "windows")]
    {
        let win_dir = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".into());
        dirs.push(std::path::PathBuf::from(&win_dir).join("Fonts"));
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            dirs.push(
                std::path::PathBuf::from(local)
                    .join("Microsoft")
                    .join("Windows")
                    .join("Fonts"),
            );
        }
    }
    #[cfg(target_os = "macos")]
    {
        dirs.push("/System/Library/Fonts".into());
        dirs.push("/Library/Fonts".into());
        if let Some(home) = dirs::home_dir() {
            dirs.push(home.join("Library").join("Fonts"));
        }
    }
    #[cfg(target_os = "linux")]
    {
        dirs.push("/usr/share/fonts".into());
        if let Some(home) = dirs::home_dir() {
            dirs.push(home.join(".fonts"));
        }
    }

    dirs.push(get_imported_fonts_directory(user_data));
    dirs
}

#[allow(dead_code)]
fn file_hash(path: &Path) -> Result<String, std::io::Error> {
    let data = std::fs::read(path)?;
    let mut hasher = Sha256::new();
    hasher.update(&data);
    Ok(hex::encode(hasher.finalize()))
}

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

/// Extract OpenType feature tags from raw GSUB/GPOS table bytes.
/// Layout of GSUB/GPOS Header:
/// offset 0..2: majorVersion (uint16)
/// offset 2..4: minorVersion (uint16)
/// offset 4..6: scriptListOffset (Offset16)
/// offset 6..8: featureListOffset (Offset16)
/// offset 8..10: lookupListOffset (Offset16)
/// FeatureList:
/// offset 0..2: featureCount (uint16)
/// then entries: [tag(4 bytes) + offset(2 bytes)]
fn extract_feature_tags_from_table(
    table_data: &[u8],
    out: &mut std::collections::HashSet<String>,
) {
    if table_data.len() < 8 {
        return;
    }
    let feature_list_offset = u16::from_be_bytes([table_data[6], table_data[7]]) as usize;
    if feature_list_offset + 2 > table_data.len() {
        return;
    }
    let fl = &table_data[feature_list_offset..];
    let feature_count = u16::from_be_bytes([fl[0], fl[1]]) as usize;
    for j in 0..feature_count {
        let entry = 2 + j * 6;
        if entry + 4 > fl.len() {
            break;
        }
        if let Ok(tag) = std::str::from_utf8(&fl[entry..entry + 4]) {
            let t = tag.trim();
            if !t.is_empty() && t.chars().all(|c| c.is_ascii_graphic()) {
                out.insert(t.to_string());
            }
        }
    }
}

pub fn extract_opentype_features(face: &ttf_parser::Face) -> Vec<String> {
    let mut tags: std::collections::HashSet<String> = std::collections::HashSet::new();
    if let Some(gsub) = face.raw_face().table(ttf_parser::Tag::from_bytes(b"GSUB")) {
        extract_feature_tags_from_table(gsub, &mut tags);
    }
    if let Some(gpos) = face.raw_face().table(ttf_parser::Tag::from_bytes(b"GPOS")) {
        extract_feature_tags_from_table(gpos, &mut tags);
    }
    let mut v: Vec<String> = tags.into_iter().collect();
    v.sort();
    v
}

pub fn extract_character_set(face: &ttf_parser::Face) -> Vec<u32> {
    face.tables()
        .cmap
        .map(|cmap| {
            let mut cps = Vec::new();
            for subtable in cmap.subtables {
                if subtable.is_unicode() {
                    subtable.codepoints(|cp| {
                        cps.push(cp);
                    });
                    break;
                }
            }
            cps.sort_unstable();
            cps.dedup();
            cps
        })
        .unwrap_or_default()
}


fn clean_str(s: &str) -> String {
    s.replace('\0', "").trim().to_string()
}

const LICENSE_SUFFIXES: &[&str] = &[
    "Unlicensed Trial",
    "Personal Use Only",
    "Personal Use",
    "Unlicensed",
    "Trial",
    "Demo",
    "Free",
];

fn strip_license_suffix(name: &str) -> String {
    let mut result = name.to_string();
    let mut changed = true;
    while changed {
        changed = false;
        // Sort longest first
        let mut suffixes = LICENSE_SUFFIXES.to_vec();
        suffixes.sort_by(|a, b| b.len().cmp(&a.len()));

        for suffix in &suffixes {
            let lower = result.to_lowercase();
            let suf_lower = suffix.to_lowercase();
            // Match suffix optionally preceded by whitespace/dash
            if let Some(idx) = lower.rfind(&suf_lower) {
                let before = &lower[..idx];
                if before.trim_end_matches(|c: char| c == '-' || c == '–' || c == '—' || c.is_whitespace()).len() < before.len()
                    || idx == 0
                {
                    let stripped = result[..idx].trim_end_matches(|c: char| c == '-' || c == '–' || c == '—' || c.is_whitespace()).to_string();
                    if !stripped.is_empty() {
                        result = stripped;
                        changed = true;
                        break;
                    }
                }
            }
        }
    }
    result
}

fn parse_face_name(face: &ttf_parser::Face, name_id: u16) -> Option<String> {
    // Prefer Windows platform (id=3), then any.
    // name.to_string() already returns None for encodings it can't decode.
    let mut fallback: Option<String> = None;

    for name in face.names() {
        if name.name_id != name_id {
            continue;
        }
        if let Some(s) = name.to_string() {
            let cleaned = clean_str(&s);
            if cleaned.is_empty() {
                continue;
            }
            // Prefer Windows platform
            if name.platform_id == ttf_parser::PlatformId::Windows {
                return Some(cleaned);
            }
            if fallback.is_none() {
                fallback = Some(cleaned);
            }
        }
    }
    fallback
}

pub fn process_font_file(file_path: &Path, user_data: &str) -> Option<FontData> {
    let ext = file_path.extension()?.to_str()?.to_lowercase();
    if !FONT_EXTENSIONS.contains(&ext.as_str()) {
        return None;
    }

    let data = std::fs::read(file_path).ok()?;
    let hash = {
        let mut hasher = Sha256::new();
        hasher.update(&data);
        hex::encode(hasher.finalize())
    };

    let face = ttf_parser::Face::parse(&data, 0).ok()?;

    // Name IDs: 1=Family, 2=Subfamily, 4=Full name, 6=PostScript, 16=Preferred family, 17=Preferred subfamily
    let preferred_family = parse_face_name(&face, 16).or_else(|| parse_face_name(&face, 1))?;
    let preferred_subfamily = parse_face_name(&face, 17).or_else(|| parse_face_name(&face, 2)).unwrap_or_else(|| "Regular".into());
    let full_name = parse_face_name(&face, 4).unwrap_or_else(|| preferred_family.clone());
    let postscript_name = parse_face_name(&face, 6).unwrap_or_default();
    let version_str = parse_face_name(&face, 5).unwrap_or_default();
    let copyright = parse_face_name(&face, 0).unwrap_or_default();

    // Strip subfamily from family if appended (heuristic 1)
    let mut family_name = preferred_family.clone();
    if !preferred_subfamily.is_empty() {
        let fl = family_name.to_lowercase();
        let sl = preferred_subfamily.to_lowercase();
        if fl.ends_with(&format!(" {sl}")) {
            family_name = family_name[..family_name.len() - preferred_subfamily.len() - 1].trim().to_string();
        }
    }

    // Strip license suffixes (heuristic 2)
    family_name = strip_license_suffix(&family_name);
    if family_name.is_empty() {
        family_name = preferred_family.clone();
    }

    // Weight from OS/2
    let weight = face
        .tables()
        .os2
        .map(|os2| os2.weight().to_number() as i64)
        .unwrap_or(400)
        .clamp(1, 900);

    let is_monospace = face
        .tables()
        .post
        .map(|p| if p.is_monospaced { 1i64 } else { 0i64 })
        .unwrap_or(0);

    let italic = if face.italic_angle().map_or(false, |a| a != 0.0) {
        1i64
    } else {
        // Check OS/2 style bits as fallback
        face.tables()
            .os2
            .map(|os2| {
                let s = os2.style();
                if s == ttf_parser::os2::Style::Italic || s == ttf_parser::os2::Style::Oblique {
                    1i64
                } else {
                    0i64
                }
            })
            .unwrap_or(0)
    };
    let num_glyphs = face.number_of_glyphs() as u32;
    let units_per_em = face.units_per_em();

    // OpenType features
    let features = extract_opentype_features(&face);
    let character_set = extract_character_set(&face);

    // Category
    let (category, subcategory) = {
        if let Some(online) = get_online_category_for_family(&family_name, user_data) {
            (online.category, online.subcategory)
        } else {
            let cat = categorize_font_family(&family_name, &preferred_subfamily, is_monospace);
            (cat.category, cat.subcategory)
        }
    };

    let metadata_json = serde_json::json!({
        "upm": units_per_em,
        "glyphs": num_glyphs,
        "features": features,
        "characterSet": character_set,
    })
    .to_string();

    let font_data = FontData {
        file_path: file_path.to_string_lossy().into_owned(),
        file_hash: hash,
        family: family_name,
        subfamily: preferred_subfamily,
        full_name,
        postscript_name,
        weight,
        width: 5,
        italic,
        monospace: is_monospace,
        category,
        subcategory,
        version: version_str,
        copyright,
        metadata_json,
        last_seen: now_secs(),
    };

    if let Err(e) = save_font(&font_data) {
        eprintln!("[scanner] save_font FAILED: {e}");
        return None;
    }

    Some(font_data)
}

pub fn scan_fonts<F>(user_data: &str, on_progress: F) -> Vec<FontData>
where
    F: Fn(usize) + Send + Sync,
{
    let dirs = get_system_font_directories(user_data);
    let mut found = Vec::new();

    for dir in &dirs {
        scan_dir(dir, user_data, &mut found, &on_progress);
    }

    found
}

fn scan_dir<F>(dir: &Path, user_data: &str, found: &mut Vec<FontData>, on_progress: &F)
where
    F: Fn(usize),
{
    if !dir.exists() {
        return;
    }
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(e) => {
            eprintln!("[scanner] read_dir {:?}: {e}", dir);
            return;
        }
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            scan_dir(&path, user_data, found, on_progress);
        } else if path.is_file() {
            if let Some(font) = process_font_file(&path, user_data) {
                found.push(font);
                on_progress(found.len());
            }
        }
    }
}
