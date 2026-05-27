// These values preserve the existing rough wireframe calibration; UI polish can tune them in one place.
export const BASE_PX_PER_MM = 0.18;
export const MIN_LAYER_HEIGHT_PX = 30;
export const MIN_SEGMENT_WIDTH_PX = 72;
export const MIN_CANVAS_WIDTH_PX = 360;
export const MIN_LAYER_WIDTH_PERCENT = 12;
export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 2;
export const ZOOM_STEP = 0.1;

export function pxFromMm(mm: number, zoom: number, minPx: number): number {
  return Math.max(minPx, mm * BASE_PX_PER_MM * zoom);
}
