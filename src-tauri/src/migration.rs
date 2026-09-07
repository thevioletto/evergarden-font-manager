/// DB category migration: re-categorizes all existing fonts on startup.
/// Port of migration.ts.

use crate::categorization::categorize_font_family;
use crate::db::{get_all_fonts_raw, update_font_category};

pub fn migrate_fonts_with_categories() -> Result<u32, String> {
    let all_fonts = get_all_fonts_raw()?;
    let mut updated = 0u32;

    for font in &all_fonts {
        let id = font.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
        let family = font
            .get("family")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        let subfamily = font
            .get("subfamily")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        let monospace = font
            .get("monospace")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);

        let cat = categorize_font_family(family, subfamily, monospace);
        update_font_category(id, &cat.category, &cat.subcategory)?;
        updated += 1;
    }

    Ok(updated)
}
