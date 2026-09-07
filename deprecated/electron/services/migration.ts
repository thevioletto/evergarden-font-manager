import path from "path";
import { app } from "electron";
import Database from "better-sqlite3";
import { categorizeFontFamily } from "./categorization";

/**
 * Migrates existing fonts in the database to use the current category taxonomy
 * (Fancy, Foreign look, Techno, Gothic, Basic, Script). Re-categorizes all
 * fonts so existing data matches the new sidebar categories.
 */
export async function migrateFontsWithCategories() {
  console.log("Starting category migration...");

  const db = new Database(path.join(app.getPath("userData"), "fonts.db"));

  const allFonts: any[] = db.prepare("SELECT * FROM fonts").all();
  const updateStmt = db.prepare(
    "UPDATE fonts SET category = ?, subcategory = ? WHERE id = ?"
  );

  let updated = 0;
  for (const font of allFonts) {
    const { category, subcategory } = categorizeFontFamily(
      font.family,
      font.subfamily,
      font.monospace ?? 0
    );

    updateStmt.run(category, subcategory, font.id);
    updated++;
  }

  console.log(`Category migration complete: ${updated} fonts updated`);
  db.close();
  return updated;
}
