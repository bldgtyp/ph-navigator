import type { LensAvailability } from "../loaders/building";
import type { ModelViewerLens } from "../types";

export type LensDefinition = {
  id: ModelViewerLens;
  label: string;
  emptyTooltip: string;
};

export const MODEL_VIEWER_LENSES: LensDefinition[] = [
  { id: "building", label: "Building", emptyTooltip: "No building geometry in this model" },
  { id: "spaces", label: "Spaces", emptyTooltip: "No spaces in this model" },
  { id: "floor-areas", label: "Floor Areas", emptyTooltip: "No floor segments in this model" },
  { id: "site-sun", label: "Site & Sun", emptyTooltip: "Coming with project location" },
  { id: "ventilation", label: "Ventilation", emptyTooltip: "No ventilation ducting in this model" },
  { id: "hot-water", label: "Hot Water", emptyTooltip: "No hot-water piping in this model" },
];

export const MODEL_VIEWER_LENS_IDS = MODEL_VIEWER_LENSES.map((lens) => lens.id);

export function parseModelViewerLens(value: string | null): ModelViewerLens {
  return isModelViewerLens(value) ? value : "building";
}

export function isModelViewerLens(value: string | null): value is ModelViewerLens {
  return value !== null && MODEL_VIEWER_LENS_IDS.includes(value as ModelViewerLens);
}

export function disabledLensReason(
  lens: ModelViewerLens,
  availability: LensAvailability | null,
): string | null {
  if (!availability) return null;
  if (availability[lens]) return null;
  return MODEL_VIEWER_LENSES.find((definition) => definition.id === lens)?.emptyTooltip ?? null;
}

export function labelForLens(lens: ModelViewerLens): string {
  return MODEL_VIEWER_LENSES.find((definition) => definition.id === lens)?.label ?? lens;
}
