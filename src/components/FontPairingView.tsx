import { type CSSProperties, useDeferredValue, useMemo, useState } from "react";
import { FixedSizeList, type ListChildComponentProps } from "react-window";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { toFontUrl } from "@/lib/font-utils";
import { ManagedIcon } from "@/components/ui/managed-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WindowControls } from "@/components/WindowControls";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

interface FontPairingViewProps {
  fonts: any[];
}

function getPreviewPath(font: any) {
  return font.preview_file_path || font.file_path;
}

interface FontOption {
  id: number;
  value: string;
  label: string;
  searchText: string;
  searchTokens: string[];
}

interface FontPickerState {
  query: string;
  setQuery: (query: string) => void;
  selectedFont: any | null;
  selectedOption: FontOption | null;
  visibleOptions: FontOption[];
  onValueChange: (option: FontOption | null) => void;
}

const COMBOBOX_ROW_HEIGHT = 42;
const COMBOBOX_MAX_HEIGHT = 294;
const DEFAULT_DISPLAY_FONT_FAMILIES = ["Geist"];
const DEFAULT_BODY_FONT_FAMILIES = ["Geist Mono", "GeistMono"];
const PREVIEW_PERSON_DEFAULTS = {
  name: "Violetto Evergarden",
  role: "Web Developer",
  contact: [
    "violetto@evergarden.com",
    "+1 (212) 555-0189",
    "violetto.evergarden.com",
  ],
};
const PREVIEW_BRAND_DEFAULTS = {
  name: "Evergarden Inc.",
  tagline: "Foundries, families, and sharp typography",
};

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getFontFamilyText(font: any) {
  return normalizeSearchText(font.family ?? "");
}

function getFontStyleText(font: any) {
  return normalizeSearchText(
    [font.subfamily, font.full_name, font.postscript_name, font.style_name]
      .filter(Boolean)
      .join(" ")
  );
}

function hasWord(text: string, word: string) {
  return (
    text === word ||
    text.startsWith(`${word} `) ||
    text.endsWith(` ${word}`) ||
    text.includes(` ${word} `)
  );
}

function isItalicVariant(font: any) {
  const styleText = getFontStyleText(font);
  return (
    font.italic === 1 ||
    hasWord(styleText, "italic") ||
    hasWord(styleText, "oblique")
  );
}

function getVariantScore(font: any) {
  const familyText = getFontFamilyText(font);
  const subfamilyText = normalizeSearchText(font.subfamily ?? "");
  const fullNameText = normalizeSearchText(font.full_name ?? "");
  const styleNameText = normalizeSearchText(font.style_name ?? "");
  const italicPenalty = isItalicVariant(font) ? 1000 : 0;
  const weightPenalty = Math.abs(Number(font.weight ?? 400) - 400);

  if (
    !isItalicVariant(font) &&
    (subfamilyText === "regular" ||
      fullNameText === `${familyText} regular` ||
      styleNameText === "regular")
  ) {
    return 0;
  }

  if (
    !isItalicVariant(font) &&
    ["normal", "book", "roman"].some(
      (keyword) =>
        subfamilyText === keyword ||
        styleNameText === keyword ||
        hasWord(fullNameText, keyword)
    )
  ) {
    return 100 + weightPenalty;
  }

  return 500 + italicPenalty + weightPenalty;
}

function getRepresentativeFont(fonts: any[]) {
  const rankedFonts = fonts.slice().sort((left, right) => {
    const scoreDifference = getVariantScore(left) - getVariantScore(right);
    if (scoreDifference !== 0) return scoreDifference;

    return String(left.full_name ?? "").localeCompare(
      String(right.full_name ?? "")
    );
  });

  return rankedFonts[0] ?? null;
}

