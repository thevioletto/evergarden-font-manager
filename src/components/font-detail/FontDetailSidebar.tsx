import { Button } from "@/components/ui/button";
import { ManagedIcon } from "@/components/ui/managed-icon";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { invoke } from "@tauri-apps/api/core";
import { getVariantDisplayLabel } from "@/lib/font-utils";
import { MarqueeOnHover } from "./MarqueeOnHover";
import { OPENTYPE_FEATURES } from "@/lib/font-utils";
import { toFontUrl } from "@/lib/font-utils";

interface FontDetailSidebarProps {
  variants: any[];
  font: any;
  currentFont: any;
  selectedVariant: any;
  setSelectedVariant: (v: any) => void;
  startTabTransition: (callback: () => void) => void;
  typography: {
    fontSize: number;
    lineHeight: number;
    letterSpacing: number;
    align: string;
  };
  setTypography: React.Dispatch<React.SetStateAction<any>>;
  featuresByCategory: Record<string, typeof OPENTYPE_FEATURES>;
  supportedFeatures: Set<string>;
  features: Record<string, boolean>;
  setFeatures: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  isImportedFont: boolean;
  onUninstall?: (family: string) => Promise<void>;
  showUninstallConfirm: boolean;
  setShowUninstallConfirm: (show: boolean) => void;
  isOsInstalled: boolean;
  uninstallError: string | null;
  setUninstallError: (error: string | null) => void;
  isUninstalling: boolean;
  handleUninstall: () => void;
}

