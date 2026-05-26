import { describe, expect, test } from "vitest";
import { computeLocalPreflight } from "../lib/coerceCustomFieldType";
import type { FieldOption } from "../types";

describe("computeLocalPreflight — single_select → number (substitute_labels)", () => {
  // Mirrors the backend chain coercion: resolve option_id → label, then
  // try Number(label). Numeric labels coerce; non-numeric ones clear.
  const sourceOptions: FieldOption[] = [
    { id: "opt_1", label: "10", color: "#000", order: 0 },
    { id: "opt_2", label: "20", color: "#000", order: 1 },
    { id: "opt_3", label: "not-a-number", color: "#000", order: 2 },
  ];

  test("numeric labels are compatible; non-numeric labels are reported", () => {
    const result = computeLocalPreflight(
      "single_select",
      "number",
      [
        { rowId: "r1", rawValue: "opt_1" },
        { rowId: "r2", rawValue: "opt_2" },
        { rowId: "r3", rawValue: "opt_3" },
      ],
      undefined,
      sourceOptions,
    );
    expect(result).not.toBeNull();
    expect(result!.total).toBe(3);
    expect(result!.incompatible).toHaveLength(1);
    expect(result!.incompatible[0]).toMatchObject({ rowId: "r3", reason: "not_a_number" });
  });

  test("null/empty option values count as compatible (cleared cells)", () => {
    const result = computeLocalPreflight(
      "single_select",
      "number",
      [
        { rowId: "r1", rawValue: null },
        { rowId: "r2", rawValue: "" },
      ],
      undefined,
      sourceOptions,
    );
    expect(result!.incompatible).toHaveLength(0);
  });

  test("unknown option_id (stale ref) is treated as null/cleared", () => {
    // Missing option resolves to no label → coerced to null, which is
    // compatible (the cell will simply be blank after the migration).
    const result = computeLocalPreflight(
      "single_select",
      "number",
      [{ rowId: "r1", rawValue: "opt_missing" }],
      undefined,
      sourceOptions,
    );
    expect(result!.incompatible).toHaveLength(0);
  });
});
