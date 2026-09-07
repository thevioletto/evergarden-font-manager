import fs from "fs";
import path from "path";
import crypto from "crypto";
import os from "os";
import { app } from "electron";
import fontkit from "fontkit";
import { saveFont } from "./database";
import { categorizeFontFamily } from "./categorization";
import { getOnlineCategoryForFamily } from "./online-font-metadata";

const FONT_EXTENSIONS = new Set([".ttf", ".otf", ".woff", ".woff2"]);

/** Directory where drag-dropped fonts are copied; included in scan + watcher. */
export function getImportedFontsDirectory(): string {
  return path.join(app.getPath("userData"), "ImportedFonts");
}

export function getSystemFontDirectories(): string[] {
  const platform = os.platform();
  const dirs: string[] = [];

  if (platform === "win32") {
    const winDir = process.env.SystemRoot || "C:\\Windows";
    dirs.push(path.join(winDir, "Fonts"));
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      dirs.push(path.join(localAppData, "Microsoft", "Windows", "Fonts"));
    }
  } else if (platform === "darwin") {
    dirs.push("/System/Library/Fonts");
    dirs.push("/Library/Fonts");
    const home = os.homedir();
    dirs.push(path.join(home, "Library/Fonts"));
  } else if (platform === "linux") {
    dirs.push("/usr/share/fonts");
    dirs.push(path.join(os.homedir(), ".fonts"));
  }

  dirs.push(getImportedFontsDirectory());
  return dirs;
}

async function getFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("error", (err) => reject(err));
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

interface FontMetadata {
  file_path: string;
  file_hash: string;
  family: string;
  subfamily: string;
  full_name: string;
  postscript_name: string;
  weight: number;
  width: number;
  italic: number;
  monospace: number;
  category: string;
  subcategory: string;
  version: string;
  copyright: string;
  metadata_json: string;
  last_seen: number;
}

// Extract OpenType features from font
function extractOpenTypeFeatures(font: any): string[] {
  const features: Set<string> = new Set();

  try {
    // 1. Check font.availableFeatures (fontkit getter)
    if (font.availableFeatures) {
      font.availableFeatures.forEach((feature: string) =>
        features.add(feature.trim())
      );
    }

    // 2. Fallback: Parse GSUB if not already found
    if (font.GSUB && font.GSUB.featureList) {
      font.GSUB.featureList.forEach((feature: any) => {
        if (feature.tag) features.add(feature.tag.trim());
      });
    }

    // 3. Fallback: Parse GPOS
    if (font.GPOS && font.GPOS.featureList) {
      font.GPOS.featureList.forEach((feature: any) => {
        if (feature.tag) features.add(feature.tag.trim());
      });
    }
  } catch (e) {
    console.error("Error extracting OpenType features:", e);
  }

  return Array.from(features).filter((f) => f && f.length > 0);
}

