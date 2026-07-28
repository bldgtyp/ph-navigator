// Per-side mismatch detector for the "Operation changed — picked frames may no
// longer match" warning. Uses the same operation-family matcher as FramePicker,
// so rows allowed by picker operation filtering do not immediately warn.

import { frameOperationMatchesElement } from "./picker-filters";
import { APERTURE_SIDES, type ApertureElement, type ApertureSide, type FrameRef } from "./types";

export function mismatchedSides(element: ApertureElement): ApertureSide[] {
  return APERTURE_SIDES.filter((side) => sideMismatches(element.frames[side], element));
}

function sideMismatches(frame: FrameRef | null, element: ApertureElement): boolean {
  if (frame === null) return false;
  if (frame.catalog_origin === null) return false;
  if (!frame.operation) return false;
  return !frameOperationMatchesElement(frame.operation, element.operation);
}
