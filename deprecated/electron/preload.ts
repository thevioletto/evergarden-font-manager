import { contextBridge, ipcRenderer, webUtils } from "electron";

// Callbacks registered by the renderer via contextBridge
let _onDropPaths: ((paths: string[]) => void) | null = null;
let _onImportProgress: ((processed: number) => void) | null = null;
let _onImportDone:
  | ((
      result: { imported: number; failed: number; errors: string[] },
      fonts: any[]
    ) => void)
  | null = null;

// Preload window listeners have full access to File.path (contextIsolation
// does NOT strip it here). We read paths and call back into the renderer
// via the registered callbacks exposed through contextBridge.
window.addEventListener(
  "drop",
  (e) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer?.files;
    if (!files?.length) return;

    const paths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const filePath = webUtils.getPathForFile(files[i]);
      if (filePath) paths.push(filePath);
    }

    if (paths.length === 0) return;

    // Tell renderer a drop with valid paths started
    _onDropPaths?.(paths);

    // Listen for progress from main
    ipcRenderer.removeAllListeners("import-progress");
    ipcRenderer.on("import-progress", (_ev, processed: number) => {
      _onImportProgress?.(processed);
    });

    ipcRenderer
      .invoke("import-dropped-fonts", paths)
      .then((result) => {
        console.log("[preload:drop] import result:", result);
        return ipcRenderer
          .invoke("get-fonts")
          .then((fonts) => ({ result, fonts }));
      })
      .then(({ result, fonts }) => {
        console.log("[preload:drop] fonts fetched, count:", fonts?.length);
        ipcRenderer.removeAllListeners("import-progress");
        _onImportDone?.(result, fonts);
      })
      .catch((err) => {
        console.error("[preload:drop] IPC error:", err);
        ipcRenderer.removeAllListeners("import-progress");
        _onImportDone?.(
          { imported: 0, failed: 1, errors: [err?.message || String(err)] },
          []
        );
      });
  },
  true
);

window.addEventListener(
  "dragover",
  (e) => {
    e.preventDefault();
  },
  true
);

contextBridge.exposeInMainWorld("api", {
  // Drop import — renderer registers these callbacks once on mount
  onDropPaths: (cb: (paths: string[]) => void) => {
    _onDropPaths = cb;
  },
  onImportProgress: (cb: (processed: number) => void) => {
    _onImportProgress = cb;
  },
  onImportDone: (
    cb: (
      result: { imported: number; failed: number; errors: string[] },
      fonts: any[]
    ) => void
  ) => {
    _onImportDone = cb;
  },

  scanFonts: () => ipcRenderer.invoke("scan-fonts"),
  getFonts: () => ipcRenderer.invoke("get-fonts"),
  toggleFavorite: (family: string, isFavorite: boolean) =>
    ipcRenderer.invoke("toggle-favorite", family, isFavorite),
  getFontVariants: (family: string) =>
    ipcRenderer.invoke("get-font-variants", family),
  revealInFolder: (filePath: string) =>
    ipcRenderer.invoke("reveal-in-folder", filePath),
  getRecentFonts: () => ipcRenderer.invoke("get-recent-fonts"),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  importDroppedFonts: (paths: string[]) =>
    ipcRenderer.invoke("import-dropped-fonts", paths),
  onScanProgress: (callback: (count: number) => void) => {
    ipcRenderer.on("scan-progress", (_event, count) => callback(count));
  },
  removeScanProgressListener: () => {
    ipcRenderer.removeAllListeners("scan-progress");
  },
  removeImportProgressListener: () => {
    ipcRenderer.removeAllListeners("import-progress");
  },
  uninstallFont: (family: string) =>
    ipcRenderer.invoke("uninstall-font", family),
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});
