import fs from "fs";
import path from "path";
import { app } from "electron";
import { getUniqueFamiliesWithCategory } from "./database";

export interface FontMetadataEntry {
  category: string;
  subcategory: string;
  tags: string[];
}

export type FontMetadataBridge = Record<string, FontMetadataEntry>;

let bridge: FontMetadataBridge = {};

function getBridgePath(): string {
  return path.join(app.getPath("userData"), "font-metadata-bridge.json");
}

function normalizeKey(family: string): string {
  return family.toLowerCase().trim().replace(/\s+/g, " ");
}

function tagsFromEntry(
  family: string,
  category: string,
  subcategory: string
): string[] {
  const tags = new Set<string>();
  const f = family.toLowerCase();
  tags.add(category.toLowerCase().replace(/\s+/g, "-"));
  tags.add(subcategory.toLowerCase().replace(/\s+/g, "-"));
  if (f.includes("mono") || f.includes("code") || subcategory === "Code")
    tags.add("monospace");
  if (f.includes("script") || f.includes("cursive")) tags.add("script");
  if (
    [
      "arial",
      "helvetica",
      "verdana",
      "tahoma",
      "georgia",
      "times new roman",
    ].some((s) => f.includes(s))
  )
    tags.add("web-safe");
  if (
    ["segoe ui", "sf pro", "san francisco", "roboto", "ubuntu"].some((s) =>
      f.includes(s)
    )
  )
    tags.add("system-ui");
  return Array.from(tags);
}

/**
 * Load the bridge from disk into memory. Call at app startup.
 */
export function loadBridge(): FontMetadataBridge {
  const filePath = getBridgePath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      bridge = JSON.parse(raw) as FontMetadataBridge;
    } else {
      bridge = {};
    }
  } catch (e) {
    console.warn("Could not load font-metadata-bridge.json", e);
    bridge = {};
  }
  return bridge;
}

/**
 * Look up metadata by family name. Returns null if not in bridge (caller should use heuristic).
 */
export function getMetadata(family: string): FontMetadataEntry | null {
  const key = normalizeKey(family);
  return bridge[key] ?? null;
}

/**
 * Generate the bridge from current database: one entry per font family in the DB,
 * with category, subcategory, and derived tags. Writes to userData and reloads.
 */
export function generateBridgeFromDatabase(): void {
  const rows = getUniqueFamiliesWithCategory();
  const next: FontMetadataBridge = {};

  for (const row of rows) {
    const key = normalizeKey(row.family);
    next[key] = {
      category: row.category || "Basic",
      subcategory: row.subcategory || "Various",
      tags: tagsFromEntry(
        row.family,
        row.category || "Basic",
        row.subcategory || "Various"
      ),
    };
  }

  const filePath = getBridgePath();
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2), "utf-8");
  bridge = next;
}