export function FontDetailSidebar({
  variants,
  font,
  currentFont,
  selectedVariant,
  setSelectedVariant,
  startTabTransition,
  typography,
  setTypography,
  featuresByCategory,
  supportedFeatures,
  features,
  setFeatures,
  isImportedFont,
  onUninstall,
  showUninstallConfirm,
  setShowUninstallConfirm,
  isOsInstalled,
  uninstallError,
  setUninstallError,
  isUninstalling,
  handleUninstall,
}: FontDetailSidebarProps) {
  return (
    <aside className="bg-card flex w-80 shrink-0 flex-col overflow-y-auto border-l">
      <div className="space-y-6 p-6">
        {/* Font Variants */}
        {variants.length > 1 && (
          <div>
            <h3 className="text-muted-foreground mb-4 text-[10px] font-bold tracking-[0.2em] uppercase">
              Weight & Style
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {variants.map((v) => {
                const label = getVariantDisplayLabel(v, font.family);
                return (
                  <Button
                    key={v.id}
                    variant={
                      selectedVariant?.id === v.id ? "secondary" : "outline"
                    }
                    className={cn(
                      "h-auto justify-start px-3 py-2 text-xs",
                      selectedVariant?.id === v.id && "border-primary"
                    )}
                    onClick={() =>
                      startTabTransition(() => setSelectedVariant(v))
                    }
                  >
                    <div className="flex w-full flex-col items-start gap-1 overflow-hidden">
                      {/* Marquee-on-hover style name */}
                      <MarqueeOnHover
                        className="w-full font-medium"
                        title={v.full_name || v.subfamily}
                      >
                        {label}
                      </MarqueeOnHover>
                      {/* Preview of the style */}
                      <span
                        className="w-full truncate text-lg opacity-70"
                        style={{ fontFamily: `'font-detail-${v.id}'` }}
                      >
                        Aa
                      </span>
                    </div>
                  </Button>
                );
              })}
            </div>
            {/* Hidden font-faces for variants to show preview used above */}
            {variants.map((v) => (
              <style key={v.id}>{`
                 @font-face {
                   font-family: 'font-detail-${v.id}';
                   src: url('${toFontUrl(v.file_path)}');
                   font-display: swap;
                 }
               `}</style>
            ))}
          </div>
        )}

        {/* Typography Controls */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-muted-foreground text-[10px] font-bold tracking-[0.2em] uppercase">
              Typography
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() =>
                setTypography({
                  fontSize: 72,
                  lineHeight: 1.2,
                  letterSpacing: 0,
                  align: "left",
                })
              }
              title="Reset Typography"
            >
              <ManagedIcon name="RotateCcw" className="h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium">Size</label>
                <span className="text-muted-foreground font-mono text-xs">
                  {typography.fontSize}px
                </span>
              </div>
              <Slider
                value={[typography.fontSize]}
                onValueChange={(val) =>
                  setTypography((prev: any) => ({ ...prev, fontSize: val[0] }))
                }
                min={12}
                max={200}
                step={1}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium">Line Height</label>
                <span className="text-muted-foreground font-mono text-xs">
                  {typography.lineHeight}
                </span>
              </div>
              <Slider
                value={[typography.lineHeight * 100]}
                onValueChange={(val) =>
                  setTypography((prev: any) => ({
                    ...prev,
                    lineHeight: val[0] / 100,
                  }))
                }
                min={80}
                max={250}
                step={5}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium">Letter Spacing</label>
                <span className="text-muted-foreground font-mono text-xs">
                  {typography.letterSpacing}px
                </span>
              </div>
              <Slider
                value={[typography.letterSpacing]}
                onValueChange={(val) =>
                  setTypography((prev: any) => ({
                    ...prev,
                    letterSpacing: val[0],
                  }))
                }
                min={-5}
                max={20}
                step={0.5}
              />
            </div>
          </div>
        </div>

        {/* Features Controls */}
        <div>
          <h3 className="text-muted-foreground mb-4 text-[10px] font-bold tracking-[0.2em] uppercase">
            OpenType Features
          </h3>
          <div className="space-y-6">
            {Object.entries(featuresByCategory).map(
              ([category, categoryFeatures]) => {
                const availableFeatures = categoryFeatures.filter((f) =>
                  supportedFeatures.has(f.tag)
                );
                if (availableFeatures.length === 0) return null;

                return (
                  <div key={category}>
                    <h4 className="text-muted-foreground/70 mb-2 text-[9px] font-semibold tracking-wider uppercase">
                      {category}
                    </h4>
                    <div className="space-y-2">
                      {availableFeatures.map(({ tag, label }) => (
                        <label
                          key={tag}
                          className="group flex cursor-pointer items-center justify-between"
                        >
                          <span className="text-xs font-medium">{label}</span>
                          <Switch
                            checked={features[tag] || false}
                            onCheckedChange={(checked) =>
                              setFeatures((prev) => ({
                                ...prev,
                                [tag]: checked,
                              }))
                            }
                            className="origin-right scale-75"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                );
              }
            )}
            {Object.values(featuresByCategory).every(
              (cat) =>
                cat.filter((f) => supportedFeatures.has(f.tag)).length === 0
            ) && (
              <div className="text-muted-foreground rounded border border-dashed p-4 py-2 text-center text-xs">
                No OpenType features detected for this font.
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-auto space-y-2 border-t pt-6">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => {
                invoke("reveal_in_folder_cmd", { filePath: currentFont.file_path });
            }}
          >
            <ManagedIcon name="FolderOpen" className="h-4 w-4" />
            Reveal in Folder
          </Button>

          {isImportedFont && onUninstall && !showUninstallConfirm && (
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive w-full gap-2"
              onClick={() => setShowUninstallConfirm(true)}
            >
              <ManagedIcon name="Trash2" className="h-4 w-4" />
              Uninstall Font
            </Button>
          )}

          {showUninstallConfirm && (
            <div className="border-destructive/30 bg-destructive/5 space-y-3 rounded-lg border p-3">
              <p className="text-destructive text-xs font-medium">
                Remove &ldquo;{font.family}&rdquo; and all its variants?
                {isOsInstalled &&
                  " It will also be unregistered from Windows."}{" "}
                This cannot be undone.
              </p>
              {uninstallError && (
                <p className="text-destructive text-xs opacity-80">
                  {uninstallError}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1 gap-1.5 text-xs"
                  disabled={isUninstalling}
                  onClick={handleUninstall}
                >
                  {isUninstalling ? "Removing…" : "Remove"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  disabled={isUninstalling}
                  onClick={() => {
                    setShowUninstallConfirm(false);
                    setUninstallError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
