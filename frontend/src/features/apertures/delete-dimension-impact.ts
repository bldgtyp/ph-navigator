// Quiet-vs-confirm decision for row / column deletion.
//
// The phase doc compares frame/glazing refs to seeded
// `catalog_origin.catalog_record_id` values. Those default record ids
// are not exposed to the frontend yet (Alembic seed is also still
// deferred), so we approximate: an element counts as "customized"
// when the user has given it a name (anything but "Unnamed") or set an
// operation. Frame / glazing swaps will fold into this check once the
// pickers ship in Phases 06+; for now an unnamed + no-operation
// element is treated as a stock default. The check is intentionally
// conservative — false positives (asking to confirm) are safe; false
// negatives (deleting silently) would lose user work, so the rule
// errs toward asking.

import type { ApertureElement, ApertureTypeEntry } from "./types";

export type DeleteDimensionImpact = {
  customizedCount: number;
  totalCount: number;
};

function isCustomized(element: ApertureElement): boolean {
  if (element.name.trim() !== "Unnamed") return true;
  if (element.operation !== null) return true;
  return false;
}

function overlapsRow(element: ApertureElement, rowIndex: number): boolean {
  const [start, end] = element.row_span;
  return start <= rowIndex && rowIndex <= end;
}

function overlapsColumn(element: ApertureElement, columnIndex: number): boolean {
  const [start, end] = element.column_span;
  return start <= columnIndex && columnIndex <= end;
}

export function deleteRowImpact(
  aperture: ApertureTypeEntry,
  rowIndex: number,
): DeleteDimensionImpact {
  const affected = aperture.elements.filter((e) => overlapsRow(e, rowIndex));
  return {
    customizedCount: affected.filter(isCustomized).length,
    totalCount: affected.length,
  };
}

export function deleteColumnImpact(
  aperture: ApertureTypeEntry,
  columnIndex: number,
): DeleteDimensionImpact {
  const affected = aperture.elements.filter((e) => overlapsColumn(e, columnIndex));
  return {
    customizedCount: affected.filter(isCustomized).length,
    totalCount: affected.length,
  };
}
