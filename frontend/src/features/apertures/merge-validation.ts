// Client-side gate for the Merge toolbar button. Computes whether
// the currently-selected element ids form a contiguous rectangle
// (no holes, no overlaps, no L-shapes). The backend re-validates,
// but doing the check up-front lets us surface a toast immediately
// instead of round-tripping to a 422.
//
// The union bounding span is exposed on success so the caller can
// log it for the audit toast.

import type { ApertureElement, ApertureTypeEntry } from "./types";

export type MergeValidation =
  | {
      ok: true;
      merged: { row_span: [number, number]; column_span: [number, number] };
      sources: ApertureElement[];
    }
  | { ok: false; reason: "too-few" | "non-rectangle" | "overlap"; message: string };

export function validateMergeSelection(
  aperture: ApertureTypeEntry,
  selectedIds: readonly string[],
): MergeValidation {
  const sources = aperture.elements.filter((e) => selectedIds.includes(e.id));
  if (sources.length < 2) {
    return { ok: false, reason: "too-few", message: "Select at least two elements to merge." };
  }
  const r0 = Math.min(...sources.map((e) => e.row_span[0]));
  const r1 = Math.max(...sources.map((e) => e.row_span[1]));
  const c0 = Math.min(...sources.map((e) => e.column_span[0]));
  const c1 = Math.max(...sources.map((e) => e.column_span[1]));

  const covered = new Set<string>();
  for (const el of sources) {
    for (let r = el.row_span[0]; r <= el.row_span[1]; r++) {
      for (let c = el.column_span[0]; c <= el.column_span[1]; c++) {
        const key = `${r},${c}`;
        if (covered.has(key)) {
          return { ok: false, reason: "overlap", message: "Selection has overlapping cells." };
        }
        covered.add(key);
      }
    }
  }
  const expected = (r1 - r0 + 1) * (c1 - c0 + 1);
  if (covered.size !== expected) {
    return {
      ok: false,
      reason: "non-rectangle",
      message: "Selection isn't a rectangle. Pick contiguous cells to merge.",
    };
  }
  return { ok: true, merged: { row_span: [r0, r1], column_span: [c0, c1] }, sources };
}

/** The element with the smallest (row_span[0], column_span[0]) — the
 *  one whose assignments propagate to the merged element. */
export function topLeftSource(sources: readonly ApertureElement[]): ApertureElement {
  return [...sources].sort((a, b) => {
    if (a.row_span[0] !== b.row_span[0]) return a.row_span[0] - b.row_span[0];
    return a.column_span[0] - b.column_span[0];
  })[0]!;
}
