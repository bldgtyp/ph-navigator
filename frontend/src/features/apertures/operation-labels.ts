// Read-only display label for an element's operation. Reused by the
// locked / Viewer card view, by the OperationRow when the editor is
// disabled, and by the preset menu's "this preset's payload formats
// as…" check. Matches PRD §11.3:
//
//   null                                  → "Fixed"
//   { type: swing, directions: [] }       → "Swing"
//   { type: swing, directions: [l, u] }   → "Swing (Left, Up)"
//
// Direction order is preserved (the editor controls the order via
// toggle interaction order, presets supply their own).

import type { ApertureOperation, ApertureOperationDirection } from "./types";

const TYPE_LABEL: Record<"swing" | "slide", string> = {
  swing: "Swing",
  slide: "Slide",
};

const DIRECTION_LABEL: Record<ApertureOperationDirection, string> = {
  left: "Left",
  right: "Right",
  up: "Up",
  down: "Down",
};

export function formatOperation(op: ApertureOperation | null): string {
  if (op === null) return "Fixed";
  const type = TYPE_LABEL[op.type];
  if (op.directions.length === 0) return type;
  return `${type} (${op.directions.map((d) => DIRECTION_LABEL[d]).join(", ")})`;
}
