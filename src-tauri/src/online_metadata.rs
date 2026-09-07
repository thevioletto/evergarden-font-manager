/// Online font metadata: tries Google Fonts then Fontsource to resolve
/// category/subcategory by family name. Caches to disk for 24h.
/// Port of online-font-metadata.ts.

use once_cell::sync::OnceCell;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

const GOOGLE_FONTS_METADATA_URL: &str = "https://fonts.google.com/metadata/fonts";
const FONTSOURCE_FONTLIST_BASE: &str = "https://api.fontsource.org/fontlist";
const CACHE_FILENAME: &str = "online-font-metadata-cache.json";
const CACHE_TTL_SECS: u64 = 24 * 60 * 60;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontMeta {
    pub category: String,
    pub subcategory: String,
}

#[derive(Serialize, Deserialize)]
struct DiskCache {
    fetched_at: u64,
    family_to_meta: HashMap<String, FontMeta>,
}

struct MemCache {
    map: HashMap<String, FontMeta>,
    fetched_at: u64,
}

static MEM_CACHE: OnceCell<Mutex<Option<MemCache>>> = OnceCell::new();

fn mem_cache() -> &'static Mutex<Option<MemCache>> {
    MEM_CACHE.get_or_init(|| Mutex::new(None))
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn map_provider_category(provider: &str) -> FontMeta {
    let c = provider.trim().to_lowercase().replace('-', " ");
    match c.as_str() {
        "serif" => FontMeta { category: "Basic".into(), subcategory: "Serif".into() },
        "sans serif" => FontMeta { category: "Basic".into(), subcategory: "Sans serif".into() },
        "monospace" => FontMeta { category: "Basic".into(), subcategory: "Fixed width".into() },
        "handwriting" | "script" => FontMeta { category: "Script".into(), subcategory: "Handwritten".into() },
        "display" => FontMeta { category: "Fancy".into(), subcategory: "Decorative".into() },
        _ => FontMeta { category: "Fancy".into(), subcategory: "Decorative".into() },
    }
}

fn cache_path(user_data: &str) -> std::path::PathBuf {
    std::path::Path::new(user_data).join(CACHE_FILENAME)
}

fn load_disk_cache(user_data: &str) -> Option<HashMap<String, FontMeta>> {
    let path = cache_path(user_data);
    let raw = std::fs::read_to_string(&path).ok()?;
    let data: DiskCache = serde_json::from_str(&raw).ok()?;
    if now_secs() - data.fetched_at < CACHE_TTL_SECS {
        Some(data.family_to_meta)
    } else {
        None
    }
}

fn write_disk_cache(user_data: &str, map: &HashMap<String, FontMeta>) {
    let data = DiskCache {
        fetched_at: now_secs(),
        family_to_meta: map.clone(),
    };
    if let Ok(json) = serde_json::to_string_pretty(&data) {
        let _ = std::fs::write(cache_path(user_data), json);
    }
}

fn fetch_google_fonts_map() -> HashMap<String, FontMeta> {
    let mut map = HashMap::new();
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .unwrap_or_default();

    let Ok(resp) = client
        .get(GOOGLE_FONTS_METADATA_URL)
        .header("Accept", "application/json")
        .send()
    else {
        return map;
    };

    let Ok(json) = resp.json::<serde_json::Value>() else {
        return map;
    };

    if let Some(list) = json.get("familyMetadataList").and_then(|v| v.as_array()) {
        for entry in list {
            if let Some(family) = entry.get("family").and_then(|v| v.as_str()) {
                let cat = entry
                    .get("category")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Display");
                let key = family.trim().to_lowercase();
                map.insert(key, map_provider_category(cat));
            }
        }
    }
    map
}

fn fetch_fontsource_map() -> HashMap<String, FontMeta> {
    let mut map = HashMap::new();
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .unwrap_or_default();

    let categories = ["serif", "sans-serif", "display", "handwriting", "monospace", "other", "icons"];
    for cat in &categories {
        let url = format!("{}?category={}", FONTSOURCE_FONTLIST_BASE, cat);
        let Ok(resp) = client.get(&url).header("Accept", "application/json").send() else {
            continue;
        };
        let Ok(data) = resp.json::<HashMap<String, String>>() else {
            continue;
        };
        for (id, cat_str) in data {
            if !id.is_empty() {
                map.entry(id).or_insert_with(|| map_provider_category(&cat_str));
            }
        }
    }
    map
}

/// Preload the cache in a blocking thread at startup.
pub fn preload_online_metadata(user_data: String) {
    std::thread::spawn(move || {
        load_metadata_map(&user_data);
    });
}

fn load_metadata_map(user_data: &str) -> HashMap<String, FontMeta> {
    // Check memory cache
    {
        let lock = mem_cache().lock().unwrap();
        if let Some(ref cache) = *lock {
            if now_secs() - cache.fetched_at < CACHE_TTL_SECS {
                return cache.map.clone();
            }
        }
    }

    // Check disk cache
    if let Some(map) = load_disk_cache(user_data) {
        let mut lock = mem_cache().lock().unwrap();
        *lock = Some(MemCache { map: map.clone(), fetched_at: now_secs() });
        return map;
    }

    // Fetch from network
    let google = fetch_google_fonts_map();
    let mut merged = google;
    for (k, v) in fetch_fontsource_map() {
        merged.entry(k).or_insert(v);
    }

    write_disk_cache(user_data, &merged);

    let mut lock = mem_cache().lock().unwrap();
    *lock = Some(MemCache { map: merged.clone(), fetched_at: now_secs() });
    merged
}

pub fn get_online_category_for_family(family_name: &str, user_data: &str) -> Option<FontMeta> {
    let trimmed = family_name.trim();
    if trimmed.is_empty() {
        return None;
    }
    let map = load_metadata_map(user_data);

    // Try with spaces normalised
    let key_spaces = trimmed.to_lowercase();
    if let Some(m) = map.get(&key_spaces) {
        return Some(m.clone());
    }

    // Try with hyphens (Fontsource id format)
    let key_hyphens = trimmed.to_lowercase().replace(' ', "-");
    map.get(&key_hyphens).cloned()
}