function getRepresentativeFonts(fonts: any[]) {
  const fontsByFamily = new Map<string, any[]>();

  fonts.forEach((font) => {
    const family = (font.family ?? "").trim();
    if (!family) return;

    const familyFonts = fontsByFamily.get(family);
    if (familyFonts) {
      familyFonts.push(font);
      return;
    }

    fontsByFamily.set(family, [font]);
  });

  return [...fontsByFamily.values()]
    .map((familyFonts) => getRepresentativeFont(familyFonts))
    .filter(Boolean)
    .sort((left, right) => left.family.localeCompare(right.family));
}

function findPreferredFontId(fonts: any[], preferredFamilies: string[]) {
  const normalizedFamilies = preferredFamilies.map((family) =>
    family.trim().toLowerCase()
  );

  const familyMatch = fonts.filter((font) =>
    normalizedFamilies.includes((font.family ?? "").trim().toLowerCase())
  );

  if (familyMatch.length === 0) {
    return null;
  }

  return getRepresentativeFont(familyMatch)?.id ?? familyMatch[0].id;
}

function matchesFontOption(option: FontOption, query: string) {
  if (!query) return true;

  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  if (option.searchText.includes(normalizedQuery)) return true;

  const queryTokens = normalizedQuery.split(" ");
  return queryTokens.every((token) =>
    option.searchTokens.some(
      (searchToken) =>
        searchToken.startsWith(token) || searchToken.includes(token)
    )
  );
}

function getVisibleOptions(options: FontOption[], query: string) {
  return options.filter((option) => matchesFontOption(option, query));
}

function useFontPicker({
  fonts,
  fontOptions,
  selectedFontId,
  setSelectedFontId,
  query,
  setQuery,
  preferredFamilies,
  fallbackFontId,
}: {
  fonts: any[];
  fontOptions: FontOption[];
  selectedFontId: number | null;
  setSelectedFontId: (fontId: number | null) => void;
  query: string;
  setQuery: (query: string) => void;
  preferredFamilies: string[];
  fallbackFontId: number | null;
}): FontPickerState {
  const deferredQuery = useDeferredValue(query);

  const preferredFontId = useMemo(() => {
    if (fonts.length === 0) return null;
    return findPreferredFontId(fonts, preferredFamilies) ?? fallbackFontId;
  }, [fallbackFontId, fonts, preferredFamilies]);

  const effectiveFontId = useMemo(() => {
    if (fonts.length === 0) return null;
    const hasSelectedFont = fonts.some((font) => font.id === selectedFontId);
    return hasSelectedFont ? selectedFontId : preferredFontId;
  }, [fonts, preferredFontId, selectedFontId]);

  const selectedFont = useMemo(
    () => fonts.find((font) => font.id === effectiveFontId) ?? null,
    [effectiveFontId, fonts]
  );

  const selectedOption = useMemo(
    () => fontOptions.find((option) => option.id === effectiveFontId) ?? null,
    [effectiveFontId, fontOptions]
  );

  const visibleOptions = useMemo(
    () => getVisibleOptions(fontOptions, deferredQuery),
    [deferredQuery, fontOptions]
  );

  const onValueChange = (option: FontOption | null) => {
    setSelectedFontId(option ? Number(option.value) : null);
    setQuery(option?.label ?? "");
  };

  return {
    query,
    setQuery,
    selectedFont,
    selectedOption,
    visibleOptions,
    onValueChange,
  };
}

function FontOptionRow({
  index,
  style,
  data,
}: ListChildComponentProps<FontOption[]>) {
  const option = data[index];

  return (
    <ComboboxItem index={index} value={option} style={style} className="px-3">
      {option.label}
    </ComboboxItem>
  );
}

interface FontPickerComboboxProps {
  label: string;
  placeholder: string;
  options: FontOption[];
  picker: FontPickerState;
}

