import { convertFileSrc } from "@tauri-apps/api/core";

export function toFontUrl(filePath: string): string {
  if (!filePath) return "";
  if (
    filePath.startsWith("http://") ||
    filePath.startsWith("https://") ||
    filePath.startsWith("asset://") ||
    filePath.startsWith("data:")
  ) {
    return filePath;
  }
  return convertFileSrc(filePath);
}

export const OPENTYPE_FEATURES: {
  tag: string;
  label: string;
  category: string;
}[] = [
  // Ligatures
  { tag: "liga", label: "Standard Ligatures", category: "Ligatures" },
  { tag: "dlig", label: "Discretionary Ligatures", category: "Ligatures" },
  { tag: "hlig", label: "Historical Ligatures", category: "Ligatures" },
  { tag: "calt", label: "Contextual Alternates", category: "Ligatures" },
  { tag: "clig", label: "Contextual Ligatures", category: "Ligatures" },
  { tag: "rlig", label: "Required Ligatures", category: "Ligatures" },

  // Alternates
  { tag: "swsh", label: "Swashes", category: "Alternates" },
  { tag: "cswh", label: "Contextual Swash", category: "Alternates" },
  { tag: "salt", label: "Stylistic Alternates", category: "Alternates" },
  { tag: "aalt", label: "Access All Alternates", category: "Alternates" },
  { tag: "titl", label: "Titling Alternates", category: "Alternates" },
  { tag: "nalt", label: "Alternate Annotation Forms", category: "Alternates" },
  { tag: "hist", label: "Historical Forms", category: "Alternates" },
  { tag: "rand", label: "Randomize", category: "Alternates" },

  // Stylistic Sets (ss01 - ss20)
  { tag: "ss01", label: "Stylistic Set 1", category: "Stylistic Sets" },
  { tag: "ss02", label: "Stylistic Set 2", category: "Stylistic Sets" },
  { tag: "ss03", label: "Stylistic Set 3", category: "Stylistic Sets" },
  { tag: "ss04", label: "Stylistic Set 4", category: "Stylistic Sets" },
  { tag: "ss05", label: "Stylistic Set 5", category: "Stylistic Sets" },
  { tag: "ss06", label: "Stylistic Set 6", category: "Stylistic Sets" },
  { tag: "ss07", label: "Stylistic Set 7", category: "Stylistic Sets" },
  { tag: "ss08", label: "Stylistic Set 8", category: "Stylistic Sets" },
  { tag: "ss09", label: "Stylistic Set 9", category: "Stylistic Sets" },
  { tag: "ss10", label: "Stylistic Set 10", category: "Stylistic Sets" },
  { tag: "ss11", label: "Stylistic Set 11", category: "Stylistic Sets" },
  { tag: "ss12", label: "Stylistic Set 12", category: "Stylistic Sets" },
  { tag: "ss13", label: "Stylistic Set 13", category: "Stylistic Sets" },
  { tag: "ss14", label: "Stylistic Set 14", category: "Stylistic Sets" },
  { tag: "ss15", label: "Stylistic Set 15", category: "Stylistic Sets" },
  { tag: "ss16", label: "Stylistic Set 16", category: "Stylistic Sets" },
  { tag: "ss17", label: "Stylistic Set 17", category: "Stylistic Sets" },
  { tag: "ss18", label: "Stylistic Set 18", category: "Stylistic Sets" },
  { tag: "ss19", label: "Stylistic Set 19", category: "Stylistic Sets" },
  { tag: "ss20", label: "Stylistic Set 20", category: "Stylistic Sets" },

  // Character Variants (cv01 - cv20)
  { tag: "cv01", label: "Character Variant 1", category: "Character Variants" },
  { tag: "cv02", label: "Character Variant 2", category: "Character Variants" },
  { tag: "cv03", label: "Character Variant 3", category: "Character Variants" },
  { tag: "cv04", label: "Character Variant 4", category: "Character Variants" },
  { tag: "cv05", label: "Character Variant 5", category: "Character Variants" },
  { tag: "cv06", label: "Character Variant 6", category: "Character Variants" },
  { tag: "cv07", label: "Character Variant 7", category: "Character Variants" },
  { tag: "cv08", label: "Character Variant 8", category: "Character Variants" },
  { tag: "cv09", label: "Character Variant 9", category: "Character Variants" },
  {
    tag: "cv10",
    label: "Character Variant 10",
    category: "Character Variants",
  },
  {
    tag: "cv11",
    label: "Character Variant 11",
    category: "Character Variants",
  },
  {
    tag: "cv12",
    label: "Character Variant 12",
    category: "Character Variants",
  },
  {
    tag: "cv13",
    label: "Character Variant 13",
    category: "Character Variants",
  },
  {
    tag: "cv14",
    label: "Character Variant 14",
    category: "Character Variants",
  },
  {
    tag: "cv15",
    label: "Character Variant 15",
    category: "Character Variants",
  },
  {
    tag: "cv16",
    label: "Character Variant 16",
    category: "Character Variants",
  },
  {
    tag: "cv17",
    label: "Character Variant 17",
    category: "Character Variants",
  },
  {
    tag: "cv18",
    label: "Character Variant 18",
    category: "Character Variants",
  },
  {
    tag: "cv19",
    label: "Character Variant 19",
    category: "Character Variants",
  },
  {
    tag: "cv20",
    label: "Character Variant 20",
    category: "Character Variants",
  },

  // Numbers & Figures
  { tag: "lnum", label: "Lining Figures", category: "Numbers" },
  { tag: "onum", label: "Oldstyle Figures", category: "Numbers" },
  { tag: "pnum", label: "Proportional Figures", category: "Numbers" },
  { tag: "tnum", label: "Tabular Figures", category: "Numbers" },
  { tag: "frac", label: "Fractions", category: "Numbers" },
  { tag: "ordn", label: "Ordinals", category: "Numbers" },
  { tag: "zero", label: "Slashed Zero", category: "Numbers" },
  { tag: "sups", label: "Superscript", category: "Numbers" },
  { tag: "subs", label: "Subscript", category: "Numbers" },
  { tag: "sinf", label: "Scientific Inferiors", category: "Numbers" },
  { tag: "numr", label: "Numerators", category: "Numbers" },
  { tag: "dnom", label: "Denominators", category: "Numbers" },

  // Capitals & Small Caps
  { tag: "smcp", label: "Small Capitals", category: "Capitals" },
  { tag: "c2sc", label: "Capitals to Small Caps", category: "Capitals" },
  { tag: "unic", label: "Unicase", category: "Capitals" },
  { tag: "c2pc", label: "Capitals to Petite Caps", category: "Capitals" },
  { tag: "pcap", label: "Petite Capitals", category: "Capitals" },

  // Spacing & Positioning
  { tag: "kern", label: "Kerning", category: "Spacing" },
  { tag: "cpsp", label: "Capital Spacing", category: "Spacing" },
  { tag: "mark", label: "Mark Positioning", category: "Spacing" },
  { tag: "mkmk", label: "Mark to Mark Positioning", category: "Spacing" },

  // Technical & Localization
  { tag: "ccmp", label: "Glyph Composition", category: "Technical" },
  { tag: "locl", label: "Localized Forms", category: "Technical" },
  { tag: "case", label: "Case-Sensitive Forms", category: "Technical" },
];

