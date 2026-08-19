import { ZOOM_MAX, containFitZoom, pxFromMm } from "./canvas-constants";

export const INSTALL_PREVIEW_PADDING_PX = 16;
export const INSTALL_PREVIEW_MAX_ZOOM = ZOOM_MAX;

export type InstallPreviewViewport = {
  zoom: number;
  widthPx: number;
  heightPx: number;
  originX: number;
  originY: number;
};

/** Fit the complete aperture inside measured preview bounds with one zoom and origin. */
export function fitInstallPreview({
  availableWidthPx,
  availableHeightPx,
  apertureWidthMm,
  apertureHeightMm,
  paddingPx = INSTALL_PREVIEW_PADDING_PX,
  maxZoom = INSTALL_PREVIEW_MAX_ZOOM,
}: {
  availableWidthPx: number;
  availableHeightPx: number;
  apertureWidthMm: number;
  apertureHeightMm: number;
  paddingPx?: number;
  maxZoom?: number;
}): InstallPreviewViewport | null {
  const innerWidthPx = availableWidthPx - paddingPx * 2;
  const innerHeightPx = availableHeightPx - paddingPx * 2;
  if (
    !(innerWidthPx > 0) ||
    !(innerHeightPx > 0) ||
    !(apertureWidthMm > 0) ||
    !(apertureHeightMm > 0) ||
    !(maxZoom > 0)
  ) {
    return null;
  }

  const zoom = containFitZoom({
    widthMm: apertureWidthMm,
    heightMm: apertureHeightMm,
    availableWidthPx: innerWidthPx,
    availableHeightPx: innerHeightPx,
    maxZoom,
  });
  if (zoom === null) return null;
  const widthPx = pxFromMm(apertureWidthMm, zoom);
  const heightPx = pxFromMm(apertureHeightMm, zoom);

  return {
    zoom,
    widthPx,
    heightPx,
    originX: (availableWidthPx - widthPx) / 2,
    originY: (availableHeightPx - heightPx) / 2,
  };
}
