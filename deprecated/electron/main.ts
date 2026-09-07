import { app, BrowserWindow, ipcMain, shell, protocol } from "electron";
import path from "path";
import {
  initDatabase,
  getAllFonts,
  toggleFavorite,
  getFontVariants,
  getRecentFonts,
  deleteFontByPath,
} from "./services/database";
import { scanFonts } from "./services/font-scanner";
import { startWatcher } from "./services/watcher";
import { migrateFontsWithCategories } from "./services/migration";
import {
  loadBridge,
  generateBridgeFromDatabase,
} from "./services/font-metadata-bridge";
import { preloadOnlineMetadata } from "./services/online-font-metadata";
import { importFontFiles, type ImportResult } from "./services/font-importer";
import { getImportedFontsDirectory } from "./services/font-scanner";
import {
  uninstallFontFromOS,
  isInstalledInWindowsFontsDir,
} from "./services/font-installer";
import fs from "fs";
import os from "os";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
import electronSquirrelStartup from "electron-squirrel-startup";
if (electronSquirrelStartup) {
  app.quit();
}

// Must be called before app is ready.
// Marks font:// as a standard, secure scheme so @font-face src: url('font://...') works.
protocol.registerSchemesAsPrivileged([
  {
    scheme: "font",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  // Dev: resolve from project root. Prod: electron-builder puts extraResources
  // in process.resourcesPath — the only path guaranteed correct after packaging.
  const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
  const windowIcon = isDev
    ? path.join(process.cwd(), "assets", "icon-1024.png")
    : path.join(process.resourcesPath, "icon.ico");

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    backgroundColor: "#09090b",
    icon: windowIcon,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // required: sandbox strips File.path from drop events
      webSecurity: false, // required: allows font:// and file:// from renderer
    },
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#09090b",
      symbolColor: "#ffffff",
      height: 48,
    },
  });

  const isExternalUrl = (url: string) =>
    url.startsWith("http://") || url.startsWith("https://");

  const isInternalUrl = (url: string) =>
    url.startsWith("file://") ||
    url.startsWith("font://") ||
    url.startsWith("http://localhost:5173");

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isInternalUrl(url) && isExternalUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
};

app.whenReady().then(async () => {
  // Serve local font files via font:// so Chromium gets the correct Content-Type
  // and doesn't choke on legacy cmap subtables that trigger OTS parse errors.
  protocol.handle("font", (request) => {
    // URL format: font://local/<path>  e.g. font://local/C:/Windows/Fonts/arial.ttf
    // Strip "font://local/" and decode each percent-encoded segment.
    const withoutPrefix = request.url.slice("font://local/".length);
    const filePath = withoutPrefix
      .split("/")
      .map(decodeURIComponent)
      .join(path.sep);
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".ttf": "font/ttf",
      ".otf": "font/otf",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
    };
    const contentType = mimeTypes[ext] ?? "application/octet-stream";
    try {
      const data = fs.readFileSync(filePath);
      return new Response(data, {
        status: 200,
        headers: { "Content-Type": contentType },
      });
    } catch (e: any) {
      console.error("font:// handler error:", filePath, e?.message);
      return new Response("Not found", { status: 404 });
    }
  });

  // Initialize database
  initDatabase();

  // Run migration to add categories to existing fonts
  try {
    await migrateFontsWithCategories();
  } catch (e) {
    console.error("Migration error:", e);
  }

  loadBridge();
  generateBridgeFromDatabase();
  preloadOnlineMetadata();

  const importedDir = getImportedFontsDirectory();
  if (!fs.existsSync(importedDir)) {
    fs.mkdirSync(importedDir, { recursive: true });
  }

  createWindow();

  // Start watcher
  startWatcher();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("scan-fonts", async (event) => {
  const result = await scanFonts((count) => {
    event.sender.send("scan-progress", count);
  });
  generateBridgeFromDatabase();
  return result;
});

ipcMain.handle("get-fonts", () => {
  return getAllFonts();
});

ipcMain.handle(
  "toggle-favorite",
  (_event, family: string, isFavorite: boolean) => {
    toggleFavorite(family, isFavorite);
  }
);

ipcMain.handle("get-font-variants", (_event, family: string) => {
  return getFontVariants(family);
});

ipcMain.handle("reveal-in-folder", (_event, filePath: string) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle("get-recent-fonts", () => {
  return getRecentFonts();
});

ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

ipcMain.handle(
  "import-dropped-fonts",
  async (event, sourcePaths: string[]): Promise<ImportResult> => {
    console.log("[import] IPC received. paths:", sourcePaths);
    const result = await importFontFiles(sourcePaths, (processed) => {
      console.log("[import] progress:", processed);
      event.sender.send("import-progress", processed);
    });
    console.log("[import] done:", JSON.stringify(result));
    generateBridgeFromDatabase();
    return result;
  }
);

ipcMain.handle(
  "uninstall-font",
  async (
    _event,
    family: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const importedDir = getImportedFontsDirectory();
      const variants = getFontVariants(family) as Array<{
        file_path: string;
        family: string;
        subfamily: string;
      }>;

      if (variants.length === 0) {
        return { success: false, error: "Font not found." };
      }

      // Only allow uninstalling fonts that live in our ImportedFonts dir
      // OR in the Windows per-user fonts dir (both are user-owned locations)
      for (const v of variants) {
        const norm = path.normalize(v.file_path);
        const inImported = norm.startsWith(path.normalize(importedDir));
        const inWinFonts =
          os.platform() === "win32" &&
          isInstalledInWindowsFontsDir(v.file_path);
        if (!inImported && !inWinFonts) {
          return {
            success: false,
            error: "Only imported fonts can be uninstalled.",
          };
        }
      }

      for (const v of variants) {
        // 1. Remove from OS fonts dir + registry (Windows)
        if (os.platform() === "win32") {
          try {
            await uninstallFontFromOS(v.family, v.subfamily, v.file_path);
          } catch (e: any) {
            console.warn("OS uninstall warning:", e?.message);
          }
        }

        // 2. Delete the staged copy in ImportedFonts if it still exists
        const stagedPath = path.join(importedDir, path.basename(v.file_path));
        for (const p of [v.file_path, stagedPath]) {
          if (fs.existsSync(p)) {
            try {
              fs.unlinkSync(p);
            } catch {
              /* already gone */
            }
          }
        }

        // 3. Remove from DB
        deleteFontByPath(v.file_path);
      }

      generateBridgeFromDatabase();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || String(e) };
    }
  }
);
