import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";

const dbPath = path.join(app.getPath("userData"), "fonts.db");
const db = new Database(dbPath);

// Initialize database
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fonts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT UNIQUE,
        file_hash TEXT,
        family TEXT,
        subfamily TEXT,
        full_name TEXT,
        postscript_name TEXT,
        weight INTEGER,
        width INTEGER,
        italic INTEGER,
        monospace INTEGER,
        category TEXT,
        subcategory TEXT,
        version TEXT,
        copyright TEXT,
        metadata_json TEXT,
        last_seen INTEGER,
        is_favorite INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_family ON fonts(family);
    CREATE INDEX IF NOT EXISTS idx_hash ON fonts(file_hash);
    CREATE INDEX IF NOT EXISTS idx_favorite ON fonts(is_favorite);
  `);

  // Add is_favorite column if it doesn't exist (for existing databases)
  try {
    db.exec(`ALTER TABLE fonts ADD COLUMN is_favorite INTEGER DEFAULT 0;`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Add index for is_favorite if it doesn't exist
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_favorite ON fonts(is_favorite);`);
  } catch (e) {
    // Index already exists, ignore
  }

  // Track whether the font has been installed to the OS fonts directory
  try {
    db.exec(`ALTER TABLE fonts ADD COLUMN is_os_installed INTEGER DEFAULT 0;`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Normalize last_seen from milliseconds to seconds for any existing rows
  // that were stored with Date.now() (ms). Values > 4102444800 are ms.
  db.exec(`
    UPDATE fonts
    SET last_seen = last_seen / 1000
    WHERE last_seen > 4102444800;
  `);
}

interface FontData {
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

export function saveFont(fontData: FontData) {
  try {
    const stmt = db.prepare(`
      INSERT INTO fonts (
          file_path, file_hash, family, subfamily, full_name, postscript_name,
          weight, width, italic, monospace, category, subcategory, version, copyright, metadata_json, last_seen
      ) VALUES (
          @file_path, @file_hash, @family, @subfamily, @full_name, @postscript_name,
          @weight, @width, @italic, @monospace, @category, @subcategory, @version, @copyright, @metadata_json, @last_seen
      )
      ON CONFLICT(file_path) DO UPDATE SET
          last_seen = @last_seen,
          file_hash = @file_hash,
          metadata_json = @metadata_json,
          family = @family,
          subfamily = @subfamily,
          full_name = @full_name,
          postscript_name = @postscript_name,
          weight = @weight,
          width = @width,
          italic = @italic,
          monospace = @monospace,
          category = @category,
          subcategory = @subcategory,
          version = @version,
          copyright = @copyright
    `);
    stmt.run(fontData);
  } catch (e: any) {
    console.error(
      `[db] saveFont FAILED — family="${fontData.family}" path="${fontData.file_path}"`,
      e
    );
    throw e;
  }
}

export function getAllFonts() {
  // Group fonts by family; prefer Regular/Normal for card preview (preview_file_path)
  return db
    .prepare(
      `
    SELECT
      MIN(id) as id,
      family,
      GROUP_CONCAT(subfamily, ', ') as subfamily,
      (
        SELECT file_path FROM fonts f2
        WHERE f2.family = fonts.family
        ORDER BY
          CASE WHEN lower(f2.subfamily) = 'regular' THEN 0
               WHEN f2.subfamily LIKE '%Regular%' THEN 1
               WHEN f2.subfamily LIKE '%Normal%'  THEN 2
               WHEN f2.subfamily LIKE '%Roman%'   THEN 3
               WHEN f2.subfamily LIKE '%Book%'    THEN 4
               ELSE 5 END,
          CASE WHEN f2.subfamily LIKE '%Italic%' THEN 1 ELSE 0 END,
          f2.weight ASC,
          f2.id
        LIMIT 1
      ) as preview_file_path,
      MIN(file_path) as file_path,
      GROUP_CONCAT(DISTINCT file_path) as all_file_paths,
      MIN(metadata_json) as metadata_json,
      MIN(category) as category,
      MIN(subcategory) as subcategory,
      MAX(is_favorite) as is_favorite,
      MAX(is_os_installed) as is_os_installed,
      COUNT(*) as variant_count,
      MAX(last_seen) as last_seen
    FROM fonts
    GROUP BY family
    ORDER BY family ASC
  `
    )
    .all();
}

export function getFontByPath(filePath: string) {
  return db.prepare("SELECT * FROM fonts WHERE file_path = ?").get(filePath);
}

export function toggleFavorite(family: string, isFavorite: boolean) {
  // Update all variants of the font family
  const stmt = db.prepare(`
    UPDATE fonts
    SET is_favorite = ?
    WHERE family = ?
  `);
  stmt.run(isFavorite ? 1 : 0, family);
}

export function getFavorites() {
  return db
    .prepare(
      `
    SELECT
      MIN(id) as id,
      family,
      GROUP_CONCAT(subfamily, ', ') as subfamily,
      (
        SELECT file_path FROM fonts f2
        WHERE f2.family = fonts.family
        ORDER BY
          CASE WHEN lower(f2.subfamily) = 'regular' THEN 0
               WHEN f2.subfamily LIKE '%Regular%' THEN 1
               WHEN f2.subfamily LIKE '%Normal%'  THEN 2
               WHEN f2.subfamily LIKE '%Roman%'   THEN 3
               WHEN f2.subfamily LIKE '%Book%'    THEN 4
               ELSE 5 END,
          CASE WHEN f2.subfamily LIKE '%Italic%' THEN 1 ELSE 0 END,
          f2.weight ASC,
          f2.id
        LIMIT 1
      ) as preview_file_path,
      MIN(file_path) as file_path,
      MIN(metadata_json) as metadata_json,
      MIN(category) as category,
      MIN(subcategory) as subcategory,
      COUNT(*) as variant_count,
      MAX(last_seen) as last_seen
    FROM fonts
    WHERE is_favorite = 1
    GROUP BY family
    ORDER BY family ASC
  `
    )
    .all();
}

export function setOsInstalled(filePath: string, installed: boolean) {
  db.prepare("UPDATE fonts SET is_os_installed = ? WHERE file_path = ?").run(
    installed ? 1 : 0,
    filePath
  );
}

export function deleteFontByPath(filePath: string) {
  db.prepare("DELETE FROM fonts WHERE file_path = ?").run(filePath);
}

export function deleteFontsByFamily(family: string) {
  db.prepare("DELETE FROM fonts WHERE family = ?").run(family);
}

/** Returns all file_paths for a given font family. */
export function getFontFilePathsByFamily(family: string): string[] {
  const rows = db
    .prepare("SELECT file_path FROM fonts WHERE family = ?")
    .all(family) as { file_path: string }[];
  return rows.map((r) => r.file_path);
}

/** One row per family with current category/subcategory for bridge generation. */
export function getUniqueFamiliesWithCategory(): {
  family: string;
  category: string;
  subcategory: string;
}[] {
  return db
    .prepare(
      `
    SELECT family, MIN(category) as category, MIN(subcategory) as subcategory
    FROM fonts
    GROUP BY family
    ORDER BY family ASC
  `
    )
    .all() as { family: string; category: string; subcategory: string }[];
}

export function getFontVariants(family: string) {
  return db
    .prepare(
      `
    SELECT *
    FROM fonts
    WHERE family = ?
    ORDER BY
      COALESCE(NULLIF(weight, 0),
        CASE
          WHEN subfamily LIKE '%Thin%' AND subfamily NOT LIKE '%Bold%' THEN 100
          WHEN subfamily LIKE '%Extra Light%' OR subfamily LIKE '%ExtraLight%' THEN 200
          WHEN subfamily LIKE '%Light%' AND subfamily NOT LIKE '%Bold%' THEN 300
          WHEN subfamily LIKE '%Regular%' OR subfamily LIKE '%Normal%' OR subfamily LIKE '%Roman%' OR subfamily LIKE '%Book%' THEN 400
          WHEN subfamily LIKE '%Medium%' THEN 500
          WHEN subfamily LIKE '%Semi%Bold%' OR subfamily LIKE '%Demi%Bold%' OR subfamily LIKE '%Semibold%' THEN 600
          WHEN subfamily LIKE '%Bold%' THEN 700
          WHEN subfamily LIKE '%Extra Bold%' OR subfamily LIKE '%ExtraBold%' THEN 800
          WHEN subfamily LIKE '%Black%' OR subfamily LIKE '%Heavy%' THEN 900
          ELSE 400
        END
      ) ASC,
      italic ASC,
      id ASC
  `
    )
    .all(family);
}

/** Fonts seen/added in the last 30 days, ordered newest first. */
export function getRecentFonts(days = 30) {
  // cutoff in Unix seconds (last_seen is stored as seconds after the migration)
  const cutoff = Math.floor(Date.now() / 1000) - days * 86400;
  return db
    .prepare(
      `
    SELECT
      MIN(id) as id,
      family,
      GROUP_CONCAT(subfamily, ', ') as subfamily,
      (
        SELECT file_path FROM fonts f2
        WHERE f2.family = fonts.family
        ORDER BY
          CASE WHEN lower(f2.subfamily) = 'regular' THEN 0
               WHEN f2.subfamily LIKE '%Regular%' THEN 1
               WHEN f2.subfamily LIKE '%Normal%'  THEN 2
               WHEN f2.subfamily LIKE '%Roman%'   THEN 3
               WHEN f2.subfamily LIKE '%Book%'    THEN 4
               ELSE 5 END,
          CASE WHEN f2.subfamily LIKE '%Italic%' THEN 1 ELSE 0 END,
          f2.weight ASC,
          f2.id
        LIMIT 1
      ) as preview_file_path,
      MIN(file_path) as file_path,
      MIN(metadata_json) as metadata_json,
      MIN(category) as category,
      MIN(subcategory) as subcategory,
      MAX(is_favorite) as is_favorite,
      COUNT(*) as variant_count,
      MAX(last_seen) as last_seen
    FROM fonts
    WHERE last_seen >= ?
    GROUP BY family
    ORDER BY last_seen DESC
  `
    )
    .all(cutoff);
}
