// Interior-view label flip.
//
// The aperture document stores frame sides in *canonical* (exterior)
// orientation. When the canvas renders interior view, the visible left
// rect corresponds to the canonical right frame and vice-versa. Card
// row labels and region-click pickers go through these helpers so the
// document field never gets confused for the visible side.

import type { ApertureSide } from "./types";

export type ViewDirection = "exterior" | "interior";

/** Map a *visible* (on-canvas) side to the *canonical* (document) side. */
export function visualSideToCanonical(visible: ApertureSide, view: ViewDirection): ApertureSide {
  if (view === "exterior") return visible;
  if (visible === "left") return "right";
  if (visible === "right") return "left";
  return visible;
}

/** Map a *canonical* (document) side to the *visible* (on-canvas) side. */
export function canonicalSideToVisual(canonical: ApertureSide, view: ViewDirection): ApertureSide {
  // Symmetric — left ↔ right swap only fires in interior view.
  return visualSideToCanonical(canonical, view);
}

const SIDE_LABEL_BASE: Record<ApertureSide, string> = {
  top: "Top Frame",
  right: "Right Frame",
  bottom: "Bottom Frame",
  left: "Left Frame",
};

/** Visible-order label for the row showing the given canonical side. */
export function frameRowLabel(canonical: ApertureSide, view: ViewDirection): string {
  return SIDE_LABEL_BASE[canonicalSideToVisual(canonical, view)];
}