// Exported for Watcher
export async function processFontFile(
  filePath: string
): Promise<FontMetadata | null> {
  const ext = path.extname(filePath).toLowerCase();
  if (!FONT_EXTENSIONS.has(ext)) {
    return null;
  }

  try {
    const hash = await getFileHash(filePath);
    const font = fontkit.openSync(filePath);
    let fontObj: any = font;
    if ("fonts" in font) {
      fontObj = font.fonts[0];
    }

    const isMonospace = fontObj.post?.isFixedPitch || 0;

    const cleanStr = (s: any) =>
      typeof s === "string" ? s.replace(/\0/g, "").trim() : "";

    let familyName = cleanStr(fontObj.preferredFamily || fontObj.familyName);
    const subfamilyName = cleanStr(
      fontObj.preferredSubfamily || fontObj.subfamilyName
    );

    // Heuristic 1: If familyName ends with the subfamilyName, strip it.
    // Handles fonts that don't use Name ID 16 and embed weight into Name ID 1.
    // e.g. family="Arial Bold" + subfamily="Bold" → family="Arial"
    if (
      subfamilyName &&
      familyName.toLowerCase().endsWith(" " + subfamilyName.toLowerCase())
    ) {
      familyName = familyName.slice(0, -subfamilyName.length - 1).trim();
    }

    // Heuristic 2: Strip ONLY license/commercial qualifiers — NOT design descriptors.
    // 'Condensed', 'Nord', 'Extended' etc. ARE meaningful family identifiers and
    // must NOT be stripped (they're different typefaces, not just styles).
    const LICENSE_SUFFIXES = [
      "Unlicensed Trial",
      "Personal Use Only",
      "Personal Use",
      "Unlicensed",
      "Trial",
      "Demo",
      "Free",
    ];
    // Sort longest-first so we match the most specific form first
    LICENSE_SUFFIXES.sort((a, b) => b.length - a.length);

    let stripped = true;
    while (stripped) {
      stripped = false;
      for (const suffix of LICENSE_SUFFIXES) {
        // Match suffix optionally preceded by a dash/hyphen separator
        const regex = new RegExp(`[\\s\\-–—]*${suffix}\\s*$`, "i");
        if (regex.test(familyName)) {
          familyName = familyName.replace(regex, "").trim();
          stripped = true;
          break;
        }
      }
    }

    // Prefer online metadata (Google Fonts) when available; fall back to local heuristic
    let category: string;
    let subcategory: string;
    const online = await getOnlineCategoryForFamily(familyName);
    if (online) {
      category = online.category;
      subcategory = online.subcategory;
    } else {
      const heuristic = categorizeFontFamily(
        familyName,
        subfamilyName,
        isMonospace
      );
      category = heuristic.category;
      subcategory = heuristic.subcategory;
    }

    // Read OS/2 weight (100–900) when available
    const os2 = fontObj["OS/2"] ?? fontObj.os2;
    const weight = os2?.usWeightClass != null ? Number(os2.usWeightClass) : 400;

    const metadata: FontMetadata = {
      file_path: filePath,
      file_hash: hash,
      family: familyName,
      subfamily: subfamilyName,
      full_name: (fontObj.fullName || "").trim(),
      postscript_name: fontObj.postscriptName,
      weight: Math.min(900, Math.max(1, weight)) || 400,
      width: 5,
      italic: fontObj.italicAngle !== 0 ? 1 : 0,
      monospace: isMonospace,
      category,
      subcategory,
      version: fontObj.version ? fontObj.version.toString() : "",
      copyright: fontObj.copyright,
      metadata_json: JSON.stringify({
        upm: fontObj.unitsPerEm,
        glyphs: fontObj.numGlyphs,
        features: extractOpenTypeFeatures(fontObj),
        characterSet: fontObj.characterSet,
      }),
      // Store as Unix seconds (consistent with getRecentFonts cutoff)
      last_seen: Math.floor(Date.now() / 1000),
    };

    saveFont(metadata);
    return metadata;
  } catch (e: any) {
    if (e.message === "Unknown font format") {
      console.warn(`[scanner] skipped unsupported format: ${filePath}`);
    } else {
      console.error(`[scanner] FAILED to process: ${filePath}`, e);
    }
    return null;
  }
}

export async function scanFonts(
  onProgress?: (count: number) => void
): Promise<FontMetadata[]> {
  const dirs = getSystemFontDirectories();
  const foundFonts: FontMetadata[] = [];

  const scanDir = async (directory: string) => {
    try {
      if (!fs.existsSync(directory)) return;

      const entries = await fs.promises.readdir(directory, {
        withFileTypes: true,
      });
      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.isFile()) {
          const res = await processFontFile(fullPath);
          if (res) {
            foundFonts.push(res);
            // Send progress update
            if (onProgress) {
              onProgress(foundFonts.length);
            }
          }
        }
      }
    } catch (e) {
      console.error(`Error scanning ${directory}`, e);
    }
  };

  await Promise.all(dirs.map((dir) => scanDir(dir)));
  return foundFonts;
}
