/// File system watcher: watches system font dirs and ImportedFonts for changes.
/// Port of watcher.ts — uses the `notify` crate instead of chokidar.

use crate::font_scanner::{get_system_font_directories, process_font_file};
use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use once_cell::sync::Lazy;
use std::collections::HashSet;
use std::sync::Mutex;

/// Paths currently being imported — watcher skips these to avoid duplicate processing.
pub static IMPORTING_PATHS: Lazy<Mutex<HashSet<String>>> =
    Lazy::new(|| Mutex::new(HashSet::new()));

pub fn start_watcher(user_data: String) -> Option<RecommendedWatcher> {
    let ud = user_data.clone();

    let mut watcher =
        RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                let Ok(event) = res else { return };
                match event.kind {
                    EventKind::Create(_) | EventKind::Modify(_) => {
                        for path in &event.paths {
                            let key = path.to_string_lossy().to_string();
                            {
                                let lock = IMPORTING_PATHS.lock().unwrap();
                                if lock.contains(&key) {
                                    continue;
                                }
                            }
                            process_font_file(path, &ud);
                        }
                    }
                    EventKind::Remove(_) => {
                        // Removal handled on-demand by uninstall command
                    }
                    _ => {}
                }
            },
            Config::default()
                .with_poll_interval(std::time::Duration::from_millis(500)),
        )
        .ok()?;

    let dirs = get_system_font_directories(&user_data);
    for dir in &dirs {
        if dir.exists() {
            let _ = watcher.watch(dir, RecursiveMode::Recursive);
        }
    }

    Some(watcher)
}
