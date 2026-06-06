// Collect distinct manufacturer names referenced by any element in the
// apertures slice. Used by the ManufacturerFiltersModal to:
//
//   - lock the in-use rows (always-checked, disabled with tooltip), and
//   - guard the Clear-all bulk action so it skips them.
//
// Comparison against the enabled list is case-insensitive, but the
// returned strings preserve their on-document casing so the modal can
// show the user-visible name. Sorted case-insensitively to match the
// catalog-roster ordering.

import type { ApertureTypeEntry, ApertureSide } from "../types";

export type ManufacturerKind = "frame_types" | "glazing_types";

const SIDES: ApertureSide[] = ["top", "right", "bottom", "left"];

export function inUseManufacturers(
  apertures: ApertureTypeEntry[],
  kind: ManufacturerKind,
): string[] {
  const seen = new Map<string, string>();
  for (const apt of apertures) {
    for (const el of apt.elements) {
      if (kind === "frame_types") {
        for (const side of SIDES) {
          const manu = el.frames[side]?.manufacturer;
          if (manu && manu.trim()) {
            seen.set(manu.trim().toLowerCase(), manu.trim());
          }
        }
      } else {
        const manu = el.glazing?.manufacturer;
        if (manu && manu.trim()) {
          seen.set(manu.trim().toLowerCase(), manu.trim());
        }
      }
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

// Case-insensitive membership test for the enabled list. ``null`` means
// "all enabled" — every manufacturer is implicitly a member.
export function isManufacturerEnabled(manufacturer: string, enabled: string[] | null): boolean {
  if (enabled === null) return true;
  const target = manufacturer.trim().toLowerCase();
  return enabled.some((m) => m.trim().toLowerCase() === target);
}