function FontPickerCombobox({
  label,
  placeholder,
  options,
  picker,
}: FontPickerComboboxProps) {
  const { visibleOptions, selectedOption, setQuery, onValueChange } = picker;
  const listHeight = Math.min(
    visibleOptions.length * COMBOBOX_ROW_HEIGHT,
    COMBOBOX_MAX_HEIGHT
  );

  return (
    <div className="flex flex-col gap-2">
      <label className="text-muted-foreground block text-[10px] font-semibold tracking-[0.2em] uppercase">
        {label}
      </label>
      <Combobox
        items={options}
        filteredItems={visibleOptions}
        value={selectedOption}
        onInputValueChange={setQuery}
        onValueChange={onValueChange}
        itemToStringLabel={(item: any) => item?.label ?? ""}
        isItemEqualToValue={(item: any, val: any) => item?.id === val?.id}
        filter={null}
        openOnInputClick
        virtualized
      >
        <ComboboxInput placeholder={placeholder} />
        <ComboboxContent side="top" sideOffset={10}>
          <ComboboxList className="overflow-hidden p-0">
            {visibleOptions.length > 0 ? (
              <FixedSizeList
                height={listHeight}
                itemCount={visibleOptions.length}
                itemData={visibleOptions}
                itemSize={COMBOBOX_ROW_HEIGHT}
                overscanCount={8}
                width="100%"
              >
                {FontOptionRow}
              </FixedSizeList>
            ) : (
              <ComboboxEmpty className="flex py-6">
                No matching fonts found.
              </ComboboxEmpty>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}

export function FontPairingView({ fonts }: FontPairingViewProps) {
  const [selectedBaseFontId, setSelectedBaseFontId] = useState<number | null>(
    null
  );
  const [selectedBodyFontId, setSelectedBodyFontId] = useState<number | null>(
    null
  );
  const [baseFontQuery, setBaseFontQuery] = useState("");
  const [bodyFontQuery, setBodyFontQuery] = useState("");
  const [personName, setPersonName] = useState(PREVIEW_PERSON_DEFAULTS.name);
  const [personRole, setPersonRole] = useState(PREVIEW_PERSON_DEFAULTS.role);
  const [personContact, setPersonContact] = useState(
    PREVIEW_PERSON_DEFAULTS.contact
  );
  const [brandName, setBrandName] = useState(PREVIEW_BRAND_DEFAULTS.name);
  const [brandTagline, setBrandTagline] = useState(
    PREVIEW_BRAND_DEFAULTS.tagline
  );

  const representativeFonts = useMemo(
    () => getRepresentativeFonts(fonts),
    [fonts]
  );

  const fontOptions = useMemo<FontOption[]>(
    () =>
      representativeFonts.map((font) => {
        const label = font.family;
        const searchText = normalizeSearchText(
          [font.family, font.category, font.subcategory, label]
            .filter(Boolean)
            .join(" ")
        );

        return {
          id: font.id,
          value: String(font.id),
          label,
          searchText,
          searchTokens: searchText.split(" ").filter(Boolean),
        };
      }),
    [representativeFonts]
  );

  const displayPicker = useFontPicker({
    fonts: representativeFonts,
    fontOptions,
    selectedFontId: selectedBaseFontId,
    setSelectedFontId: setSelectedBaseFontId,
    query: baseFontQuery,
    setQuery: setBaseFontQuery,
    preferredFamilies: DEFAULT_DISPLAY_FONT_FAMILIES,
    fallbackFontId: representativeFonts[0]?.id ?? null,
  });

  const bodyPicker = useFontPicker({
    fonts: representativeFonts,
    fontOptions,
    selectedFontId: selectedBodyFontId,
    setSelectedFontId: setSelectedBodyFontId,
    query: bodyFontQuery,
    setQuery: setBodyFontQuery,
    preferredFamilies: DEFAULT_BODY_FONT_FAMILIES,
    fallbackFontId:
      representativeFonts.find(
        (font) => font.id !== displayPicker.selectedFont?.id
      )?.id ??
      representativeFonts[0]?.id ??
      null,
  });

  const selectedBaseFont = displayPicker.selectedFont;
  const selectedBodyFont = bodyPicker.selectedFont;

  if (!selectedBaseFont || !selectedBodyFont) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-12">
        Add a few fonts to your library to build a pairing preview.
      </div>
    );
  }

  const baseFontFamily = `pairing-base-${selectedBaseFont.id}`;
  const bodyFontFamily = `pairing-body-${selectedBodyFont.id}`;
  const baseFontPath = getPreviewPath(selectedBaseFont);
  const bodyFontPath = getPreviewPath(selectedBodyFont);

  const headingStyle = {
    fontFamily: `'${baseFontFamily}', sans-serif`,
    fontStyle: "normal" as const,
  };

  const bodyStyle = {
    fontFamily: `'${bodyFontFamily}', sans-serif`,
    fontStyle: "normal" as const,
  };

  const previewTypographyReset: CSSProperties = {
    letterSpacing: "normal",
    wordSpacing: "normal",
    fontFeatureSettings: "normal",
    fontKerning: "auto",
    fontVariantLigatures: "normal",
    textTransform: "none",
  };

  const personNameStyle: CSSProperties = {
    ...previewTypographyReset,
    ...headingStyle,
    fontSize: "clamp(2rem, 4vw, 3.5rem)",
    lineHeight: 1.25,
    minHeight: "1.35em",
  };

  const personRoleStyle: CSSProperties = {
    ...previewTypographyReset,
    ...bodyStyle,
    fontSize: "1.125rem",
    lineHeight: 1.5,
    minHeight: "1.35em",
  };

  const personContactStyle: CSSProperties = {
    ...previewTypographyReset,
    ...bodyStyle,
    fontSize: "1.125rem",
    lineHeight: 1.5,
    minHeight: "1.35em",
  };

  const brandNameStyle: CSSProperties = {
    ...previewTypographyReset,
    ...headingStyle,
    fontSize: "clamp(2.25rem, 4.4vw, 4rem)",
    lineHeight: 1.25,
    minHeight: "1.35em",
  };

  const brandTaglineStyle: CSSProperties = {
    ...previewTypographyReset,
    ...bodyStyle,
    fontSize: "1.125rem",
    lineHeight: 1.5,
    minHeight: "1.35em",
  };

  const updateContactLine = (index: number, value: string) => {
    setPersonContact((prev) =>
      prev.map((line, i) => (i === index ? value : line))
    );
  };

  const resetPreviewContent = () => {
    setPersonName(PREVIEW_PERSON_DEFAULTS.name);
    setPersonRole(PREVIEW_PERSON_DEFAULTS.role);
    setPersonContact(PREVIEW_PERSON_DEFAULTS.contact);
    setBrandName(PREVIEW_BRAND_DEFAULTS.name);
    setBrandTagline(PREVIEW_BRAND_DEFAULTS.tagline);
  };

  const shufflePairing = () => {
    if (representativeFonts.length === 0) return;

    const randomBaseIndex = Math.floor(
      Math.random() * representativeFonts.length
    );
    let randomBodyIndex = randomBaseIndex;
    if (representativeFonts.length > 1) {
      while (randomBodyIndex === randomBaseIndex) {
        randomBodyIndex = Math.floor(
          Math.random() * representativeFonts.length
        );
      }
    }

    const nextBase = representativeFonts[randomBaseIndex];
    const nextBody = representativeFonts[randomBodyIndex];
    setSelectedBaseFontId(nextBase.id);
    setSelectedBodyFontId(nextBody.id);
    setBaseFontQuery(nextBase.family);
    setBodyFontQuery(nextBody.family);
  };

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden"
      style={{
        backgroundColor: "var(--background)",
        backgroundImage:
          "radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--muted-foreground) 16%, transparent) 1px, transparent 0)",
        backgroundSize: "20px 20px",
      }}
    >
      <style>{`
        @font-face {
          font-family: '${baseFontFamily}';
          src: url('${toFontUrl(baseFontPath)}');
          font-style: normal;
          font-weight: 400;
          font-display: swap;
        }

        @font-face {
          font-family: '${bodyFontFamily}';
          src: url('${toFontUrl(bodyFontPath)}');
          font-style: normal;
          font-weight: 400;
          font-display: swap;
        }
      `}</style>

      {/* Top Drag Region & Window Controls */}
      <div
        className="draggable-region flex h-14 shrink-0 items-center justify-between bg-transparent px-6 select-none"
        data-tauri-drag-region
        onDoubleClick={(e) => {
          if (e.target === e.currentTarget) {
            getCurrentWindow().toggleMaximize().catch(console.error);
          }
        }}
      >
        <div className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground" style={{ WebkitAppRegion: "no-drag" } as any}>
          <span>Font Pairing Studio</span>
        </div>
        <WindowControls />
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-6 pt-2 pb-10 md:px-10">
        <div className="mx-auto my-auto flex w-full max-w-2xl flex-col gap-6 py-4">
          <div className="bg-card text-card-foreground border-border/60 rounded-[28px] border p-6 shadow-2xl">
              <div className="flex min-h-[270px] flex-col justify-between gap-8">
                <div className="space-y-2">
                  <Input
                    value={personName}
                    onChange={(event) => setPersonName(event.target.value)}
                    className="text-foreground h-auto w-full border-0 bg-transparent px-0 py-1 font-semibold shadow-none focus-visible:border-transparent focus-visible:ring-0"
                    style={personNameStyle}
                  />
                  <Input
                    value={personRole}
                    onChange={(event) => setPersonRole(event.target.value)}
                    className="text-muted-foreground h-auto w-full border-0 bg-transparent px-0 py-1 shadow-none focus-visible:border-transparent focus-visible:ring-0"
                    style={personRoleStyle}
                  />
                </div>

                <div
                  className="text-muted-foreground space-y-1 text-lg"
                  style={bodyStyle}
                >
                  {personContact.map((line, index) => (
                    <Input
                      key={index}
                      value={line}
                      onChange={(event) =>
                        updateContactLine(index, event.target.value)
                      }
                      className="h-auto w-full border-0 bg-transparent px-0 py-1 shadow-none focus-visible:border-transparent focus-visible:ring-0"
                      style={personContactStyle}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-primary text-primary-foreground rounded-[28px] p-6 shadow-2xl">
              <div className="flex min-h-[270px] flex-col items-center justify-center gap-4 text-center">
                <Input
                  value={brandName}
                  onChange={(event) => setBrandName(event.target.value)}
                  className="h-auto w-full border-0 bg-transparent px-0 py-1 text-center font-semibold shadow-none focus-visible:border-transparent focus-visible:ring-0"
                  style={brandNameStyle}
                />
                <Input
                  value={brandTagline}
                  onChange={(event) => setBrandTagline(event.target.value)}
                  className="text-primary-foreground/90 h-auto w-full border-0 bg-transparent px-0 py-1 text-center shadow-none focus-visible:border-transparent focus-visible:ring-0"
                  style={brandTaglineStyle}
                />
              </div>
            </div>
          </div>
        </div>

      <div className="border-border/60 bg-background/88 sticky bottom-0 z-10 border-t px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-5xl items-end justify-center gap-3">
          <FontPickerCombobox
            label="Display Font"
            placeholder="Select display font..."
            options={fontOptions}
            picker={displayPicker}
          />

          <FontPickerCombobox
            label="Body Font"
            placeholder="Select body font..."
            options={fontOptions}
            picker={bodyPicker}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={resetPreviewContent}
            aria-label="Reset content"
            title="Reset content"
          >
            <ManagedIcon name="Reset" className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            onClick={shufflePairing}
            aria-label="Shuffle pairing"
            title="Shuffle pairing"
          >
            <ManagedIcon name="Shuffle" className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
