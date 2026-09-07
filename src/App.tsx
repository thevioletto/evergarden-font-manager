import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useDeferredValue,
  useRef,
  lazy,
  Suspense,
} from "react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { FontGrid } from "./components/FontGrid";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const FontDetailView = lazy(() =>
  import("./components/FontDetailView").then((module) => ({
    default: module.FontDetailView,
  }))
);
const FontPairingView = lazy(() =>
  import("./components/FontPairingView").then((module) => ({
    default: module.FontPairingView,
  }))
);

function App() {
  const [fonts, setFonts] = useState<any[]>([]);
  const [selectedFont, setSelectedFont] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanningCount, setScanningCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  // Deferred: input is always responsive; grid re-filters only after typing settles
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [categoryFilter, setCategoryFilter] = useState<{
    category: string | null;
    subcategory: string | null;
  }>({ category: null, subcategory: null });
  const [selectedView, setSelectedView] = useState("all");

  const selectedCategory = categoryFilter.category;
  const selectedSubcategory = categoryFilter.subcategory;

  // UI State
  const [fontSize, setFontSize] = useState(72);
  const [previewText, setPreviewText] = useState("");

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("theme");
    return (saved as "light" | "dark") || "dark";
  });

  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const loadFonts = useCallback(async () => {
    const loaded = await invoke<any[]>("get_fonts_cmd");
    setFonts(loaded);
  }, []);

  useEffect(() => {
    loadFonts();
  }, [loadFonts]);

  // Scan progress listener
  useEffect(() => {
    const unlisten = listen<number>("scan-progress", (event) => {
      setScanningCount(event.payload);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  // Import progress listener
  useEffect(() => {
    const unlisten = listen<number>("import-progress", (event) => {
      setImportProgress(event.payload);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  // Drag-drop via Tauri built-in window drag-drop events
  useEffect(() => {
    const unlistenOver = listen("tauri://drag-enter", () => {
      setIsDragOver(true);
    });
    const unlistenLeave = listen("tauri://drag-leave", () => {
      setIsDragOver(false);
      dragCounterRef.current = 0;
    });
    const unlistenDrop = listen<{ paths: string[] }>(
      "tauri://drag-drop",
      async (event) => {
        const paths = event.payload.paths;
        setIsDragOver(false);
        dragCounterRef.current = 0;
        if (!paths || paths.length === 0) return;

        setIsImporting(true);
        setImportProgress(0);
        setImportMessage(null);

        try {
          const result = await invoke<{
            imported: number;
            failed: number;
            errors: string[];
          }>("import_dropped_fonts_cmd", { paths });

          const updatedFonts = await invoke<any[]>("get_fonts_cmd");
          if (updatedFonts.length > 0) setFonts(updatedFonts);

          if (result.imported > 0) {
            setImportMessage(
              result.failed > 0
                ? `Imported ${result.imported} font(s); ${result.failed} failed.`
                : `Imported ${result.imported} font(s).`
            );
          } else if (result.failed > 0 && result.errors.length > 0) {
            setImportMessage(result.errors[0] || "Import failed.");
          } else {
            setImportMessage(
              "No font files recognised. Use .ttf, .otf, .woff, or .woff2."
            );
          }
        } catch (e: any) {
          setImportMessage(`Import error: ${e?.message || String(e)}`);
        } finally {
          setIsImporting(false);
          setImportProgress(0);
          setTimeout(() => setImportMessage(null), 4000);
        }
      }
    );

    return () => {
      unlistenOver.then((f) => f());
      unlistenLeave.then((f) => f());
      unlistenDrop.then((f) => f());
    };
  }, []);

  // React drag events only manage visual drag-over state
  // Actual import is handled by the Tauri drag-drop event above
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      dragCounterRef.current += 1;
      setIsDragOver(true);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);
  }, []);

  const [rebuildDoneAt, setRebuildDoneAt] = useState<number | null>(null);

  useEffect(() => {
    if (rebuildDoneAt == null) return;
    const timeoutId = window.setTimeout(() => {
      setRebuildDoneAt(null);
    }, 2500);
    return () => window.clearTimeout(timeoutId);
  }, [rebuildDoneAt]);

  const [nowSeconds, setNowSeconds] = useState(() =>
    Math.floor(Date.now() / 1000)
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowSeconds(Math.floor(Date.now() / 1000));
    }, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const recentCutoff = nowSeconds - 30 * 86400;

  const handleScan = async () => {
    setLoading(true);
    setScanningCount(0);
    await invoke("scan_fonts_cmd");
    await loadFonts();
    setRebuildDoneAt(Date.now());
    setLoading(false);
  };

  const filteredFonts = useMemo(
    () =>
      fonts.filter((font) => {
        const matchesSearch =
          !deferredSearchQuery ||
          font.family.toLowerCase().includes(deferredSearchQuery.toLowerCase());

        const fontCategory = (font.category ?? "").trim().toLowerCase();
        const fontSubcategory = (font.subcategory ?? "").trim().toLowerCase();
        const selCat = (selectedCategory ?? "").toLowerCase();
        const selSub = (selectedSubcategory ?? "").toLowerCase();
        const matchesCategory = !selectedCategory || fontCategory === selCat;
        const matchesSubcategory =
          !selectedSubcategory || fontSubcategory === selSub;

        const matchesView =
          selectedView === "all" ||
          selectedView === "pairing" ||
          (selectedView === "favorites" && font.is_favorite === 1) ||
          (selectedView === "recently-added" && font.last_seen >= recentCutoff);

        return (
          matchesSearch && matchesCategory && matchesSubcategory && matchesView
        );
      }),
    [
      fonts,
      deferredSearchQuery,
      recentCutoff,
      selectedCategory,
      selectedSubcategory,
      selectedView,
    ]
  );

  const fontsInView =
    selectedView === "favorites"
      ? fonts.filter((f) => f.is_favorite === 1)
      : selectedView === "recently-added"
        ? fonts.filter((f) => f.last_seen >= recentCutoff)
        : fonts;

  const categoryCounts = fontsInView.reduce<Record<string, number>>(
    (acc, font) => {
      const c = (font.category ?? "").trim() || "Basic";
      acc[c] = (acc[c] ?? 0) + 1;
      return acc;
    },
    {}
  );

  const subcategoryCounts = fontsInView.reduce<
    Record<string, Record<string, number>>
  >((acc, font) => {
    const c = (font.category ?? "").trim() || "Basic";
    const s = (font.subcategory ?? "").trim() || "Various";
    if (!acc[c]) acc[c] = {};
    acc[c][s] = (acc[c][s] ?? 0) + 1;
    return acc;
  }, {});

  const handleFilterSelect = useCallback(
    (category: string | null, subcategory: string | null) => {
      setCategoryFilter({ category, subcategory });
    },
    []
  );

  const selectedFontData =
    selectedFont !== null ? fonts.find((f) => f.id === selectedFont) : null;

  const handleSelectFont = useCallback((id: number) => {
    setSelectedFont(id);
  }, []);

  return (
    <div
      className="bg-background text-foreground relative flex h-screen w-full overflow-hidden font-sans"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Full-window drag/import overlay */}
      {(isDragOver || isImporting) && (
        <div className="border-primary/60 bg-primary/5 fixed inset-0 z-100 flex items-center justify-center border-2 border-dashed backdrop-blur-sm">
          <div className="bg-background/90 flex flex-col items-center gap-3 rounded-xl px-8 py-6 shadow-lg">
            <p className="text-foreground text-sm font-medium">
              {isImporting
                ? `Importing… ${importProgress} file(s) processed`
                : "Drop font files to import"}
            </p>
            <p className="text-muted-foreground text-xs">
              .ttf, .otf, .woff, .woff2 — metadata + online lookup applied
            </p>
          </div>
        </div>
      )}

      <Sidebar
        selectedCategory={selectedCategory}
        selectedSubcategory={selectedSubcategory}
        onFilterSelect={handleFilterSelect}
        selectedView={selectedView}
        onViewSelect={setSelectedView}
        categoryCounts={categoryCounts}
        subcategoryCounts={subcategoryCounts}
      />

      <div className="bg-secondary/30 dark:bg-background relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {!selectedFontData && selectedView !== "pairing" && (
          <Header
            onScan={handleScan}
            isScanning={loading}
            rebuildDoneAt={rebuildDoneAt}
            fontSize={fontSize}
            setFontSize={setFontSize}
            previewText={previewText}
            setPreviewText={setPreviewText}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        )}

        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {selectedView === "pairing" ? (
            <Suspense
              fallback={
                <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                  Loading pairing view...
                </div>
              }
            >
              <FontPairingView fonts={fonts} />
            </Suspense>
          ) : (
            <FontGrid
              key={`cat-${selectedCategory ?? "all"}-sub-${selectedSubcategory ?? "all"}`}
              fonts={filteredFonts}
              selectedId={selectedFont}
              onSelect={handleSelectFont}
              fontSize={fontSize}
              previewText={previewText}
              onFontsChange={loadFonts}
              features={{}}
            />
          )}

          {loading && (
            <div className="bg-background/50 absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2">
                <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
                <p className="text-sm font-medium">Scanning fonts...</p>
              </div>
            </div>
          )}

          {importMessage && (
            <div className="bg-primary text-primary-foreground absolute bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-sm font-medium shadow-lg">
              {importMessage}
            </div>
          )}
        </main>

        {/* Floating Status Pill (always on top, hidden in font detail and pairing views) */}
        {!selectedFontData && selectedView !== "pairing" && (
          <div className="border-border/60 bg-background/90 text-muted-foreground pointer-events-none fixed right-5 bottom-4 z-60 flex select-none items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium shadow-xl backdrop-blur-md transition-all">
            {loading ? (
              <>
                <span className="bg-primary h-2 w-2 animate-pulse rounded-full" />
                <span>
                  {scanningCount > 0
                    ? `Scanning (${scanningCount} files)…`
                    : "Scanning fonts…"}
                </span>
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>
                  {filteredFonts.length !== fonts.length
                    ? `${filteredFonts.length} of ${fonts.length} families`
                    : `${fonts.length} families`}
                </span>
              </>
            )}
          </div>
        )}

        {selectedFontData && (
          <div className="bg-background fixed inset-0 z-40 flex flex-col">
            <Suspense
              fallback={
                <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                  Loading font details...
                </div>
              }
            >
              <FontDetailView
                font={selectedFontData}
                onBack={() => setSelectedFont(null)}
                onUninstall={async (family: string) => {
                  await invoke("uninstall_font_cmd", { family });
                  setSelectedFont(null);
                  await loadFonts();
                }}
              />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
