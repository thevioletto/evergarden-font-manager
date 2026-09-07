use once_cell::sync::OnceCell;
use rusqlite::{params, Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

pub static DB: OnceCell<Mutex<Connection>> = OnceCell::new();

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FontData {
    pub file_path: String,
    pub file_hash: String,
    pub family: String,
    pub subfamily: String,
    pub full_name: String,
    pub postscript_name: String,
    pub weight: i64,
    pub width: i64,
    pub italic: i64,
    pub monospace: i64,
    pub category: String,
    pub subcategory: String,
    pub version: String,
    pub copyright: String,
    pub metadata_json: String,
    pub last_seen: i64,
}

pub fn init_database(db_path: &str) -> SqlResult<()> {
    let conn = Connection::open(db_path)?;

    conn.execute_batch(
        "
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
            is_favorite INTEGER DEFAULT 0,
            is_os_installed INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_family ON fonts(family);
        CREATE INDEX IF NOT EXISTS idx_hash ON fonts(file_hash);
        CREATE INDEX IF NOT EXISTS idx_favorite ON fonts(is_favorite);
        ",
    )?;

    // Additive migrations — ignore errors if columns already exist
    let _ = conn.execute_batch("ALTER TABLE fonts ADD COLUMN is_favorite INTEGER DEFAULT 0;");
    let _ = conn.execute_batch("ALTER TABLE fonts ADD COLUMN is_os_installed INTEGER DEFAULT 0;");

    // Normalise last_seen from ms → seconds for any legacy rows
    conn.execute_batch(
        "UPDATE fonts SET last_seen = last_seen / 1000 WHERE last_seen > 4102444800;",
    )?;

    DB.set(Mutex::new(conn))
        .map_err(|_| rusqlite::Error::InvalidQuery)?;

    Ok(())
}

fn with_db<F, T>(f: F) -> Result<T, String>
where
    F: FnOnce(&Connection) -> SqlResult<T>,
{
    let lock = DB.get().ok_or("DB not initialised")?.lock().map_err(|e| e.to_string())?;
    f(&lock).map_err(|e| e.to_string())
}

pub fn save_font(font: &FontData) -> Result<(), String> {
    with_db(|conn| {
        conn.execute(
            "INSERT INTO fonts (
                file_path, file_hash, family, subfamily, full_name, postscript_name,
                weight, width, italic, monospace, category, subcategory, version, copyright,
                metadata_json, last_seen
            ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)
            ON CONFLICT(file_path) DO UPDATE SET
                last_seen = excluded.last_seen,
                file_hash = excluded.file_hash,
                metadata_json = excluded.metadata_json,
                family = excluded.family,
                subfamily = excluded.subfamily,
                full_name = excluded.full_name,
                postscript_name = excluded.postscript_name,
                weight = excluded.weight,
                width = excluded.width,
                italic = excluded.italic,
                monospace = excluded.monospace,
                category = excluded.category,
                subcategory = excluded.subcategory,
                version = excluded.version,
                copyright = excluded.copyright",
            params![
                font.file_path, font.file_hash, font.family, font.subfamily, font.full_name,
                font.postscript_name, font.weight, font.width, font.italic, font.monospace,
                font.category, font.subcategory, font.version, font.copyright,
                font.metadata_json, font.last_seen,
            ],
        )?;
        Ok(())
    })
}

pub fn get_all_fonts() -> Result<Vec<serde_json::Value>, String> {
    with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT
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
                  f2.weight ASC, f2.id
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
            ORDER BY family ASC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "family": row.get::<_, String>(1)?,
                "subfamily": row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                "preview_file_path": row.get::<_, Option<String>>(3)?,
                "file_path": row.get::<_, Option<String>>(4)?.unwrap_or_default(),
                "all_file_paths": row.get::<_, Option<String>>(5)?.unwrap_or_default(),
                "metadata_json": row.get::<_, Option<String>>(6)?.unwrap_or_default(),
                "category": row.get::<_, Option<String>>(7)?.unwrap_or_default(),
                "subcategory": row.get::<_, Option<String>>(8)?.unwrap_or_default(),
                "is_favorite": row.get::<_, i64>(9)?,
                "is_os_installed": row.get::<_, i64>(10)?,
                "variant_count": row.get::<_, i64>(11)?,
                "last_seen": row.get::<_, i64>(12)?,
            }))
        })?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }
        Ok(result)
    })
}

pub fn get_font_variants(family: &str) -> Result<Vec<serde_json::Value>, String> {
    with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT *
            FROM fonts
            WHERE family = ?1
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
              id ASC",
        )?;

        let column_names: Vec<String> = stmt
            .column_names()
            .iter()
            .map(|s| s.to_string())
            .collect();
        let col_count = column_names.len();

        let rows = stmt.query_map(params![family], |row| {
            let mut map = serde_json::Map::new();
            for i in 0..col_count {
                let val: rusqlite::types::Value = row.get(i)?;
                let json_val = match val {
                    rusqlite::types::Value::Null => serde_json::Value::Null,
                    rusqlite::types::Value::Integer(n) => serde_json::Value::Number(n.into()),
                    rusqlite::types::Value::Real(f) => {
                        serde_json::Value::Number(serde_json::Number::from_f64(f).unwrap())
                    }
                    rusqlite::types::Value::Text(s) => serde_json::Value::String(s),
                    rusqlite::types::Value::Blob(b) => {
                        serde_json::Value::String(format!("<blob:{} bytes>", b.len()))
                    }
                };
                map.insert(column_names[i].clone(), json_val);
            }
            Ok(serde_json::Value::Object(map))
        })?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }
        Ok(result)
    })
}

