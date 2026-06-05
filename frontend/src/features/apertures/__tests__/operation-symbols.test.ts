import { describe, expect, it } from "vitest";
import { flipForView, slideArrow, swingLines } from "../operation-symbols";

const GLAZING = { x: 100, y: 200, width: 400, height: 300 };

describe("flipForView", () => {
  it("exterior is identity", () => {
    expect(flipForView("left", "exterior")).toBe("left");
    expect(flipForView("right", "exterior")).toBe("right");
    expect(flipForView("up", "exterior")).toBe("up");
  });

  it("interior swaps left ↔ right, leaves up/down", () => {
    expect(flipForView("left", "interior")).toBe("right");
    expect(flipForView("right", "interior")).toBe("left");
    expect(flipForView("up", "interior")).toBe("up");
    expect(flipForView("down", "interior")).toBe("down");
  });
});

describe("swingLines", () => {
  it("hinge-left exterior: midpoint of left edge to right corners", () => {
    const [a, b] = swingLines(GLAZING, "left", "exterior");
    const midpoint = { x: GLAZING.x, y: GLAZING.y + GLAZING.height / 2 };
    expect({ x: a.x1, y: a.y1 }).toEqual(midpoint);
    expect({ x: b.x1, y: b.y1 }).toEqual(midpoint);
    const tr = { x: GLAZING.x + GLAZING.width, y: GLAZING.y };
    const br = { x: GLAZING.x + GLAZING.width, y: GLAZING.y + GLAZING.height };
    expect(
      new Set([JSON.stringify({ x: a.x2, y: a.y2 }), JSON.stringify({ x: b.x2, y: b.y2 })]),
    ).toEqual(new Set([JSON.stringify(tr), JSON.stringify(br)]));
  });

  it("hinge-left interior maps to right-edge midpoint → left corners", () => {
    const [a] = swingLines(GLAZING, "left", "interior");
    expect(a.x1).toBe(GLAZING.x + GLAZING.width);
    expect(a.y1).toBe(GLAZING.y + GLAZING.height / 2);
    // Both endpoints have x === glazing.x (left corners)
    expect(a.x2).toBe(GLAZING.x);
  });
});

describe("slideArrow", () => {
  it("slide-right exterior: shaft from center heading right, length 80% of min dim", () => {
    const arrow = slideArrow(GLAZING, "right", "exterior");
    const cx = GLAZING.x + GLAZING.width / 2;
    const cy = GLAZING.y + GLAZING.height / 2;
    const half = (Math.min(GLAZING.width, GLAZING.height) * 0.8) / 2;
    expect(arrow.shaft.x1).toBeCloseTo(cx - half);
    expect(arrow.shaft.y1).toBeCloseTo(cy);
    expect(arrow.shaft.x2).toBeCloseTo(cx + half);
    expect(arrow.shaft.y2).toBeCloseTo(cy);
    // Head tip at shaft end
    expect(arrow.head[0]).toEqual({ x: arrow.shaft.x2, y: arrow.shaft.y2 });
  });

  it("slide-right interior flips to left", () => {
    const arrow = slideArrow(GLAZING, "right", "interior");
    expect(arrow.shaft.x2).toBeLessThan(arrow.shaft.x1);
  });
});
