// Picker filter primitives shared by FramePicker and region-click
// open-picker wiring. Side families intentionally include literal
// ``Any`` rows, while operation families keep catalog labels intact and
// compare against normalized labels only.

import type { ApertureOperation, ApertureSide } from "./types";
import type { CatalogFrameType } from "../catalogs/types";

export type FrameLocation = "head" | "sill" | "jamb";
export type FrameSideLocation = "head" | "jamb" | "sill";

export function locationForSide(side: ApertureSide): FrameLocation {
  if (side === "top") return "head";
  if (side === "bottom") return "sill";
  return "jamb";
}

export type OperationFilter = {
  type: "Fixed" | "Swing" | "Slide";
  directions: ("Left" | "Right" | "Up" | "Down")[];
};

const DIRECTION_CAP: Record<"left" | "right" | "up" | "down", "Left" | "Right" | "Up" | "Down"> = {
  left: "Left",
  right: "Right",
  up: "Up",
  down: "Down",
};

export function operationForElement(operation: ApertureOperation | null): OperationFilter {
  if (operation === null) return { type: "Fixed", directions: [] };
  return {
    type: operation.type === "swing" ? "Swing" : "Slide",
    directions: operation.directions.map((d) => DIRECTION_CAP[d]),
  };
}

const SIDE_LOCATION_FAMILIES: Record<ApertureSide, readonly string[]> = {
  top: ["Head", "Any"],
  right: ["Jamb", "Any"],
  bottom: ["Sill", "Any"],
  left: ["Jamb", "Any"],
};

const OPERATION_FAMILIES: Record<OperationFilter["type"], readonly string[]> = {
  Fixed: ["Fixed"],
  Swing: [
    "Swing",
    "Inswing",
    "Outswing",
    "Casement",
    "Awning",
    "Hopper",
    "Tilt-Turn",
    "Double-Hung",
  ],
  Slide: ["Slide", "Sliding", "Double-Hung"],
};

export function sideLocationFamily(side: ApertureSide): readonly string[] {
  return SIDE_LOCATION_FAMILIES[side];
}

export function operationFamilyForElement(operation: ApertureOperation | null): readonly string[] {
  return OPERATION_FAMILIES[operationForElement(operation).type];
}

export function frameLocationMatchesSide(rowLocation: string | null, side: ApertureSide): boolean {
  if (rowLocation === null) return false;
  const normalized = normalizeCatalogLabel(rowLocation);
  return sideLocationFamily(side).some(
    (candidate) => normalizeCatalogLabel(candidate) === normalized,
  );
}

export function frameOperationMatchesElement(
  frameOperation: string | null,
  operation: ApertureOperation | null,
): boolean {
  if (frameOperation === null) return false;
  const normalized = normalizeCatalogLabel(frameOperation);
  return operationFamilyForElement(operation).some(
    (candidate) => normalizeCatalogLabel(candidate) === normalized,
  );
}

export function filterFrameRows(
  rows: readonly CatalogFrameType[],
  {
    side,
    operation,
    filterFramesBySide,
    filterFramesByOperation,
  }: {
    side: ApertureSide;
    operation: ApertureOperation | null;
    filterFramesBySide: boolean;
    filterFramesByOperation: boolean;
  },
): CatalogFrameType[] {
  return rows.filter((row) => {
    if (filterFramesBySide && !frameLocationMatchesSide(row.location, side)) return false;
    if (filterFramesByOperation && !frameOperationMatchesElement(row.operation, operation)) {
      return false;
    }
    return true;
  });
}

function normalizeCatalogLabel(value: string): string {
  return value
    .trim()
    .replace(/\s*\([^)]*\)\s*$/, "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}
