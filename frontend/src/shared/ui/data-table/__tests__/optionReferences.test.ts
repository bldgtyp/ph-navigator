import { describe, expect, test } from "vitest";
import { missingOptionReferences, optionReferenceCounts } from "../lib/options/references";
import { normalizeOptionOrders } from "../lib/options/normalize";
import type { FieldOption } from "../types";

type Row = { id: string; floor: string | null };

const rows: Row[] = [
  { id: "rm_1", floor: "opt_ground" },
  { id: "rm_2", floor: "opt_ground" },
  { id: "rm_3", floor: "opt_roof" },
  { id: "rm_4", floor: null },
];
const accessor = (row: Row) => row.floor;

describe("optionReferenceCounts", () => {
  test("counts each option id across the row set", () => {
    expect(optionReferenceCounts(rows, accessor)).toEqual({
      opt_ground: 2,
      opt_roof: 1,
    });
  });

  test("skips rows whose accessor returns null, undefined, or non-string", () => {
    const mixed = [
      { id: "rm_a", floor: null },
      { id: "rm_b", floor: undefined as unknown as string | null },
      { id: "rm_c", floor: 42 as unknown as string | null },
      { id: "rm_d", floor: "" as unknown as string | null },
    ];
    expect(optionReferenceCounts(mixed, (r) => r.floor)).toEqual({});
  });
});

describe("missingOptionReferences", () => {
  const options: FieldOption[] = [
    { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 },
  ];

  test("returns option ids referenced by rows but absent from the options list", () => {
    expect(missingOptionReferences(rows, options, accessor)).toEqual(["opt_roof"]);
  });

  test("returns an empty list when every reference resolves", () => {
    const all: FieldOption[] = [
      { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 },
      { id: "opt_roof", label: "Roof", color: "#10b981", order: 1 },
    ];
    expect(missingOptionReferences(rows, all, accessor)).toEqual([]);
  });

  test("dedupes missing ids", () => {
    const dupes = [
      { id: "rm_1", floor: "opt_missing" },
      { id: "rm_2", floor: "opt_missing" },
    ];
    expect(missingOptionReferences(dupes, [], (r) => r.floor)).toEqual(["opt_missing"]);
  });
});

describe("normalizeOptionOrders", () => {
  test("reassigns order to 0..N-1 in array order", () => {
    const options: FieldOption[] = [
      { id: "opt_b", label: "B", color: "#000", order: 5 },
      { id: "opt_a", label: "A", color: "#000", order: 9 },
      { id: "opt_c", label: "C", color: "#000", order: 2 },
    ];
    expect(normalizeOptionOrders(options).map((o) => [o.id, o.order])).toEqual([
      ["opt_b", 0],
      ["opt_a", 1],
      ["opt_c", 2],
    ]);
  });

  test("trims labels", () => {
    const options: FieldOption[] = [{ id: "opt_a", label: "  A ", color: "#000", order: 0 }];
    expect(normalizeOptionOrders(options)[0]?.label).toBe("A");
  });
});
