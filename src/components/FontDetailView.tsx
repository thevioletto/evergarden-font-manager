import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useDeferredValue,
  useTransition,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Button } from "@/components/ui/button";
import { ManagedIcon } from "@/components/ui/managed-icon";
import { WindowControls } from "@/components/WindowControls";
import { cn } from "@/lib/utils";
import logo from "../../assets/logo.svg";
import logoDark from "../../assets/logo-dark.svg";

import { SpecimenTab } from "./font-detail/SpecimenTab";
import { GlyphsTab } from "./font-detail/GlyphsTab";
import { LigaturesTab } from "./font-detail/LigaturesTab";
import { OpenTypeTab } from "./font-detail/OpenTypeTab";
import { WaterfallTab } from "./font-detail/WaterfallTab";
import { InfoTab } from "./font-detail/InfoTab";
import { FontDetailSidebar } from "./font-detail/FontDetailSidebar";
import {
  FEATURE_CATEGORY_ORDER,
  getFeatureInfo,
  toFontUrl,
} from "@/lib/font-utils";

interface FontDetailViewProps {
  font: any;
  onBack: () => void;
  onUninstall?: (family: string) => Promise<void>;
}

const DETAIL_TABS = [
  { id: "specimen" as const, label: "Specimen" },
  { id: "glyphs" as const, label: "Glyphs" },
  { id: "ligatures" as const, label: "Ligatures" },
  { id: "ot" as const, label: "OT" },
  { id: "waterfall" as const, label: "Waterfall" },
  { id: "info" as const, label: "Info" },
];

