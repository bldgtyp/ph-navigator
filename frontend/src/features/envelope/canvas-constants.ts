export const BASE_PX_PER_MM = 0.18;
export const DIMENSION_COLUMN_WIDTH_PX = 56;
export const DIMENSION_GAP_PX = 12;
export const ASSEMBLY_CANVAS_ORIGIN_X_PX = DIMENSION_COLUMN_WIDTH_PX + DIMENSION_GAP_PX;
export const MIN_CANVAS_WIDTH_PX = 360;
export const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 3] as const;
export const ZOOM_MIN = zoomBoundary(0);
export const ZOOM_MAX = zoomBoundary(ZOOM_STEPS.length - 1);

export function pxFromMm(mm: number, zoom: number): number {
  return mm * BASE_PX_PER_MM * zoom;
}

export function nextZoomStep(current: number): number {
  return ZOOM_STEPS.find((step) => step > current) ?? ZOOM_MAX;
}

export function previousZoomStep(current: number): number {
  for (let index = ZOOM_STEPS.length - 1; index >= 0; index -= 1) {
    const step = ZOOM_STEPS[index];
    if (step !== undefined && step < current) return step;
  }
  return ZOOM_MIN;
}

function zoomBoundary(index: number): (typeof ZOOM_STEPS)[number] {
  const step = ZOOM_STEPS[index];
  if (step === undefined) throw new Error("Zoom steps must define min and max values.");
  return step;
}
