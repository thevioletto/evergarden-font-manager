// Font categorization: heuristic fallback for all fonts (paid, demo, unknown).
// Taxonomy: Fancy, Foreign look, Techno, Gothic, Basic, Script.

function hasAny(str: string, terms: string[]): boolean {
  const s = str.toLowerCase();
  return terms.some((t) => s.includes(t.toLowerCase()));
}

export function categorizeFontFamily(
  familyName: string,
  subfamily: string,
  monospace: number
): { category: string; subcategory: string } {
  const family = familyName.toLowerCase();
  const sub = subfamily.toLowerCase();
  const combined = `${family} ${sub}`;

  // --- Script ---
  const scriptCalligraphy = [
    "calligraph",
    "copperplate",
    "spencerian",
    "formal script",
    "flourish",
    "swash",
  ];
  if (hasAny(combined, scriptCalligraphy)) {
    return { category: "Script", subcategory: "Calligraphy" };
  }
  const scriptSchool = ["school", "chalk", "comic", "kaufmann", "palace"];
  if (hasAny(combined, scriptSchool)) {
    return { category: "Script", subcategory: "School" };
  }
  const scriptHandwritten = [
    "handwriting",
    "hand written",
    "handwritten",
    "casual",
    "freestyle",
    "lucida handwriting",
    "segoe script",
  ];
  if (hasAny(combined, scriptHandwritten)) {
    return { category: "Script", subcategory: "Handwritten" };
  }
  const scriptBrush = ["brush", "brush script", "ink", "pen script"];
  if (hasAny(combined, scriptBrush)) {
    return { category: "Script", subcategory: "Brush" };
  }
  const scriptTrash = ["trash", "grunge", "dirty"];
  if (hasAny(combined, scriptTrash)) {
    return { category: "Script", subcategory: "Trash" };
  }
  const scriptGraffiti = ["graffiti", "street", "tag"];
  if (hasAny(combined, scriptGraffiti)) {
    return { category: "Script", subcategory: "Graffiti" };
  }
  if (
    hasAny(combined, [
      "snell roundhand",
      "viner",
      "mistral",
      "bickham",
      "signature",
      "old school script",
    ])
  ) {
    return { category: "Script", subcategory: "Old School" };
  }
  if (hasAny(combined, ["script", "cursive"])) {
    return { category: "Script", subcategory: "Various" };
  }

  // --- Gothic (blackletter, medieval, celtic) ---
  const gothicMedieval = [
    "blackletter",
    "black letter",
    "fraktur",
    "textura",
    "uncial",
    "old english",
    "schwabacher",
    "rotunda",
    "lombardic",
    "gotisch",
    "gothic type",
    "medieval",
  ];
  if (hasAny(combined, gothicMedieval)) {
    return { category: "Gothic", subcategory: "Medieval" };
  }
  const gothicModern = [
    "gothic",
    "grotesque",
    "franklin",
    "trade gothic",
    "alternate gothic",
  ];
  if (hasAny(combined, gothicModern) && !hasAny(combined, ["sans", "serif"])) {
    return { category: "Gothic", subcategory: "Modern" };
  }
  const gothicCeltic = ["celtic", "insular", "irish", "gaelic"];
  if (hasAny(combined, gothicCeltic)) {
    return { category: "Gothic", subcategory: "Celtic" };
  }
  if (
    hasAny(combined, ["initials", "initial caps"]) &&
    hasAny(combined, ["gothic", "blackletter", "ornament"])
  ) {
    return { category: "Gothic", subcategory: "Initials" };
  }

  // --- Techno (pixel, bitmap, lcd, sci-fi) ---
  const technoPixelBitmap = [
    "pixel",
    "bitmap",
    "dot matrix",
    "8-bit",
    "8bit",
    "retro gaming",
    "silkscreen",
    "vt323",
    "handjet",
    "coral",
    "arcade",
    "blocky",
    "dotted",
    "press start",
    "tiny",
    "mini",
  ];
  if (hasAny(combined, technoPixelBitmap)) {
    return {
      category: "Techno",
      subcategory: hasAny(combined, ["pixel"]) ? "Pixel" : "Bitmap",
    };
  }
  const technoLcd = ["lcd", "led", "digital", "liquid crystal"];
  if (hasAny(combined, technoLcd)) {
    return { category: "Techno", subcategory: "LCD" };
  }
  const technoSciFi = ["sci-fi", "scifi", "cyber", "future", "tech", "circuit"];
  if (hasAny(combined, technoSciFi)) {
    return { category: "Techno", subcategory: "Sci-fi" };
  }
  const technoSquare = ["square", "modular", "grid"];
  if (hasAny(combined, technoSquare)) {
    return { category: "Techno", subcategory: "Square" };
  }
  // Basic: fixed width / monospace — but if name suggests pixel/bitmap/display (e.g. DaFont), keep as Techno
  const monospacePixelHints = [
    "pixel",
    "bitmap",
    "dot",
    "8-bit",
    "silkscreen",
    "vt323",
    "handjet",
    "coral",
    "arcade",
    "game",
    "block",
    "retro",
    "dotted",
    "press",
  ];
  if (monospace === 1 && hasAny(combined, monospacePixelHints)) {
    return {
      category: "Techno",
      subcategory: hasAny(combined, ["pixel"]) ? "Pixel" : "Bitmap",
    };
  }
  if (
    monospace === 1 ||
    hasAny(combined, [
      "mono",
      "code",
      "console",
      "terminal",
      "programming",
      "fixed width",
    ])
  ) {
    return { category: "Basic", subcategory: "Fixed width" };
  }

  // --- Foreign look ---
  const foreignChineseJpn = [
    "chinese",
    "japanese",
    "jpn",
    "kanji",
    "hanzi",
    "cjk",
    "asian",
  ];
  if (hasAny(combined, foreignChineseJpn)) {
    return { category: "Foreign look", subcategory: "Chinese, Jpn" };
  }
  const foreignArabic = ["arabic", "persian", "urdu", "hebrew"];
  if (hasAny(combined, foreignArabic)) {
    return { category: "Foreign look", subcategory: "Arabic" };
  }
  const foreignMexican = [
    "mexican",
    "latin american",
    "aztec",
    "mayan",
    "fiesta",
  ];
  if (hasAny(combined, foreignMexican)) {
    return { category: "Foreign look", subcategory: "Mexican" };
  }
  const foreignRomanGreek = [
    "roman",
    "greek",
    "latin",
    "trojan",
    "spartan",
    "athens",
  ];
  if (hasAny(combined, foreignRomanGreek)) {
    return { category: "Foreign look", subcategory: "Roman, Greek" };
  }
  const foreignRussian = ["russian", "cyrillic", "slavic"];
  if (hasAny(combined, foreignRussian)) {
    return { category: "Foreign look", subcategory: "Russian" };
  }

  // --- Fancy ---
  const fancyCartoon = ["cartoon", "bubble", "fun", "kid", "child"];
  if (hasAny(combined, fancyCartoon)) {
    return { category: "Fancy", subcategory: "Cartoon" };
  }
  if (hasAny(combined, ["comic"])) {
    return { category: "Fancy", subcategory: "Comic" };
  }
  if (hasAny(combined, ["groovy", "psychedelic", "hippie", "70s"])) {
    return { category: "Fancy", subcategory: "Groovy" };
  }
  if (
    hasAny(combined, ["old school", "oldschool", "vintage", "retro"]) &&
    !hasAny(combined, ["script"])
  ) {
    return { category: "Fancy", subcategory: "Old School" };
  }
  if (hasAny(combined, ["curly", "swirly", "ornate", "flourish"])) {
    return { category: "Fancy", subcategory: "Curly" };
  }
  if (hasAny(combined, ["western", "cowboy", "ranch", "rodeo", "country"])) {
    return { category: "Fancy", subcategory: "Western" };
  }
  if (hasAny(combined, ["eroded", "weathered", "distressed", "worn"])) {
    return { category: "Fancy", subcategory: "Eroded" };
  }
  if (hasAny(combined, ["distorted", "stretch", "squeeze", "warp"])) {
    return { category: "Fancy", subcategory: "Distorted" };
  }
  if (hasAny(combined, ["destroy", "broken", "shatter", "grunge"])) {
    return { category: "Fancy", subcategory: "Destroy" };
  }
  if (hasAny(combined, ["horror", "halloween", "scary", "ghost", "haunted"])) {
    return { category: "Fancy", subcategory: "Horror" };
  }
  if (hasAny(combined, ["fire", "ice", "flame", "frost"])) {
    return { category: "Fancy", subcategory: "Fire, Ice" };
  }
  if (
    hasAny(combined, [
      "decorative",
      "ornament",
      "poster",
      "fatface",
      "inline",
      "outline",
      "shadow",
      "banner",
      "impact",
      "woodblock",
    ])
  ) {
    return { category: "Fancy", subcategory: "Decorative" };
  }
  if (hasAny(combined, ["typewriter", "typer", "ribbon"])) {
    return { category: "Fancy", subcategory: "Typewriter" };
  }
  if (hasAny(combined, ["stencil", "stencils", "army", "military"])) {
    return { category: "Fancy", subcategory: "Stencil, Army" };
  }
  if (hasAny(combined, ["retro", "vintage", "50s", "60s"])) {
    return { category: "Fancy", subcategory: "Retro" };
  }
  if (hasAny(combined, ["initials", "initial caps", "drop cap"])) {
    return { category: "Fancy", subcategory: "Initials" };
  }
  if (
    hasAny(combined, ["grid", "modular", "geometric"]) &&
    hasAny(combined, ["display", "decorative"])
  ) {
    return { category: "Fancy", subcategory: "Grid" };
  }

  // --- Basic ---
  if (family.includes("serif") && !family.includes("sans")) {
    return { category: "Basic", subcategory: "Serif" };
  }
  if (
    hasAny(combined, [
      "sans",
      "helvetica",
      "arial",
      "futura",
      "univers",
      "gill",
      "optima",
      "akzidenz",
      "din",
      "meta",
      "thesis",
      "geometric",
      "humanist",
      "grotesque",
      "neo-grotesque",
      "verdana",
      "tahoma",
    ])
  ) {
    return { category: "Basic", subcategory: "Sans serif" };
  }
  if (
    hasAny(combined, ["mono", "code", "fixed", "console"]) ||
    monospace === 1
  ) {
    return { category: "Basic", subcategory: "Fixed width" };
  }

  return { category: "Basic", subcategory: "Various" };
}