export const FEATURE_CATEGORY_ORDER = [
  "Ligatures",
  "Capitals",
  "Numbers",
  "Alternates",
  "Spacing",
  "Technical",
  "Stylistic Sets",
  "Character Variants",
  "Other",
];

export function getFeatureInfo(tag: string): {
  tag: string;
  label: string;
  category: string;
} {
  const found = OPENTYPE_FEATURES.find((f) => f.tag === tag);
  if (found) return found;

  if (/^cv\d{2}$/i.test(tag)) {
    const num = parseInt(tag.slice(2), 10);
    return {
      tag,
      label: `Character Variant ${num}`,
      category: "Character Variants",
    };
  }

  if (/^ss\d{2}$/i.test(tag)) {
    const num = parseInt(tag.slice(2), 10);
    return {
      tag,
      label: `Stylistic Set ${num}`,
      category: "Stylistic Sets",
    };
  }

  return {
    tag,
    label: tag.toUpperCase(),
    category: "Other",
  };
}

export const WEIGHT_NAMES: Record<number, string> = {
  1: "Thin",
  100: "Thin",
  200: "Extra Light",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "Semi Bold",
  700: "Bold",
  800: "Extra Bold",
  900: "Black",
};

export function getVariantDisplayLabel(
  v: {
    full_name?: string;
    family?: string;
    subfamily?: string;
    weight?: number;
  },
  family: string
): string {
  const full = (v.full_name ?? "").trim();
  const sub = (v.subfamily ?? "").trim();
  const fam = (family ?? "").trim();
  const weight = v.weight != null ? Number(v.weight) : NaN;

  if (full && fam && full !== sub) {
    const afterFamily = full.startsWith(fam)
      ? full
          .slice(fam.length)
          .replace(/^[\s\-–—]+/, "")
          .trim()
      : "";
    if (afterFamily && afterFamily.toLowerCase() !== sub.toLowerCase()) {
      return afterFamily;
    }
  }

  const weightName =
    !Number.isNaN(weight) && weight >= 1 && weight <= 900
      ? (WEIGHT_NAMES[weight] ??
        (weight <= 150
          ? "Thin"
          : weight <= 250
            ? "Extra Light"
            : weight <= 350
              ? "Light"
              : weight <= 450
                ? "Regular"
                : weight <= 550
                  ? "Medium"
                  : weight <= 650
                    ? "Semi Bold"
                    : weight <= 750
                      ? "Bold"
                      : weight <= 850
                        ? "Extra Bold"
                        : "Black"))
      : null;
  const isGeneric = /^(Regular|Normal|Italic|Oblique|Bold|Bold Italic)$/i.test(
    sub
  );

  if (isGeneric && weightName && weightName !== sub) {
    return `${sub} (${weightName})`;
  }
  return sub || "Style";
}

