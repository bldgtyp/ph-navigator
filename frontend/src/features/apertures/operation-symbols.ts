// Pure geometry for the on-canvas operation symbols. Swing draws two
// dashed lines from the *hinge edge* midpoint to the opposite glazing
// corners; slide draws an arrow at the glazing center pointing in the
// direction. Interior view flips left ↔ right at the renderer; the
// underlying `operation.directions` array is never mutated.

import type { ApertureOperationDirection } from "./types";

export type RectLike = { x: number; y: number; width: number; height: number };
export type Segment = { x1: number; y1: number; x2: number; y2: number };

export type ViewDirection = "exterior" | "interior";

const ARROW_SHAFT_FRACTION = 0.8;
// Slim arrowhead: length along the shaft is greater than its half-width across
// the shaft, so the head reads as a narrow point rather than the old stubby,
// wider-than-long wedge.
const ARROW_HEAD_LENGTH_FRACTION = 0.13;
const ARROW_HEAD_HALF_WIDTH_FRACTION = 0.05;
// Perpendicular nudge that shifts the arrow off the glazing center so the
// element's name pill (also centered) no longer covers it: horizontal arrows
// drop below center, vertical arrows step beside it. Expressed as a fraction of
// the perpendicular glazing dimension so the whole arrow stays inside the rect.
const ARROW_LABEL_CLEARANCE_FRACTION = 0.2;

export function flipForView(
  direction: ApertureOperationDirection,
  view: ViewDirection,
): ApertureOperationDirection {
  if (view === "exterior") return direction;
  if (direction === "left") return "right";
  if (direction === "right") return "left";
  return direction;
}

/** Two dashed line segments from the hinge-edge midpoint to the two
 *  opposite glazing corners. Caller paints with
 *  ``stroke-dasharray="4,3"`` and ``stroke="var(--aperture-operation-
 *  symbol)"``. */
export function swingLines(
  glazing: RectLike,
  direction: ApertureOperationDirection,
  view: ViewDirection,
): [Segment, Segment] {
  const side = flipForView(direction, view);
  const m = edgeMidpoint(glazing, side);
  const [a, b] = oppositeCorners(glazing, side);
  return [
    { x1: m.x, y1: m.y, x2: a.x, y2: a.y },
    { x1: m.x, y1: m.y, x2: b.x, y2: b.y },
  ];
}

export type Arrow = {
  shaft: Segment;
  head: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }];
};

/** Slim arrow pointing in the named direction, nudged off the glazing
 *  center so the centered name pill does not cover it. Shaft length is
 *  80% of the glazing's smaller dimension; the head is a narrow point
 *  (length 13% / half-width 5% of that dimension). Returned as one
 *  segment + a 3-point head polygon. */
export function slideArrow(
  glazing: RectLike,
  direction: ApertureOperationDirection,
  view: ViewDirection,
): Arrow {
  const side = flipForView(direction, view);
  const cx = glazing.x + glazing.width / 2;
  const cy = glazing.y + glazing.height / 2;
  const minDim = Math.min(glazing.width, glazing.height);
  const half = (minDim * ARROW_SHAFT_FRACTION) / 2;
  const headLen = minDim * ARROW_HEAD_LENGTH_FRACTION;
  const headHalfWidth = minDim * ARROW_HEAD_HALF_WIDTH_FRACTION;

  let shaft: Segment;
  let tip: { x: number; y: number };
  let backLeft: { x: number; y: number };
  let backRight: { x: number; y: number };
  if (side === "left" || side === "right") {
    const dir = side === "right" ? 1 : -1;
    const y = cy + glazing.height * ARROW_LABEL_CLEARANCE_FRACTION;
    shaft = { x1: cx - dir * half, y1: y, x2: cx + dir * half, y2: y };
    tip = { x: shaft.x2, y: shaft.y2 };
    backLeft = { x: tip.x - dir * headLen, y: tip.y - headHalfWidth };
    backRight = { x: tip.x - dir * headLen, y: tip.y + headHalfWidth };
  } else {
    const dir = side === "down" ? 1 : -1;
    const x = cx + glazing.width * ARROW_LABEL_CLEARANCE_FRACTION;
    shaft = { x1: x, y1: cy - dir * half, x2: x, y2: cy + dir * half };
    tip = { x: shaft.x2, y: shaft.y2 };
    backLeft = { x: tip.x - headHalfWidth, y: tip.y - dir * headLen };
    backRight = { x: tip.x + headHalfWidth, y: tip.y - dir * headLen };
  }
  return { shaft, head: [tip, backLeft, backRight] };
}

function edgeMidpoint(g: RectLike, side: ApertureOperationDirection): { x: number; y: number } {
  switch (side) {
    case "left":
      return { x: g.x, y: g.y + g.height / 2 };
    case "right":
      return { x: g.x + g.width, y: g.y + g.height / 2 };
    case "up":
      return { x: g.x + g.width / 2, y: g.y };
    case "down":
      return { x: g.x + g.width / 2, y: g.y + g.height };
  }
}

/** The two corners of ``glazing`` *not* touching the named edge. */
function oppositeCorners(
  g: RectLike,
  side: ApertureOperationDirection,
): [{ x: number; y: number }, { x: number; y: number }] {
  const tl = { x: g.x, y: g.y };
  const tr = { x: g.x + g.width, y: g.y };
  const bl = { x: g.x, y: g.y + g.height };
  const br = { x: g.x + g.width, y: g.y + g.height };
  switch (side) {
    case "left":
      return [tr, br];
    case "right":
      return [tl, bl];
    case "up":
      return [bl, br];
    case "down":
      return [tl, tr];
  }
}
