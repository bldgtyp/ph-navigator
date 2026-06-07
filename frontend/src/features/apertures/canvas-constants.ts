// Scale + zoom constants for the Aperture Builder SVG canvas. Mirrors the
// envelope canvas precedent so behavior stays consistent across builders.
//
// `BASE_PX_PER_MM` keeps a 1000 mm aperture at 90 px at zoom 1.0, which gives
// the Phase 03 substrate roughly the same on-screen weight as the V1 Window
// Builder screenshots.

export const BASE_PX_PER_MM = 0.09;
export const MIN_CANVAS_WIDTH_PX = 360;
export const ZOOM_STEPS = [0.5, 0.75, 1.0, 1.5, 2.0, 3.0] as const;
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

// Snap an arbitrary zoom value to the nearest discrete step. Used by `Fit` so
// the resulting state is always one of the canonical `ZOOM_STEPS` entries.
export function snapZoomToStep(target: number): number {
  let best = ZOOM_STEPS[0] as number;
  let bestDelta = Math.abs(target - best);
  for (const step of ZOOM_STEPS) {
    const delta = Math.abs(target - step);
    if (delta < bestDelta) {
      best = step;
      bestDelta = delta;
    }
  }
  return best;
}

function zoomBoundary(index: number): (typeof ZOOM_STEPS)[number] {
  const step = ZOOM_STEPS[index];
  if (step === undefined) throw new Error("Zoom steps must define min and max values.");
  return step;
}
