export type FillAxis = "vertical" | "horizontal";
export type FillDirection = "up" | "down" | "left" | "right";

// Returns the axis the fill should lock to, or null while neither
// pointer delta has crossed `axisThreshold`. Ties (equal absolute
// deltas) resolve to vertical — matches AirTable.
export function chooseFillAxis(args: {
  pointerStart: { x: number; y: number };
  pointerCurrent: { x: number; y: number };
  axisThreshold: number;
}): FillAxis | null {
  const dx = Math.abs(args.pointerCurrent.x - args.pointerStart.x);
  const dy = Math.abs(args.pointerCurrent.y - args.pointerStart.y);
  if (dx < args.axisThreshold && dy < args.axisThreshold) return null;
  return dy >= dx ? "vertical" : "horizontal";
}

// Returns the cardinal direction within an already-locked axis based on
// the sign of the pointer delta. A zero delta (pointer back at start)
// resolves to the positive direction (`"down"` / `"right"`); the caller
// treats a same-as-source target as "fill canceled" anyway.
export function chooseFillDirection(args: {
  pointerStart: { x: number; y: number };
  pointerCurrent: { x: number; y: number };
  axis: FillAxis;
}): FillDirection {
  if (args.axis === "vertical") {
    return args.pointerCurrent.y >= args.pointerStart.y ? "down" : "up";
  }
  return args.pointerCurrent.x >= args.pointerStart.x ? "right" : "left";
}
