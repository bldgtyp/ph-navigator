import { describe, expect, it } from "vitest";
import { nextMode } from "../pick-paste-machine";

describe("pick-paste-machine", () => {
  it("idle + click-eyedropper → picking", () => {
    expect(nextMode("idle", { type: "click-eyedropper" })).toBe("picking");
  });

  it("picking + click-element → picked", () => {
    expect(nextMode("picking", { type: "click-element" })).toBe("picked");
  });

  it("picked + click-paint-bucket → pasting", () => {
    expect(nextMode("picked", { type: "click-paint-bucket" })).toBe("pasting");
  });

  it("pasting + click-element → pasting (rapid fire)", () => {
    expect(nextMode("pasting", { type: "click-element" })).toBe("pasting");
  });

  it("any non-idle + esc → idle", () => {
    expect(nextMode("picking", { type: "esc" })).toBe("idle");
    expect(nextMode("picked", { type: "esc" })).toBe("idle");
    expect(nextMode("pasting", { type: "esc" })).toBe("idle");
  });

  it("any non-idle + click-background → idle", () => {
    expect(nextMode("picked", { type: "click-background" })).toBe("idle");
  });

  it("clear collapses to idle", () => {
    expect(nextMode("pasting", { type: "clear" })).toBe("idle");
  });
});