pub fn toggle_favorite(family: &str, is_favorite: bool) -> Result<(), String> {
    with_db(|conn| {
        conn.execute(
            "UPDATE fonts SET is_favorite = ?1 WHERE family = ?2",
            params![if is_favorite { 1i64 } else { 0i64 }, family],
        )?;
        Ok(())
    })
}

pub fn update_font_metadata(file_path: &str, metadata_json: &str) -> Result<(), String> {
    with_db(|conn| {
        conn.execute(
            "UPDATE fonts SET metadata_json = ?1 WHERE file_path = ?2",
            params![metadata_json, file_path],
        )?;
        Ok(())
    })
}

pub fn get_recent_fonts(days: i64) -> Result<Vec<serde_json::Value>, String> {
    let cutoff = chrono_cutoff(days);
    with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT
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
                  f2.weight ASC, f2.id
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
            WHERE last_seen >= ?1
            GROUP BY family
            ORDER BY last_seen DESC",
        )?;

        let rows = stmt.query_map(params![cutoff], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "family": row.get::<_, String>(1)?,
                "subfamily": row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                "preview_file_path": row.get::<_, Option<String>>(3)?,
                "file_path": row.get::<_, Option<String>>(4)?.unwrap_or_default(),
                "metadata_json": row.get::<_, Option<String>>(5)?.unwrap_or_default(),
                "category": row.get::<_, Option<String>>(6)?.unwrap_or_default(),
                "subcategory": row.get::<_, Option<String>>(7)?.unwrap_or_default(),
                "is_favorite": row.get::<_, i64>(8)?,
                "variant_count": row.get::<_, i64>(9)?,
                "last_seen": row.get::<_, i64>(10)?,
            }))
        })?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }
        Ok(result)
    })
}

fn chrono_cutoff(days: i64) -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    now - days * 86400
}

pub fn delete_font_by_path(file_path: &str) -> Result<(), String> {
    with_db(|conn| {
        conn.execute("DELETE FROM fonts WHERE file_path = ?1", params![file_path])?;
        Ok(())
    })
}

pub fn set_os_installed(file_path: &str, installed: bool) -> Result<(), String> {
    with_db(|conn| {
        conn.execute(
            "UPDATE fonts SET is_os_installed = ?1 WHERE file_path = ?2",
            params![if installed { 1i64 } else { 0i64 }, file_path],
        )?;
        Ok(())
    })
}

#[derive(Debug, Clone)]
pub struct FamilyCategoryRow {
    pub family: String,
    pub category: String,
    pub subcategory: String,
}

pub fn get_unique_families_with_category() -> Result<Vec<FamilyCategoryRow>, String> {
    with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT family, MIN(category) as category, MIN(subcategory) as subcategory
            FROM fonts GROUP BY family ORDER BY family ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(FamilyCategoryRow {
                family: row.get(0)?,
                category: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                subcategory: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
            })
        })?;
        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }
        Ok(result)
    })
}

pub fn get_font_variants_for_uninstall(
    family: &str,
) -> Result<Vec<(String, String, String)>, String> {
    // Returns (file_path, family, subfamily)
    with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT file_path, family, subfamily FROM fonts WHERE family = ?1",
        )?;
        let rows = stmt.query_map(params![family], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })?;
        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }
        Ok(result)
    })
}

pub fn get_all_fonts_raw() -> Result<Vec<serde_json::Value>, String> {
    with_db(|conn| {
        let mut stmt = conn.prepare("SELECT * FROM fonts")?;
        let column_names: Vec<String> = stmt
            .column_names()
            .iter()
            .map(|s| s.to_string())
            .collect();
        let col_count = column_names.len();
        let rows = stmt.query_map([], |row| {
            let mut map = serde_json::Map::new();
            for i in 0..col_count {
                let val: rusqlite::types::Value = row.get(i)?;
                let json_val = match val {
                    rusqlite::types::Value::Null => serde_json::Value::Null,
                    rusqlite::types::Value::Integer(n) => serde_json::Value::Number(n.into()),
                    rusqlite::types::Value::Real(f) => {
                        serde_json::Value::Number(serde_json::Number::from_f64(f).unwrap())
                    }
                    rusqlite::types::Value::Text(s) => serde_json::Value::String(s),
                    rusqlite::types::Value::Blob(b) => {
                        serde_json::Value::String(format!("<blob:{}>", b.len()))
                    }
                };
                map.insert(column_names[i].clone(), json_val);
            }
            Ok(serde_json::Value::Object(map))
        })?;
        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }
        Ok(result)
    })
}

pub fn update_font_category(id: i64, category: &str, subcategory: &str) -> Result<(), String> {
    with_db(|conn| {
        conn.execute(
            "UPDATE fonts SET category = ?1, subcategory = ?2 WHERE id = ?3",
            params![category, subcategory, id],
        )?;
        Ok(())
    })
}