export function FontDetailView({
  font,
  onBack,
  onUninstall,
}: FontDetailViewProps) {
  const [specimenText, setSpecimenText] = useState("Refinement");
  const [activeTab, setActiveTab] = useState<
    "specimen" | "glyphs" | "ligatures" | "ot" | "waterfall" | "info"
  >("specimen");
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(
    () => new Set(["specimen"])
  );
  const [tabPending, startTabTransition] = useTransition();
  const [variants, setVariants] = useState<any[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    const loadVariants = async () => {
      const allVariants = await invoke<any[]>("get_font_variants_cmd", { family: font.family });
      if (cancelled) return;

      if (allVariants.length > 0) {
        const sub = (v: any) => (v.subfamily ?? "").trim().toLowerCase();
        const isItalic = (v: any) =>
          v.italic === 1 ||
          sub(v).includes("italic") ||
          sub(v).includes("oblique");

        const exactRegular = allVariants.find(
          (v: any) => sub(v) === "regular"
        );
        const neutralNames = ["normal", "book", "roman"];
        const exactNeutral = allVariants.find((v: any) =>
          neutralNames.includes(sub(v))
        );
        const nonItalics = allVariants.filter((v: any) => !isItalic(v));
        const byProximity = [...nonItalics].sort(
          (a: any, b: any) =>
            Math.abs((a.weight || 400) - 400) -
            Math.abs((b.weight || 400) - 400)
        );
        const weightNearest = byProximity[0] ?? null;

        const best =
          exactRegular ?? exactNeutral ?? weightNearest ?? allVariants[0];

        startTabTransition(() => {
          setVariants(allVariants);
          setSelectedVariant(best);
        });
      } else {
        startTabTransition(() => {
          setVariants([font]);
          setSelectedVariant(font);
        });
      }
    };
    loadVariants().catch(() => {
      if (!cancelled) {
        startTabTransition(() => {
          setVariants([font]);
          setSelectedVariant(font);
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [font.family, font]);

  const currentFont = selectedVariant || font;

  const [showUninstallConfirm, setShowUninstallConfirm] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [uninstallError, setUninstallError] = useState<string | null>(null);

  const isImportedFont = useMemo(() => {
    const p = (font.all_file_paths || font.file_path || "").toLowerCase();
    return (
      p.includes("importedfonts") ||
      p.includes("imported_fonts") ||
      p.includes("\\microsoft\\windows\\fonts")
    );
  }, [font]);

  const isOsInstalled = font.is_os_installed === 1;

  const handleUninstall = useCallback(async () => {
    if (!onUninstall) return;
    setIsUninstalling(true);
    setUninstallError(null);
    try {
      await onUninstall(font.family);
    } catch (e: any) {
      setUninstallError(e?.message || "Uninstall failed.");
      setIsUninstalling(false);
      setShowUninstallConfirm(false);
    }
  }, [onUninstall, font.family]);

  const [typography, setTypography] = useState({
    fontSize: 72,
    lineHeight: 1.2,
    letterSpacing: 0,
    align: "left" as "left" | "center" | "right",
  });
  const deferredTypography = useDeferredValue(typography);

  const [features, setFeatures] = useState<Record<string, boolean>>({
    liga: true,
    kern: true,
  });
  const deferredFeatures = useDeferredValue(features);

  const { supportedFeatures, supportedChars } = useMemo(() => {
    try {
      if (!currentFont.metadata_json)
        return { supportedFeatures: new Set<string>(), supportedChars: [] };
      const metadata = JSON.parse(currentFont.metadata_json);
      return {
        supportedFeatures: new Set<string>(metadata.features || []),
        supportedChars: (metadata.characterSet as number[]) || [],
      };
    } catch (e) {
      return { supportedFeatures: new Set<string>(), supportedChars: [] };
    }
  }, [currentFont]);

  const [glyphLimit, setGlyphLimit] = useState(200);

  const sortedChars = useMemo(() => {
    return [...supportedChars]
      .filter((c) => !((c >= 0 && c <= 31) || (c >= 127 && c <= 159)))
      .sort((a, b) => a - b);
  }, [supportedChars]);

  const glyphsToRender = useMemo(() => {
    if (sortedChars.length > 0) return sortedChars.slice(0, glyphLimit);
    return Array.from({ length: 94 }).map((_, i) => 33 + i);
  }, [sortedChars, glyphLimit]);

  const fontId = `font-detail-${currentFont.id}`;
  const fontFaceStyle = `
    @font-face {
      font-family: '${fontId}';
      src: url('${toFontUrl(currentFont.file_path)}');
      font-display: swap;
    }
  `;

  const characters = "ABCDEFGHIJKLabcd0123&$?!".split("");

  const featureSettings = useMemo(() => {
    return Object.entries(deferredFeatures)
      .filter(([_, enabled]) => enabled)
      .map(([key]) => `"${key}" 1`)
      .join(", ");
  }, [deferredFeatures]);

  const getTypographyStyle = useCallback(
    (baseFontSize?: number, settings?: { featureSettings?: string }) => ({
      fontFamily: `'${fontId}', sans-serif`,
      fontFeatureSettings: settings?.featureSettings ?? featureSettings,
      fontSize: baseFontSize || deferredTypography.fontSize,
      lineHeight: deferredTypography.lineHeight,
      letterSpacing: `${deferredTypography.letterSpacing}px`,
    }),
    [fontId, featureSettings, deferredTypography]
  );

  const featuresByCategory = useMemo(() => {
    const grouped: Record<
      string,
      { tag: string; label: string; category: string }[]
    > = {};

    const sortedTags = Array.from(supportedFeatures).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );

    sortedTags.forEach((tag) => {
      const info = getFeatureInfo(tag);
      if (!grouped[info.category]) {
        grouped[info.category] = [];
      }
      grouped[info.category].push(info);
    });

    const orderedGrouped: Record<
      string,
      { tag: string; label: string; category: string }[]
    > = {};

    FEATURE_CATEGORY_ORDER.forEach((cat) => {
      if (grouped[cat] && grouped[cat].length > 0) {
        orderedGrouped[cat] = grouped[cat];
      }
    });

    Object.keys(grouped).forEach((cat) => {
      if (!orderedGrouped[cat]) {
        orderedGrouped[cat] = grouped[cat];
      }
    });

    return orderedGrouped;
  }, [supportedFeatures]);

  return (
    <div className="bg-background flex h-screen flex-col overflow-hidden">
      <style>{fontFaceStyle}</style>
      <header
        className="bg-background draggable-region flex h-14 shrink-0 items-center justify-between border-b pr-4 pl-4 select-none"
        data-tauri-drag-region
        onDoubleClick={(e) => {
          if (e.target === e.currentTarget) {
            getCurrentWindow().toggleMaximize().catch(console.error);
          }
        }}
      >
        <div className="flex items-center gap-6" style={{ WebkitAppRegion: "no-drag" } as any}>
          <div className="flex items-center gap-2">
            <img
              src={logo}
              alt="Evergarden"
              className="h-8 w-auto dark:hidden"
            />
            <img
              src={logoDark}
              alt="Evergarden"
              className="hidden h-8 w-auto dark:block"
            />
            <div className="bg-border mx-2 h-4 w-px"></div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="gap-2"
            >
              <ManagedIcon name="ArrowLeft" className="h-4 w-4" />
              Back
            </Button>
          </div>

          <nav className="flex items-center gap-1">
            {DETAIL_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={cn(
                  "mt-4 px-3 pb-4 text-sm font-medium transition-opacity",
                  activeTab === tab.id
                    ? "border-foreground text-foreground border-b-2"
                    : "text-muted-foreground hover:text-foreground/80",
                  tabPending && activeTab !== tab.id && "opacity-50"
                )}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  startTabTransition(() => {
                    setMountedTabs((prev) => {
                      if (prev.has(tab.id)) return prev;
                      const next = new Set(prev);
                      next.add(tab.id);
                      return next;
                    });
                  });
                }}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <WindowControls />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="bg-background w-full flex-1 overflow-y-auto">
          <SpecimenTab
            activeTab={activeTab}
            font={font}
            isOsInstalled={isOsInstalled}
            specimenText={specimenText}
            setSpecimenText={setSpecimenText}
            getTypographyStyle={getTypographyStyle}
            typography={typography}
            characters={characters}
          />
          {mountedTabs.has("glyphs") && (
            <GlyphsTab
              activeTab={activeTab}
              glyphsToRender={glyphsToRender}
              sortedChars={sortedChars}
              glyphLimit={glyphLimit}
              setGlyphLimit={setGlyphLimit}
              getTypographyStyle={getTypographyStyle}
            />
          )}
          {mountedTabs.has("ligatures") && (
            <LigaturesTab
              activeTab={activeTab}
              getTypographyStyle={getTypographyStyle}
            />
          )}
          {mountedTabs.has("ot") && (
            <OpenTypeTab
              activeTab={activeTab}
              supportedFeatures={supportedFeatures}
              getTypographyStyle={getTypographyStyle}
            />
          )}
          {mountedTabs.has("waterfall") && (
            <WaterfallTab
              activeTab={activeTab}
              specimenText={specimenText}
              getTypographyStyle={getTypographyStyle}
            />
          )}
          {mountedTabs.has("info") && (
            <InfoTab
              activeTab={activeTab}
              currentFont={currentFont}
              supportedFeatures={supportedFeatures}
              variants={variants}
            />
          )}
        </main>

        <FontDetailSidebar
          variants={variants}
          font={font}
          currentFont={currentFont}
          selectedVariant={selectedVariant}
          setSelectedVariant={setSelectedVariant}
          startTabTransition={startTabTransition}
          typography={typography}
          setTypography={setTypography}
          featuresByCategory={featuresByCategory}
          supportedFeatures={supportedFeatures}
          features={features}
          setFeatures={setFeatures}
          isImportedFont={isImportedFont}
          onUninstall={onUninstall}
          showUninstallConfirm={showUninstallConfirm}
          setShowUninstallConfirm={setShowUninstallConfirm}
          isOsInstalled={isOsInstalled}
          uninstallError={uninstallError}
          setUninstallError={setUninstallError}
          isUninstalling={isUninstalling}
          handleUninstall={handleUninstall}
        />
      </div>
    </div>
  );
}
