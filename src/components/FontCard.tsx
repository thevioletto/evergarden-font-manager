import { memo, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ManagedIcon } from "@/components/ui/managed-icon";
import { invoke } from "@tauri-apps/api/core";
import { toFontUrl } from "@/lib/font-utils";

interface Font {
  id: number;
  family: string;
  subfamily: string;
  file_path: string;
  preview_file_path?: string | null;
  metadata_json: string;
  variant_count?: number;
  category?: string;
  subcategory?: string;
  is_favorite?: number;
}

interface FontCardProps {
  font: Font;
  isSelected: boolean;
  onClick: () => void;
  previewText?: string;
  fontSize?: number;
  features?: Record<string, boolean>;
  onFontsChange?: () => void;
}

export const FontCard = memo(
  function FontCard({
    font,
    isSelected,
    onClick,
    previewText = "",
    fontSize = 32,
    features = {},
    onFontsChange,
  }: FontCardProps) {
    const fontId = `font-${font.id}`;
    const [isFavorite, setIsFavorite] = useState(!!font.is_favorite);

    const previewPath = font.preview_file_path || font.file_path;
    const fontFaceStyle = useMemo(() => {
      const url = toFontUrl(previewPath);
      return (
        <style key={fontId}>
          {`
            @font-face {
                font-family: '${fontId}';
                src: url('${url}');
                font-display: swap;
            }
            `}
        </style>
      );
    }, [previewPath, fontId]);

    const featureSettings = useMemo(() => {
      return Object.entries(features)
        .map(([key, value]) => `"${key}" ${value ? 1 : 0}`)
        .join(", ");
    }, [features]);

    const displayText = previewText || "Aa";

    return (
      <>
        {fontFaceStyle}
        <div
          onClick={onClick}
          className={cn(
            "group bg-card relative flex h-full cursor-pointer flex-col justify-between rounded-xl border p-4 shadow-sm",
            isSelected && "border-primary ring-primary ring-1"
          )}
        >
          <div className="mb-8 flex items-start justify-between">
            <button
              title="Favourite"
              onClick={async (e) => {
                e.stopPropagation();
                const newState = !isFavorite;
                setIsFavorite(newState);
                await invoke("toggle_favorite_cmd", {
                  family: font.family,
                  isFavorite: newState,
                });
                if (onFontsChange) {
                  onFontsChange();
                }
              }}
              className="-m-1 p-1"
            >
              <ManagedIcon
                name="Heart"
                filled={isFavorite}
                className={cn(
                  "h-5 w-5",
                  isFavorite
                    ? "fill-destructive text-destructive"
                    : "text-muted-foreground/30 hover:text-destructive group-hover:text-destructive"
                )}
              />
            </button>
            <span className="bg-secondary/50 text-muted-foreground rounded px-2 py-1 text-[10px] font-bold tracking-wider uppercase">
              {font.variant_count
                ? `${font.variant_count} ${font.variant_count === 1 ? "style" : "styles"}`
                : "1 style"}
            </span>
          </div>

          <div
            className="mb-8 flex h-24 w-full items-center justify-center overflow-hidden text-center"
            style={{
              fontFamily: `'${fontId}', sans-serif`, // Fallback
              fontSize: `${fontSize}px`,
              fontFeatureSettings: featureSettings,
              textRendering: "geometricPrecision",
              fontKerning: "normal",
              opacity: 1,
              isolation: "isolate",
            }}
          >
            <span className="block w-full truncate">{displayText}</span>
          </div>

          <div>
            <h3
              className="truncate text-base font-medium select-none"
              title={font.family}
            >
              {font.family}
            </h3>
            {(font.category || font.subcategory) && (
              <p className="text-muted-foreground mt-1 truncate text-xs">
                {[font.category, font.subcategory].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        </div>
      </>
    );
  },
  (prev, next) => {
    return (
      prev.font.id === next.font.id &&
      prev.isSelected === next.isSelected &&
      prev.fontSize === next.fontSize &&
      prev.previewText === next.previewText &&
      prev.features === next.features
    );
  }
);
