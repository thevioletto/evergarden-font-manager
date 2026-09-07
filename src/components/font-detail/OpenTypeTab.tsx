import { cn } from "@/lib/utils";
import { getFeatureInfo, getFeatureSample } from "@/lib/font-utils";

interface OpenTypeTabProps {
  activeTab: string;
  supportedFeatures: Set<string>;
  getTypographyStyle: (
    baseFontSize?: number,
    settings?: { featureSettings?: string }
  ) => React.CSSProperties;
}

export function OpenTypeTab({
  activeTab,
  supportedFeatures,
  getTypographyStyle,
}: OpenTypeTabProps) {
  return (
    <section
      className={cn(
        "mx-auto w-full max-w-5xl space-y-10 p-12",
        activeTab !== "ot" && "hidden"
      )}
    >
      <div className="border-b pb-8">
        <h2 className="mb-2 text-2xl font-semibold">OpenType Features</h2>
        <p className="text-muted-foreground">
          This font supports {supportedFeatures.size} OpenType features.
        </p>
      </div>

      {Array.from(supportedFeatures)
        .sort()
        .map((featureTag) => {
          const sample = getFeatureSample(featureTag);
          const featureInfo = getFeatureInfo(featureTag);

          return (
            <div key={featureTag} className="space-y-4">
              <div className="flex items-baseline gap-4">
                <h3 className="text-primary font-mono text-lg font-bold">
                  {featureTag}
                </h3>
                <span className="text-muted-foreground text-sm">
                  {featureInfo.label}
                </span>
              </div>

              <div className="bg-secondary/20 grid grid-cols-1 gap-4 rounded-lg p-6 md:grid-cols-2">
                <div>
                  <p className="text-muted-foreground mb-2 text-[10px] tracking-wider uppercase">
                    Off
                  </p>
                  <p
                    className="text-3xl"
                    style={getTypographyStyle(32, {
                      featureSettings: `"${featureTag}" 0`,
                    })}
                  >
                    {sample}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-2 text-[10px] tracking-wider uppercase">
                    On
                  </p>
                  <p
                    className="text-3xl"
                    style={getTypographyStyle(32, {
                      featureSettings: `"${featureTag}" 1`,
                    })}
                  >
                    {sample}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

      {supportedFeatures.size === 0 && (
        <div className="text-muted-foreground py-12 text-center">
          No OpenType features detected.
        </div>
      )}
    </section>
  );
}
