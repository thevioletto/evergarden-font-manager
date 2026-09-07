import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ManagedIcon } from "@/components/ui/managed-icon";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { WindowControls } from "@/components/WindowControls";

interface HeaderProps {
  onScan: () => void;
  isScanning?: boolean;
  rebuildDoneAt?: number | null;
  fontSize: number;
  setFontSize: (size: number) => void;
  previewText: string;
  setPreviewText: (text: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export function Header({
  onScan,
  isScanning = false,
  rebuildDoneAt = null,
  fontSize,
  setFontSize,
  previewText,
  setPreviewText,
  searchQuery,
  onSearchChange,
  theme,
  onToggleTheme,
}: HeaderProps) {
  const [appVersion, setAppVersion] = useState("Unknown");

  useEffect(() => {
    let cancelled = false;

    const loadAppVersion = async () => {
      try {
        const version = await invoke<string>("get_app_version_cmd");
        if (!cancelled && version) {
          setAppVersion(version);
        }
      } catch {
        if (!cancelled) {
          setAppVersion("Unknown");
        }
      }
    };

    loadAppVersion();
    return () => {
      cancelled = true;
    };
  }, []);

  const rebuildState = isScanning
    ? "scanning"
    : rebuildDoneAt != null
      ? "done"
      : "idle";

  return (
    <header
      className="bg-background draggable-region flex h-14 shrink-0 items-center justify-between gap-6 border-b pr-4 pl-6 select-none"
      data-tauri-drag-region
      onDoubleClick={(e) => {
        if (e.target === e.currentTarget) {
          getCurrentWindow().toggleMaximize().catch(console.error);
        }
      }}
    >
      {/* Search */}
      <div
        className="flex max-w-xs flex-1 items-center gap-3"
        style={{ WebkitAppRegion: "no-drag" } as any}
      >
        <ManagedIcon
          name="Search"
          className="text-muted-foreground h-4 w-4 shrink-0"
        />
        <Input
          type="text"
          placeholder="Search fonts..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 text-sm"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="shrink-0 rounded-sm p-0.5 opacity-70 transition-opacity hover:opacity-100"
            title="Clear search"
          >
            <ManagedIcon name="X" className="text-foreground h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="bg-border mx-1 h-5 w-px" />

      {/* Preview Text */}
      <div
        className="flex flex-1 items-center gap-3"
        style={{ WebkitAppRegion: "no-drag" } as any}
      >
        <ManagedIcon name="Type" className="text-muted-foreground h-4 w-4 shrink-0" />
        <Input
          type="text"
          placeholder="Type something to preview..."
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      {/* Controls */}
      <div
        className="flex items-center gap-4"
        style={{ WebkitAppRegion: "no-drag" } as any}
      >
        <div className="flex w-44 items-center gap-2.5">
          <span className="text-muted-foreground w-7 text-right text-[10px] font-bold">
            {fontSize}px
          </span>
          <Slider
            value={[fontSize]}
            onValueChange={(val) => setFontSize(val[0])}
            max={128}
            min={12}
            step={1}
            className="flex-1"
          />
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setFontSize(72)}
            title="Reset View"
            className="h-8 w-8 rounded-full"
          >
            <ManagedIcon name="RefreshLine" className="h-4 w-4" />
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                title="Settings"
                className="h-8 w-8 rounded-full"
              >
                <ManagedIcon name="Settings" className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Settings</DialogTitle>
                <DialogDescription>
                  Configure the application preferences.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                {/* Appearance Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <ManagedIcon
                      name="Palette"
                      className="text-muted-foreground h-4 w-4"
                    />
                    <h3 className="text-sm font-medium">Appearance</h3>
                  </div>
                  <div className="bg-card rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-sm font-medium">Dark Mode</span>
                        <p className="text-muted-foreground text-xs">
                          Switch between light and dark themes
                        </p>
                      </div>
                      <Switch
                        checked={theme === "dark"}
                        onCheckedChange={onToggleTheme}
                      />
                    </div>
                  </div>
                </div>

                {/* Database Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <ManagedIcon
                      name="Database"
                      className="text-muted-foreground h-4 w-4"
                    />
                    <h3 className="text-sm font-medium">Database</h3>
                  </div>
                  <div className="bg-card rounded-lg border p-3">
                    <p className="text-muted-foreground mb-3 text-xs">
                      Rebuild the font database if you notice missing fonts or
                      inconsistent metadata. This may take a few moments.
                    </p>
                    <Button
                      onClick={onScan}
                      variant="secondary"
                      size="sm"
                      className="w-full justify-center"
                      disabled={isScanning}
                    >
                      {rebuildState === "scanning" && (
                        <>
                          <ManagedIcon
                            name="Loader2"
                            className="mr-2 h-3.5 w-3.5 animate-spin"
                          />
                          Rebuilding…
                        </>
                      )}
                      {rebuildState === "done" && (
                        <>
                          <ManagedIcon
                            name="Check"
                            filled
                            className="mr-2 h-3.5 w-3.5 text-emerald-500"
                          />
                          Done
                        </>
                      )}
                      {rebuildState === "idle" && (
                        <>
                          <ManagedIcon
                            name="RotateCw"
                            className="mr-2 h-3.5 w-3.5"
                          />
                          Rebuild Font Index
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* About Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <ManagedIcon
                      name="Info"
                      className="text-muted-foreground h-4 w-4"
                    />
                    <h3 className="text-sm font-medium">About</h3>
                  </div>
                  <div className="bg-card text-muted-foreground space-y-2 rounded-lg border p-4 text-xs">
                    <div className="flex justify-between">
                      <span>Version</span>
                      <span className="font-mono">{appVersion}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Runtime</span>
                      <span className="font-mono">
                        Tauri
                      </span>
                    </div>
                    <div className="mt-2 flex flex-col items-center gap-1 border-t pt-2">
                      <span className="opacity-50">
                        Evergarden Font Manager
                      </span>
                    </div>
                  </div>
                  <a
                    href="https://github.com/thevioletto/evergarden-font-manager"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-muted-foreground hover:text-primary mt-1 block w-full text-center text-[10px] tracking-widest uppercase transition-colors"
                  >
                    Made with ❤️ by Violet
                  </a>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <div className="bg-border mx-1 h-6 w-px" />

          <WindowControls />
        </div>
      </div>
    </header>
  );
}
