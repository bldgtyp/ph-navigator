import { describe, expect, it } from "vitest";
import { formatOperation } from "../operation-labels";
import { OPERATION_PRESETS } from "../operation-presets";

describe("formatOperation", () => {
  it("null → Fixed", () => {
    expect(formatOperation(null)).toBe("Fixed");
  });

  it("type-only swing/slide → bare label", () => {
    expect(formatOperation({ type: "swing", directions: [] })).toBe("Swing");
    expect(formatOperation({ type: "slide", directions: [] })).toBe("Slide");
  });

  it("title-cased directions joined with comma-space", () => {
    expect(formatOperation({ type: "swing", directions: ["left", "up"] })).toBe("Swing (Left, Up)");
    expect(formatOperation({ type: "slide", directions: ["right"] })).toBe("Slide (Right)");
  });

  it("every preset formats with the type label visible", () => {
    for (const preset of OPERATION_PRESETS) {
      const label = formatOperation(preset.payload);
      expect(label.startsWith("Swing") || label.startsWith("Slide")).toBe(true);
    }
  });
});
