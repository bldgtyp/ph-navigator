// Picker filter primitives shared by FramePicker and the region-click
// open-picker wiring. ``locationForSide`` maps a canonical frame side
// to the catalog ``location`` token (head / sill / jamb). The mapping
// is symmetric for left and right because both jambs share the same
// catalog filter — view direction is applied separately in the
// frame-label layer, not here.
//
// ``operationForElement`` derives the catalog ``operation`` query value
// from the element's current operation. For Fixed elements we pass
// ``"Fixed"``; for swing/slide elements we pass the type label.
// Directions don't flow into the catalog filter directly — the catalog
// only stores the operation family — but they're carried on the return
// so the picker subtitle line can show direction context if needed.

import type { ApertureOperation, ApertureSide } from "./types";

export type FrameLocation = "head" | "sill" | "jamb";

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
