export const BASE_PX_PER_MM = 1;
export const DIMENSION_COLUMN_WIDTH_PX = 56;
export const DIMENSION_GAP_PX = 12;
export const ASSEMBLY_CANVAS_ORIGIN_X_PX = DIMENSION_COLUMN_WIDTH_PX + DIMENSION_GAP_PX;
export const MIN_CANVAS_WIDTH_PX = 360;
export const SVG_STROKE_PADDING_MM = 1;
export const ASSEMBLY_CANVAS_BOTTOM_SAFETY_GUTTER_PX = 2;
// Membranes are drawn at a fixed nominal thickness instead of 1:1, because a
// real one (a 0.15 mm WRB) would be sub-pixel at every usable zoom. Expressed
// in millimetres so it rides the same viewBox transform as everything else:
// the hairline scales with zoom like the rest of the section, and stays
// legible even at the 0.5x floor.
export const MEMBRANE_DISPLAY_THICKNESS_MM = 4;
// A drawn membrane band is only a few pixels tall, which is fine to look at
// and impossible to click — a neighbouring 140 mm layer wins the hit test
// every time. The overlay therefore grows to this minimum, centred on the
// band, so the membrane stays selectable. The overhang eats a few pixels at
// the edge of each neighbour; that is a far better trade than a layer the
// user cannot open.
export const MEMBRANE_MIN_HIT_HEIGHT_PX = 14;
export const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 3] as const;
export const ZOOM_MIN = zoomBoundary(0);
export const ZOOM_MAX = zoomBoundary(ZOOM_STEPS.length - 1);

export function pxFromMm(mm: number, zoom: number): number {
  return Number.parseFloat((mm * BASE_PX_PER_MM * zoom).toFixed(4));
}

export function fitZoomForCanvasWidth(widthMm: number, availableWidthPx: number): number {
  const drawableWidthPx = availableWidthPx - ASSEMBLY_CANVAS_ORIGIN_X_PX;
  if (widthMm <= 0 || drawableWidthPx <= 0) return ZOOM_MIN;

  const maxFittingZoom = drawableWidthPx / (widthMm * BASE_PX_PER_MM);
  const cappedZoom = Math.min(1, maxFittingZoom);

  for (let index = ZOOM_STEPS.length - 1; index >= 0; index -= 1) {
    const step = ZOOM_STEPS[index];
    if (step !== undefined && step <= cappedZoom) return step;
  }
  return ZOOM_MIN;
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
