/// Font metadata bridge: generates font-metadata-bridge.json from the DB.
/// Port of font-metadata-bridge.ts.

use crate::db::get_unique_families_with_category;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FontMetadataEntry {
    pub category: String,
    pub subcategory: String,
    pub tags: Vec<String>,
}

pub type FontMetadataBridge = HashMap<String, FontMetadataEntry>;

fn bridge_path(user_data: &str) -> std::path::PathBuf {
    std::path::Path::new(user_data).join("font-metadata-bridge.json")
}

fn normalize_key(family: &str) -> String {
    family.trim().to_lowercase().split_whitespace().collect::<Vec<_>>().join(" ")
}

fn tags_from_entry(family: &str, category: &str, subcategory: &str) -> Vec<String> {
    let mut tags = std::collections::HashSet::new();
    let f = family.to_lowercase();
    tags.insert(category.to_lowercase().replace(' ', "-"));
    tags.insert(subcategory.to_lowercase().replace(' ', "-"));

    if f.contains("mono") || f.contains("code") || subcategory == "Code" {
        tags.insert("monospace".into());
    }
    if f.contains("script") || f.contains("cursive") {
        tags.insert("script".into());
    }
    let web_safe = ["arial", "helvetica", "verdana", "tahoma", "georgia", "times new roman"];
    if web_safe.iter().any(|s| f.contains(s)) {
        tags.insert("web-safe".into());
    }
    let system_ui = ["segoe ui", "sf pro", "san francisco", "roboto", "ubuntu"];
    if system_ui.iter().any(|s| f.contains(s)) {
        tags.insert("system-ui".into());
    }

    let mut v: Vec<String> = tags.into_iter().collect();
    v.sort();
    v
}

pub fn load_bridge(user_data: &str) -> FontMetadataBridge {
    let path = bridge_path(user_data);
    if let Ok(raw) = std::fs::read_to_string(&path) {
        if let Ok(bridge) = serde_json::from_str::<FontMetadataBridge>(&raw) {
            return bridge;
        }
    }
    HashMap::new()
}

pub fn generate_bridge_from_database(user_data: &str) {
    let rows = match get_unique_families_with_category() {
        Ok(r) => r,
        Err(e) => {
            eprintln!("generate_bridge_from_database error: {e}");
            return;
        }
    };

    let mut bridge = FontMetadataBridge::new();
    for row in rows {
        let key = normalize_key(&row.family);
        let cat = if row.category.is_empty() { "Basic".to_string() } else { row.category.clone() };
        let sub = if row.subcategory.is_empty() { "Various".to_string() } else { row.subcategory.clone() };
        bridge.insert(
            key,
            FontMetadataEntry {
                tags: tags_from_entry(&row.family, &cat, &sub),
                category: cat,
                subcategory: sub,
            },
        );
    }

    let path = bridge_path(user_data);
    if let Ok(json) = serde_json::to_string_pretty(&bridge) {
        let _ = std::fs::write(&path, json);
    }
}
