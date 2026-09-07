import chokidar from "chokidar";
import { processFontFile, getSystemFontDirectories } from "./font-scanner";

// Paths currently being processed by the importer — watcher skips these
// to avoid a race where both the importer and watcher process the same file.
const _importingPaths = new Set<string>();

export function markImporting(filePath: string) {
  _importingPaths.add(filePath);
}
export function unmarkImporting(filePath: string) {
  _importingPaths.delete(filePath);
}

export function startWatcher() {
  const dirs = getSystemFontDirectories();

  const watcher = chokidar.watch(dirs, {
    ignored: /(^|[/\\])\../,
    persistent: true,
    ignoreInitial: true,
    depth: 2,
    // Wait for the file write to finish before firing
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
  });

  watcher
    .on("add", async (filePath) => {
      if (_importingPaths.has(filePath)) return;
      console.log(`Watcher: File added: ${filePath}`);
      await processFontFile(filePath);
    })
    .on("change", async (filePath) => {
      if (_importingPaths.has(filePath)) return;
      console.log(`Watcher: File changed: ${filePath}`);
      await processFontFile(filePath);
    })
    .on("unlink", (filePath) => {
      console.log(`Watcher: File removed: ${filePath}`);
    });

  return watcher;
}
