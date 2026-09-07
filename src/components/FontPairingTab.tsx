import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toFontUrl } from "@/lib/font-utils";

interface FontPairingTabProps {
  currentFont: any;
}

interface GoogleFont {
  family: string;
  category: string;
}

export function FontPairingTab({ currentFont }: FontPairingTabProps) {
  const [localFonts, setLocalFonts] = useState<any[]>([]);
  const [googleFonts, setGoogleFonts] = useState<GoogleFont[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(true);
  const [loadingGoogle, setLoadingGoogle] = useState(true);
  const [specimenText, setSpecimenText] = useState(
    "Typography is the craft of endowing human language with a durable visual form."
  );

  useEffect(() => {
    async function fetchLocalFonts() {
      const fonts = await invoke<any[]>("get_fonts_cmd");
      setLocalFonts(fonts);
      setLoadingLocal(false);
    }
    fetchLocalFonts().catch(() => setLoadingLocal(false));
  }, []);

  useEffect(() => {
    async function fetchGoogleFonts() {
      try {
        const res = await fetch("https://fonts.google.com/metadata/fonts");
        if (!res.ok) throw new Error("Failed to fetch Google Fonts");
        const json = await res.json();
        if (json.familyMetadataList) {
          setGoogleFonts(json.familyMetadataList);
        }
      } catch (err) {
        console.error("Error fetching Google Fonts:", err);
      }
      setLoadingGoogle(false);
    }
    fetchGoogleFonts();
  }, []);

  const currentSubcategory = (currentFont.subcategory || "")
    .trim()
    .toLowerCase();

  // Determine ideal pairing category
  const targetSubcategories = useMemo(() => {
    if (currentSubcategory === "serif") return ["sans serif", "sans-serif"];
    if (
      currentSubcategory === "sans serif" ||
      currentSubcategory === "sans-serif"
    )
      return ["serif"];
    return ["sans serif", "sans-serif", "serif"]; // Default fallback
  }, [currentSubcategory]);

  const localPairs = useMemo(() => {
    return localFonts
      .filter((f) => {
        if (f.family === currentFont.family) return false;
        const sub = (f.subcategory || "").trim().toLowerCase();
        return targetSubcategories.includes(sub);
      })
      .slice(0, 5); // Take top 5
  }, [localFonts, currentFont, targetSubcategories]);

  const googlePairs = useMemo(() => {
    // Google API categories: "SERIF", "SANS_SERIF", "DISPLAY", "HANDWRITING", "MONOSPACE"
    const targetGoogleCat =
      currentSubcategory === "serif" ? "SANS_SERIF" : "SERIF";
    return googleFonts
      .filter((gf) => {
        if (gf.family === currentFont.family) return false;
        return (
          gf.category === targetGoogleCat ||
          gf.category === targetGoogleCat.replace("_", " ")
        );
      })
      .slice(0, 5); // Take top 5
  }, [googleFonts, currentFont, currentSubcategory]);

  const headerStyle = {
    fontFamily: `'font-detail-${currentFont.id}', sans-serif`,
  };

  return (
    <div className="space-y-12">
      <div className="border-b pb-8">
        <h2 className="mb-2 text-2xl font-semibold">
          Font Pairing Suggestions
        </h2>
        <p className="text-muted-foreground">
          Discover fonts that pair perfectly with{" "}
          <strong>{currentFont.family}</strong> for both local application use
          and web projects.
        </p>
        <div className="mt-4">
          <label className="text-muted-foreground mb-2 block text-xs tracking-widest uppercase">
            Custom Preview Text
          </label>
          <input
            type="text"
            className="bg-secondary/30 focus:border-primary w-full rounded-lg border px-4 py-2 text-sm transition-colors outline-none"
            value={specimenText}
            onChange={(e) => setSpecimenText(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-12">
        {/* Local Pairings */}
        <div className="space-y-6">
          <h3 className="flex items-center gap-2 text-xl font-medium">
            <span className="bg-primary/20 text-primary rounded-md px-2 py-1 text-xs font-bold tracking-wider uppercase">
              Local
            </span>
            Installed Fonts
          </h3>
          {loadingLocal ? (
            <div className="text-muted-foreground text-sm">
              Loading local fonts...
            </div>
          ) : localPairs.length > 0 ? (
            <div className="grid gap-6">
              {localPairs.map((pair) => {
                const pairId = `pair-local-${pair.id}`;
                return (
                  <div
                    key={pair.id}
                    className="bg-secondary/10 hover:bg-secondary/20 rounded-xl border p-6 transition-colors"
                  >
                    <style>{`
                      @font-face {
                        font-family: '${pairId}';
                        src: url('${toFontUrl(pair.file_path)}');
                      }
                    `}</style>
                    <div className="flex flex-col gap-4">
                      <div className="text-muted-foreground flex items-center justify-between text-xs tracking-widest uppercase">
                        <span>{currentFont.family} (Heading)</span>
                        <span>{pair.family} (Body)</span>
                      </div>

                      {/* Heading in current font */}
                      <h4
                        className="text-4xl leading-tight"
                        style={headerStyle}
                      >
                        Heading goes here
                      </h4>

                      {/* Body in paired font */}
                      <p
                        className="text-foreground/80 text-lg leading-relaxed"
                        style={{ fontFamily: `'${pairId}', sans-serif` }}
                      >
                        {specimenText}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">
              No matching local fonts found. Try importing more{" "}
              {targetSubcategories[0]} fonts.
            </div>
          )}
        </div>

        {/* Google Fonts Pairings */}
        <div className="space-y-6">
          <h3 className="flex items-center gap-2 text-xl font-medium">
            <span className="rounded-md bg-emerald-500/20 px-2 py-1 text-xs font-bold tracking-wider text-emerald-500 uppercase">
              Online
            </span>
            Google Fonts
          </h3>
          {loadingGoogle ? (
            <div className="text-muted-foreground text-sm">
              Loading Google Fonts...
            </div>
          ) : googlePairs.length > 0 ? (
            <div className="grid gap-6">
              {googlePairs.map((pair) => {
                const familyUrl = pair.family.replace(/\s+/g, "+");
                return (
                  <div
                    key={pair.family}
                    className="bg-secondary/10 hover:bg-secondary/20 rounded-xl border p-6 transition-colors"
                  >
                    <link
                      href={`https://fonts.googleapis.com/css2?family=${familyUrl}&display=swap`}
                      rel="stylesheet"
                    />
                    <div className="flex flex-col gap-4">
                      <div className="text-muted-foreground flex items-center justify-between text-xs tracking-widest uppercase">
                        <span>{currentFont.family} (Heading)</span>
                        <a
                          href={`https://fonts.google.com/specimen/${familyUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-primary flex items-center gap-1 transition-colors"
                        >
                          {pair.family} (Body)
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                          </svg>
                        </a>
                      </div>

                      <h4
                        className="text-4xl leading-tight"
                        style={headerStyle}
                      >
                        Heading goes here
                      </h4>

                      <p
                        className="text-foreground/80 text-lg leading-relaxed"
                        style={{ fontFamily: `"${pair.family}", sans-serif` }}
                      >
                        {specimenText}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">
              No Google Fonts pairings found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
