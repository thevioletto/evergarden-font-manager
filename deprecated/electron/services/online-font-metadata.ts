/**
 * Online font metadata: try multiple providers (Google Fonts, then Fontsource)
 * to resolve category/subcategory by family name. Falls back to local heuristic
 * when offline or when the font is not in any list.
 */

import fs from "fs";
import path from "path";
import { app } from "electron";

const GOOGLE_FONTS_METADATA_URL = "https://fonts.google.com/metadata/fonts";
const FONTSOURCE_FONTLIST_BASE = "https://api.fontsource.org/fontlist";
const CACHE_FILENAME = "online-font-metadata-cache.json";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface GoogleFontEntry {
  family: string;
  category?: string;
}

interface GoogleFontsMetadata {
  familyMetadataList?: GoogleFontEntry[];
}

/** Map provider category (Google or Fontsource) to our taxonomy. */
function mapProviderCategoryToOurs(providerCategory: string): {
  category: string;
  subcategory: string;
} {
  const c = (providerCategory || "").trim().toLowerCase().replace(/-/g, " ");
  switch (c) {
    case "serif":
      return { category: "Basic", subcategory: "Serif" };
    case "sans serif":
      return { category: "Basic", subcategory: "Sans serif" };
    case "monospace":
      return { category: "Basic", subcategory: "Fixed width" };
    case "handwriting":
    case "script":
      return { category: "Script", subcategory: "Handwritten" };
    case "display":
      return { category: "Fancy", subcategory: "Decorative" };
    case "icons":
    case "other":
    default:
      return { category: "Fancy", subcategory: "Decorative" };
  }
}

let memoryCache: Map<string, { category: string; subcategory: string }> | null =
  null;
let cacheFetchedAt = 0;

function getCachePath(): string {
  return path.join(app.getPath("userData"), CACHE_FILENAME);
}

/** Fetch Google Fonts metadata and return family key -> our category map. */
async function fetchGoogleFontsMap(): Promise<
  Map<string, { category: string; subcategory: string }>
> {
  const map = new Map<string, { category: string; subcategory: string }>();
  try {
    const res = await fetch(GOOGLE_FONTS_METADATA_URL, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as GoogleFontsMetadata;
    const list = json.familyMetadataList ?? [];
    for (const entry of list) {
      const family = (entry.family || "").trim();
      if (!family) continue;
      const key = family.toLowerCase().replace(/\s+/g, " ");
      const cat = (entry.category || "Display").trim();
      map.set(key, mapProviderCategoryToOurs(cat));
    }
  } catch (e) {
    console.warn("Online font metadata: Google Fonts fetch failed", e);
  }
  return map;
}

/** Fontsource category filter values (they return id -> category for that filter). */
const FONTSOURCE_CATEGORIES = [
  "serif",
  "sans-serif",
  "display",
  "handwriting",
  "monospace",
  "other",
  "icons",
] as const;

/** Fetch Fontsource fontlist by category and merge into map. Keys are Fontsource ids (lowercase-hyphen). */
async function fetchFontsourceMap(): Promise<
  Map<string, { category: string; subcategory: string }>
> {
  const map = new Map<string, { category: string; subcategory: string }>();
  for (const category of FONTSOURCE_CATEGORIES) {
    try {
      const url = `${FONTSOURCE_FONTLIST_BASE}?category=${encodeURIComponent(category)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const data = (await res.json()) as Record<string, string>;
      for (const [id, cat] of Object.entries(data)) {
        if (id && cat) map.set(id, mapProviderCategoryToOurs(cat));
      }
    } catch (e) {
      console.warn(
        `Online font metadata: Fontsource category ${category} fetch failed`,
        e
      );
    }
  }
  return map;
}

/**
 * Load the merged metadata map (Google + Fontsource), from cache or network.
 */
async function loadMetadataMap(): Promise<
  Map<string, { category: string; subcategory: string }>
> {
  if (memoryCache && Date.now() - cacheFetchedAt < CACHE_TTL_MS) {
    return memoryCache;
  }

  const cachePath = getCachePath();
  const now = Date.now();

  try {
    if (fs.existsSync(cachePath)) {
      const raw = fs.readFileSync(cachePath, "utf-8");
      const data = JSON.parse(raw) as {
        fetchedAt: number;
        familyToMeta: Record<string, { category: string; subcategory: string }>;
      };
      if (now - data.fetchedAt < CACHE_TTL_MS && data.familyToMeta) {
        memoryCache = new Map(Object.entries(data.familyToMeta));
        cacheFetchedAt = data.fetchedAt;
        return memoryCache;
      }
    }
  } catch (e) {
    console.warn("Online font metadata: could not read cache", e);
  }

  const [googleMap, fontsourceMap] = await Promise.all([
    fetchGoogleFontsMap(),
    fetchFontsourceMap(),
  ]);

  const merged = new Map(googleMap);
  for (const [id, meta] of fontsourceMap) {
    if (!merged.has(id)) merged.set(id, meta);
  }

  memoryCache = merged;
  cacheFetchedAt = now;

  try {
    fs.writeFileSync(
      cachePath,
      JSON.stringify(
        { fetchedAt: now, familyToMeta: Object.fromEntries(merged) },
        null,
        2
      ),
      "utf-8"
    );
  } catch (e) {
    console.warn("Online font metadata: could not write cache", e);
  }

  return merged;
}

/**
 * Get category/subcategory for a font family from online metadata.
 * Tries Google Fonts first (family name with spaces), then Fontsource (family name as id: lowercase-hyphen).
 * Returns null if not found or offline; caller should use heuristic fallback.
 */
export async function getOnlineCategoryForFamily(
  familyName: string
): Promise<{ category: string; subcategory: string } | null> {
  const trimmed = familyName.trim();
  if (!trimmed) return null;

  const map = await loadMetadataMap();

  const keySpaces = trimmed.toLowerCase().replace(/\s+/g, " ");
  const hit = map.get(keySpaces);
  if (hit) return hit;

  const keyHyphens = trimmed.toLowerCase().replace(/\s+/g, "-");
  return map.get(keyHyphens) ?? null;
}

export function preloadOnlineMetadata(): void {
  loadMetadataMap().catch((e) =>
    console.warn("Online font metadata preload failed", e)
  );
}
