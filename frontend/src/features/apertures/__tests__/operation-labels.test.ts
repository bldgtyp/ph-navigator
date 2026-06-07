import { describe, expect, it } from "vitest";
import { formatOperation } from "../operation-labels";

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
});
