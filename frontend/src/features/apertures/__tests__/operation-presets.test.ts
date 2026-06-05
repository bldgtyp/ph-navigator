import { describe, expect, it } from "vitest";
import { OPERATION_PRESETS } from "../operation-presets";

describe("OPERATION_PRESETS", () => {
  it("ships the seven PRD presets", () => {
    expect(OPERATION_PRESETS).toHaveLength(7);
    expect(OPERATION_PRESETS.map((p) => p.id)).toEqual([
      "tilt-turn",
      "awning",
      "hopper",
      "casement-left",
      "casement-right",
      "slider-left",
      "slider-right",
    ]);
  });

  it("tilt-turn payload is swing + [left, up]", () => {
    const tt = OPERATION_PRESETS.find((p) => p.id === "tilt-turn");
    expect(tt?.payload).toEqual({ type: "swing", directions: ["left", "up"] });
  });

  it("slider presets are slide type", () => {
    for (const id of ["slider-left", "slider-right"]) {
      const p = OPERATION_PRESETS.find((x) => x.id === id);
      expect(p?.payload.type).toBe("slide");
    }
  });
});
