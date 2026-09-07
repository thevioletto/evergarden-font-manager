/// Font categorization: heuristic fallback for all fonts (paid, demo, unknown).
/// Taxonomy: Fancy, Foreign look, Techno, Gothic, Basic, Script.
/// Direct port of categorization.ts — all rules preserved identically.

fn has_any(text: &str, terms: &[&str]) -> bool {
    let lower = text.to_lowercase();
    terms.iter().any(|t| lower.contains(&t.to_lowercase()))
}

pub struct Category {
    pub category: String,
    pub subcategory: String,
}

pub fn categorize_font_family(family_name: &str, subfamily: &str, monospace: i64) -> Category {
    let family = family_name.to_lowercase();
    let sub = subfamily.to_lowercase();
    let combined = format!("{family} {sub}");
    let c = combined.as_str();

    // --- Script ---
    if has_any(c, &["calligraph", "copperplate", "spencerian", "formal script", "flourish", "swash"]) {
        return cat("Script", "Calligraphy");
    }
    if has_any(c, &["school", "chalk", "comic", "kaufmann", "palace"]) {
        return cat("Script", "School");
    }
    if has_any(c, &["handwriting", "hand written", "handwritten", "casual", "freestyle", "lucida handwriting", "segoe script"]) {
        return cat("Script", "Handwritten");
    }
    if has_any(c, &["brush", "brush script", "ink", "pen script"]) {
        return cat("Script", "Brush");
    }
    if has_any(c, &["trash", "grunge", "dirty"]) {
        return cat("Script", "Trash");
    }
    if has_any(c, &["graffiti", "street", "tag"]) {
        return cat("Script", "Graffiti");
    }
    if has_any(c, &["snell roundhand", "viner", "mistral", "bickham", "signature", "old school script"]) {
        return cat("Script", "Old School");
    }
    if has_any(c, &["script", "cursive"]) {
        return cat("Script", "Various");
    }

    // --- Gothic ---
    if has_any(c, &["blackletter", "black letter", "fraktur", "textura", "uncial", "old english", "schwabacher", "rotunda", "lombardic", "gotisch", "gothic type", "medieval"]) {
        return cat("Gothic", "Medieval");
    }
    if has_any(c, &["gothic", "grotesque", "franklin", "trade gothic", "alternate gothic"])
        && !has_any(c, &["sans", "serif"])
    {
        return cat("Gothic", "Modern");
    }
    if has_any(c, &["celtic", "insular", "irish", "gaelic"]) {
        return cat("Gothic", "Celtic");
    }
    if has_any(c, &["initials", "initial caps"])
        && has_any(c, &["gothic", "blackletter", "ornament"])
    {
        return cat("Gothic", "Initials");
    }

    // --- Techno ---
    let pixel_bitmap = &["pixel", "bitmap", "dot matrix", "8-bit", "8bit", "retro gaming", "silkscreen", "vt323", "handjet", "coral", "arcade", "blocky", "dotted", "press start", "tiny", "mini"];
    if has_any(c, pixel_bitmap) {
        let sub_cat = if c.contains("pixel") { "Pixel" } else { "Bitmap" };
        return cat("Techno", sub_cat);
    }
    if has_any(c, &["lcd", "led", "digital", "liquid crystal"]) {
        return cat("Techno", "LCD");
    }
    if has_any(c, &["sci-fi", "scifi", "cyber", "future", "tech", "circuit"]) {
        return cat("Techno", "Sci-fi");
    }
    if has_any(c, &["square", "modular", "grid"]) {
        return cat("Techno", "Square");
    }
    let mono_pixel = &["pixel", "bitmap", "dot", "8-bit", "silkscreen", "vt323", "handjet", "coral", "arcade", "game", "block", "retro", "dotted", "press"];
    if monospace == 1 && has_any(c, mono_pixel) {
        let sub_cat = if c.contains("pixel") { "Pixel" } else { "Bitmap" };
        return cat("Techno", sub_cat);
    }
    if monospace == 1 || has_any(c, &["mono", "code", "console", "terminal", "programming", "fixed width"]) {
        return cat("Basic", "Fixed width");
    }

    // --- Foreign look ---
    if has_any(c, &["chinese", "japanese", "jpn", "kanji", "hanzi", "cjk", "asian"]) {
        return cat("Foreign look", "Chinese, Jpn");
    }
    if has_any(c, &["arabic", "persian", "urdu", "hebrew"]) {
        return cat("Foreign look", "Arabic");
    }
    if has_any(c, &["mexican", "latin american", "aztec", "mayan", "fiesta"]) {
        return cat("Foreign look", "Mexican");
    }
    if has_any(c, &["roman", "greek", "latin", "trojan", "spartan", "athens"]) {
        return cat("Foreign look", "Roman, Greek");
    }
    if has_any(c, &["russian", "cyrillic", "slavic"]) {
        return cat("Foreign look", "Russian");
    }

    // --- Fancy ---
    if has_any(c, &["cartoon", "bubble", "fun", "kid", "child"]) {
        return cat("Fancy", "Cartoon");
    }
    if has_any(c, &["comic"]) {
        return cat("Fancy", "Comic");
    }
    if has_any(c, &["groovy", "psychedelic", "hippie", "70s"]) {
        return cat("Fancy", "Groovy");
    }
    if has_any(c, &["old school", "oldschool", "vintage", "retro"]) && !has_any(c, &["script"]) {
        return cat("Fancy", "Old School");
    }
    if has_any(c, &["curly", "swirly", "ornate", "flourish"]) {
        return cat("Fancy", "Curly");
    }
    if has_any(c, &["western", "cowboy", "ranch", "rodeo", "country"]) {
        return cat("Fancy", "Western");
    }
    if has_any(c, &["eroded", "weathered", "distressed", "worn"]) {
        return cat("Fancy", "Eroded");
    }
    if has_any(c, &["distorted", "stretch", "squeeze", "warp"]) {
        return cat("Fancy", "Distorted");
    }
    if has_any(c, &["destroy", "broken", "shatter", "grunge"]) {
        return cat("Fancy", "Destroy");
    }
    if has_any(c, &["horror", "halloween", "scary", "ghost", "haunted"]) {
        return cat("Fancy", "Horror");
    }
    if has_any(c, &["fire", "ice", "flame", "frost"]) {
        return cat("Fancy", "Fire, Ice");
    }
    if has_any(c, &["decorative", "ornament", "poster", "fatface", "inline", "outline", "shadow", "banner", "impact", "woodblock"]) {
        return cat("Fancy", "Decorative");
    }
    if has_any(c, &["typewriter", "typer", "ribbon"]) {
        return cat("Fancy", "Typewriter");
    }
    if has_any(c, &["stencil", "stencils", "army", "military"]) {
        return cat("Fancy", "Stencil, Army");
    }
    if has_any(c, &["retro", "vintage", "50s", "60s"]) {
        return cat("Fancy", "Retro");
    }
    if has_any(c, &["initials", "initial caps", "drop cap"]) {
        return cat("Fancy", "Initials");
    }
    if has_any(c, &["grid", "modular", "geometric"]) && has_any(c, &["display", "decorative"]) {
        return cat("Fancy", "Grid");
    }

    // --- Basic ---
    if family.contains("serif") && !family.contains("sans") {
        return cat("Basic", "Serif");
    }
    if has_any(c, &["sans", "helvetica", "arial", "futura", "univers", "gill", "optima", "akzidenz", "din", "meta", "thesis", "geometric", "humanist", "grotesque", "neo-grotesque", "verdana", "tahoma"]) {
        return cat("Basic", "Sans serif");
    }
    if has_any(c, &["mono", "code", "fixed", "console"]) || monospace == 1 {
        return cat("Basic", "Fixed width");
    }

    cat("Basic", "Various")
}

fn cat(category: &str, subcategory: &str) -> Category {
    Category {
        category: category.to_string(),
        subcategory: subcategory.to_string(),
    }
}
