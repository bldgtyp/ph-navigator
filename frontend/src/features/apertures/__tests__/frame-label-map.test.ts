import { describe, expect, it } from "vitest";
import { canonicalSideToVisual, frameRowLabel, visualSideToCanonical } from "../frame-label-map";

describe("frame-label-map", () => {
  it("exterior view leaves sides unchanged", () => {
    for (const side of ["top", "right", "bottom", "left"] as const) {
      expect(visualSideToCanonical(side, "exterior")).toBe(side);
      expect(canonicalSideToVisual(side, "exterior")).toBe(side);
    }
  });

  it("interior view swaps left and right; top/bottom unchanged", () => {
    expect(visualSideToCanonical("left", "interior")).toBe("right");
    expect(visualSideToCanonical("right", "interior")).toBe("left");
    expect(visualSideToCanonical("top", "interior")).toBe("top");
    expect(visualSideToCanonical("bottom", "interior")).toBe("bottom");
  });

  it("frameRowLabel reflects the visible side label", () => {
    // Canonical right side, viewed exterior → labelled "Right Frame"
    expect(frameRowLabel("right", "exterior")).toBe("Right Frame");
    // Canonical right side, viewed interior → flips to visible left
    expect(frameRowLabel("right", "interior")).toBe("Left Frame");
  });
});
