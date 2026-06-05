// Per-side mismatch detector for the "Operation changed — picked
// frames may no longer match" warning. Compares the element's current
// operation against each picked frame's catalog ``operation`` field.
// Hand-entered frames (``catalog_origin === null``) and frames with a
// null catalog ``operation`` are skipped: there's nothing to compare.
//
// The match comparison is exact-string on the lower-cased,
// whitespace-trimmed form of ``formatOperation(element.operation)``
// against ``normalize(frame.operation)``. Catalog rows that want to
// match a Swing element should stamp their ``operation`` field as
// "Swing" (or the more specific "Swing (Left, Up)" for tight matches).
// Free-form values like "Casement" report as mismatched until the
// user re-picks or dismisses; that's intentional — the warning is a
// nudge, not an enforcement.

import { formatOperation } from "./operation-labels";
import type { ApertureElement, ApertureSide, FrameRef } from "./types";

const FRAME_SIDES: readonly ApertureSide[] = ["top", "right", "bottom", "left"];

export function mismatchedSides(element: ApertureElement): ApertureSide[] {
  const elementToken = elementOperationToken(element);
  return FRAME_SIDES.filter((side) => sideMismatches(element.frames[side], elementToken));
}

function sideMismatches(frame: FrameRef | null, elementToken: string | null): boolean {
  if (frame === null) return false;
  if (frame.catalog_origin === null) return false;
  if (!frame.operation) return false;
  if (elementToken === null) return false;
  return normalize(frame.operation) !== elementToken;
}

function elementOperationToken(element: ApertureElement): string | null {
  if (element.operation === null) return "fixed";
  return normalize(formatOperation(element.operation));
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
