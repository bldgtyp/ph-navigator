import { Box, Building2, Droplets, Layers3, Sun, Wind } from "lucide-react";
import { disabledLensReason, MODEL_VIEWER_LENSES } from "../lib/lenses";
import type { LensAvailability } from "../loaders/building";
import { useModelViewerStore } from "../store";
import type { ModelViewerLens } from "../types";

type LensBarProps = {
  availability: LensAvailability | null;
};

export function LensBar({ availability }: LensBarProps) {
  const activeLens = useModelViewerStore((state) => state.lens);
  const setLens = useModelViewerStore((state) => state.setLens);

  return (
    <div className="model-lens-bar" role="toolbar" aria-label="Model viewing lens">
      <div className="model-lens-segments">
        {MODEL_VIEWER_LENSES.map((lens) => {
          const disabledReason = disabledLensReason(lens.id, availability);
          const disabled = disabledReason !== null;
          const Icon = iconForLens(lens.id);
          return (
            <button
              key={lens.id}
              type="button"
              className={
                activeLens === lens.id ? "model-lens-segment is-active" : "model-lens-segment"
              }
              disabled={disabled}
              title={disabledReason ?? lens.label}
              aria-label={lens.label}
              aria-pressed={activeLens === lens.id}
              onClick={() => {
                if (activeLens !== lens.id) setLens(lens.id);
              }}
            >
              <Icon size={15} aria-hidden />
              <span>{lens.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function iconForLens(lens: ModelViewerLens) {
  switch (lens) {
    case "building":
      return Building2;
    case "spaces":
      return Box;
    case "floor-areas":
      return Layers3;
    case "site-sun":
      return Sun;
    case "ventilation":
      return Wind;
    case "hot-water":
      return Droplets;
  }
}
