import { describe, expect, it } from "vitest";
import { nameCollides, naturalSortApertures } from "./lib";
import type { ApertureTypeEntry } from "./types";

function entry(id: string, name: string): ApertureTypeEntry {
  return {
    id,
    name,
    row_heights_mm: [1000],
    column_widths_mm: [1000],
    elements: [],
  };
}

describe("naturalSortApertures", () => {
  it("orders AA, AA_2, AA_10, AB ahead of bare numerics", () => {
    const sorted = naturalSortApertures([
      entry("apt_3", "AA_10"),
      entry("apt_1", "AA"),
      entry("apt_4", "AB"),
      entry("apt_2", "AA_2"),
    ]);
    expect(sorted.map((e) => e.name)).toEqual(["AA", "AA_2", "AA_10", "AB"]);
  });
});

describe("nameCollides", () => {
  const list = [entry("apt_1", "Type A"), entry("apt_2", "Type B")];

  it("matches trim + case-insensitively", () => {
    expect(nameCollides(list, "  type a  ")).toBe(true);
    expect(nameCollides(list, "TYPE B")).toBe(true);
    expect(nameCollides(list, "Type C")).toBe(false);
  });

  it("respects excludingId so renaming to your own name is not a collision", () => {
    expect(nameCollides(list, "Type A", "apt_1")).toBe(false);
    expect(nameCollides(list, "Type A", "apt_2")).toBe(true);
  });

  it("treats empty / whitespace input as non-colliding (input validation handles it elsewhere)", () => {
    expect(nameCollides(list, "")).toBe(false);
    expect(nameCollides(list, "   ")).toBe(false);
  });
});