export const FEATURE_SAMPLES: Record<string, string> = {
  // Ligatures
  liga: "fi fl ffi ffl fb ffb fj ffj",
  dlig: "st ct Th sp ck fb ff",
  hlig: "ct st ſi ſt ſl ſſ",
  calt: "-> <- => != <= ... === ->>",
  clig: "fi fl ffi ffl -> <-",
  rlig: "لا لي لآ لإ",

  // Numbers & Math
  lnum: "0123456789 (Lining: $1,234.56)",
  onum: "0123456789 (Oldstyle: $1,234.56)",
  tnum: "111 222 000 (Tabular: 11.1 vs 88.8)",
  pnum: "111 222 000 (Proportional digits)",
  frac: "1/2 1/4 3/4 7/8 5/16 99/100",
  ordn: "1st 2nd 3rd 4th 1a 2o",
  zero: "0 00 000 100 200 300 0O0O",
  sups: "x1 x2 x3 (x+y)2 1st 2nd",
  subs: "H2O CO2 C6H12O6 x1 x2",
  sinf: "H2O CO2 Fe2O3 a1 b2",
  numr: "1 2 3 4 5 6 7 8 9 0",
  dnom: "1 2 3 4 5 6 7 8 9 0",

  // Stylistic Sets & Character Variants
  ss01: "The quick brown fox jumps over the lazy dog 0123456789 (Il1 0O | a g r t I G 4 6 9 ß &)",
  ss02: "The quick brown fox jumps over the lazy dog 0123456789 (Il1 0O | a g r t I G 4 6 9 ß &)",
  ss03: "The quick brown fox jumps over the lazy dog 0123456789 (Il1 0O | a g r t I G 4 6 9 ß &)",
  ss04: "The quick brown fox jumps over the lazy dog 0123456789 (Il1 0O | a g r t I G 4 6 9 ß &)",
  ss05: "The quick brown fox jumps over the lazy dog 0123456789 (Il1 0O | a g r t I G 4 6 9 ß &)",
  ss06: "The quick brown fox jumps over the lazy dog 0123456789 (Il1 0O | a g r t I G 4 6 9 ß &)",
  ss07: "The quick brown fox jumps over the lazy dog 0123456789 (Il1 0O | a g r t I G 4 6 9 ß &)",
  ss08: "The quick brown fox jumps over the lazy dog 0123456789 (Il1 0O | a g r t I G 4 6 9 ß &)",
  cv01: "The quick brown fox jumps over the lazy dog 0123456789 (Il1 0O | a g r t I G 4 6 9 ß &)",
  cv02: "The quick brown fox jumps over the lazy dog 0123456789 (Il1 0O | a g r t I G 4 6 9 ß &)",
  cv03: "The quick brown fox jumps over the lazy dog 0123456789 (Il1 0O | a g r t I G 4 6 9 ß &)",
  cv04: "The quick brown fox jumps over the lazy dog 0123456789 (Il1 0O | a g r t I G 4 6 9 ß &)",
  cv05: "The quick brown fox jumps over the lazy dog 0123456789 (Il1 0O | a g r t I G 4 6 9 ß &)",
  cv06: "The quick brown fox jumps over the lazy dog 0123456789 (Il1 0O | a g r t I G 4 6 9 ß &)",
  cv07: "The quick brown fox jumps over the lazy dog 0123456789 (Il1 0O | a g r t I G 4 6 9 ß &)",
  cv08: "The quick brown fox jumps over the lazy dog 0123456789 (Il1 0O | a g r t I G 4 6 9 ß &)",
  cv09: "The quick brown fox jumps over the lazy dog 0123456789 (Il1 0O | a g r t I G 4 6 9 ß &)",
  cv10: "The quick brown fox jumps over the lazy dog 0123456789 (Il1 0O | a g r t I G 4 6 9 ß &)",
  cv11: "The quick brown fox jumps over the lazy dog 0123456789 (Il1 0O | a g r t I G 4 6 9 ß &)",
  cv12: "The quick brown fox jumps over the lazy dog 0123456789 (Il1 0O | a g r t I G 4 6 9 ß &)",
  cv13: "The quick brown fox jumps over the lazy dog 0123456789 (Il1 0O | a g r t I G 4 6 9 ß &)",
  cv14: "The quick brown fox jumps over the lazy dog 0123456789 (Il1 0O | a g r t I G 4 6 9 ß &)",

  // Capitals & Small Caps
  smcp: "Small Capitals 123 abc DEF",
  c2sc: "CAPITALS TO SMALL CAPS 123",
  unic: "Unicase Typography Test ABC abc",

  // Technical & Alternates
  aalt: "(( )) [[ ]] {{ }} - - -- -- @ & $",
  case: "((Hello)) [[World]] -- {123} @ # ·",
  swsh: "Queen Typography Vintage Majestic",
  salt: "A B C D E F G a b c d e f g & $",
  titl: "TITLING CAPITALS AND HEADINGS",
  cpsp: "CAPITAL LETTER SPACING TEST",
  kern: "AV AW To Tr Ta Yo Vo Wa We",
};

export function getFeatureSample(tag: string): string {
  if (FEATURE_SAMPLES[tag]) {
    return FEATURE_SAMPLES[tag];
  }
  if (tag.startsWith("cv") || tag.startsWith("ss")) {
    return "The quick brown fox jumps over the lazy dog 0123456789 (Il1 0O | a g r t I G 4 6 9 ß)";
  }
  return "The quick brown fox jumps over the lazy dog 0123456789";
}
