import { SegmentedControl } from "../../../shared/ui/SegmentedControl";
import { useModelViewerStore } from "../store";
import type { ModelViewerLens, ModelViewerTheme, ShadingFactorSeason } from "../types";
import { ThemeMenu } from "./ThemeMenu";

const SEASON_OPTIONS = [
  { value: "summer", label: "Summer" },
  { value: "winter", label: "Winter" },
] as const;

export function ModelColorOptions({
  lens,
  theme,
}: {
  lens: ModelViewerLens;
  theme: ModelViewerTheme;
}) {
  const season = useModelViewerStore((state) => state.shadingFactorSeason);
  const setSeason = useModelViewerStore((state) => state.setShadingFactorSeason);
  return (
    <div className="model-color-options">
      <ThemeMenu lens={lens} theme={theme} />
      {theme === "shading-factor" ? (
        <div className="model-shading-season-control">
          <span className="model-shading-season-label">Season</span>
          <SegmentedControl<ShadingFactorSeason>
            value={season}
            onChange={setSeason}
            ariaLabel="Shading factor season"
            options={SEASON_OPTIONS}
            size="xs"
            equalWidth
          />
        </div>
      ) : null}
    </div>
  );
}
