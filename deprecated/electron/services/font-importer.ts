/**
 * Dynamic font import:
 *  1. Copy dropped files to ImportedFonts (app-private staging dir)
 *     — if the exact same file already exists (same bytes), reuse it.
 *  2. Extract metadata via fontkit (same pipeline as scan)
 *  3. Install to the OS per-user fonts dir + register in the registry
 *     so the font is available in all applications immediately.
 */

import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { getImportedFontsDirectory, processFontFile } from "./font-scanner";
import { installFontToOS } from "./font-installer";
import { setOsInstalled } from "./database";
import { markImporting, unmarkImporting } from "./watcher";

const FONT_EXTENSIONS = new Set([".ttf", ".otf", ".woff", ".woff2"]);

function isFontFile(filePath: string): boolean {
  return FONT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function fileHash(filePath: string): string {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

/**
 * Copy source to ImportedFonts.
 * - If a file with the same name AND same content already exists → reuse it (no copy).
 * - If same name but different content → append a counter suffix.
 */
function copyToImportedDir(sourcePath: string): string {
  const dir = getImportedFontsDirectory();
  ensureDir(dir);
  const base = path.basename(sourcePath);
  const destPath = path.join(dir, base);

  if (fs.existsSync(destPath)) {
    // Same file already staged — reuse without copying
    if (fileHash(sourcePath) === fileHash(destPath)) {
      console.log(`[importer] reusing existing staged file: ${destPath}`);
      return destPath;
    }
    // Different file with same name — find a free numbered name
    const ext = path.extname(base);
    const stem = path.basename(base, ext);
    let n = 1;
    let numbered = path.join(dir, `${stem}-${n}${ext}`);
    while (fs.existsSync(numbered)) {
      n += 1;
      numbered = path.join(dir, `${stem}-${n}${ext}`);
    }
    fs.copyFileSync(sourcePath, numbered);
    return numbered;
  }

  fs.copyFileSync(sourcePath, destPath);
  return destPath;
}

export interface ImportResult {
  imported: number;
  failed: number;
  errors: string[];
}

export async function importFontFiles(
  sourcePaths: string[],
  onProgress?: (processed: number) => void
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, failed: 0, errors: [] };
  const paths = sourcePaths.filter(isFontFile);

  console.log(
    `[importer] total: ${sourcePaths.length}, valid: ${paths.length}`
  );

  for (let i = 0; i < paths.length; i++) {
    const src = paths[i];
    console.log(`[importer] [${i + 1}/${paths.length}] ${src}`);
    try {
      const stagedPath = copyToImportedDir(src);
      console.log(`[importer] staged: ${stagedPath}`);

      // Suppress watcher for the staged file
      markImporting(stagedPath);
      let meta;
      try {
        meta = await processFontFile(stagedPath);
      } finally {
        // Keep suppressed for 3s — awaitWriteFinish delay on watcher
        setTimeout(() => unmarkImporting(stagedPath), 3000);
      }

      if (!meta) {
        result.failed += 1;
        result.errors.push(`${path.basename(src)}: could not parse font`);
        onProgress?.(i + 1);
        continue;
      }

      // Install to OS (Windows per-user fonts dir + registry)
      if (os.platform() === "win32") {
        console.log(
          `[importer] installing to OS: ${meta.family} ${meta.subfamily}`
        );
        try {
          const installedPath = await installFontToOS(
            stagedPath,
            meta.family,
            meta.subfamily
          );
          console.log(`[importer] OS installed: ${installedPath}`);
          markImporting(installedPath);
          setOsInstalled(stagedPath, true);
          setTimeout(() => unmarkImporting(installedPath), 3000);
        } catch (e: any) {
          console.warn(
            `[importer] OS install failed (non-fatal): ${e?.message}`
          );
        }
      }

      result.imported += 1;
      console.log(`[importer] ✓ ${meta.family}`);
    } catch (e: any) {
      console.error(`[importer] ✗ ${src}:`, e);
      result.failed += 1;
      result.errors.push(`${path.basename(src)}: ${e?.message || String(e)}`);
    }
    onProgress?.(i + 1);
  }

  console.log(
    `[importer] done. imported=${result.imported} failed=${result.failed}`
  );
  return result;
}
