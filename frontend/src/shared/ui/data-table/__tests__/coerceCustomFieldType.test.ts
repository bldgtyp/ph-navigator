import { describe, expect, test } from "vitest";
import { computeLocalPreflight } from "../lib/coerceCustomFieldType";
import { CONVERSION_MATRIX } from "../lib/typeConversionMatrix";
import type { FieldOption } from "../types";

describe("type conversion matrix — formula parity", () => {
  test("mirrors the backend formula conversion entries", () => {
    const entries = Object.values(CONVERSION_MATRIX).flatMap((targets) => Object.entries(targets));
    const formulaEntries = Object.entries(CONVERSION_MATRIX).flatMap(([from, targets]) =>
      Object.entries(targets)
        .filter(([to]) => from === "formula" || to === "formula")
        .map(([to, policy]) => `${from}->${to}:${policy}`),
    );

    // 34 pre-linked-record pairs + 14 linked_record pairs (7 from + 7 to).
    expect(entries).toHaveLength(48);
    expect(formulaEntries.sort()).toEqual([
      "color->formula:discard_then_author",
      "formula->color:lossy",
      "formula->linked_record:linked_record_wipe",
      "formula->long_text:lossless",
      "formula->number:lossy",
      "formula->short_text:lossless",
      "formula->single_select:create_options",
      "formula->url:lossy",
      "linked_record->formula:linked_record_wipe",
      "long_text->formula:discard_then_author",
      "number->formula:discard_then_author",
      "short_text->formula:discard_then_author",
      "single_select->formula:discard_then_author",
      "url->formula:discard_then_author",
    ]);
  });
});

describe("computeLocalPreflight — text → color", () => {
  test("requires stored six-digit hex values", () => {
    const result = computeLocalPreflight("short_text", "color", [
      { rowId: "r1", rawValue: "#dce6f0" },
      { rowId: "r2", rawValue: "#abc" },
      { rowId: "r3", rawValue: "" },
    ]);

    expect(result).not.toBeNull();
    expect(result!.total).toBe(3);
    expect(result!.incompatible).toEqual([
      { rowId: "r2", rawValue: "#abc", reason: "invalid_color_hex" },
    ]);
  });
});

describe("computeLocalPreflight — single_select → color (substitute_option_colors)", () => {
  const sourceOptions: FieldOption[] = [
    { id: "opt_good", label: "Good", color: "#dce6f0", order: 0 },
    { id: "opt_bad", label: "Bad", color: "#abc", order: 1 },
  ];

  test("substitutes option swatches and validates strict stored hex", () => {
    const result = computeLocalPreflight(
      "single_select",
      "color",
      [
        { rowId: "r1", rawValue: "opt_good" },
        { rowId: "r2", rawValue: "opt_bad" },
      ],
      undefined,
      sourceOptions,
    );

    expect(result).not.toBeNull();
    expect(result!.incompatible).toEqual([
      { rowId: "r2", rawValue: "opt_bad", reason: "invalid_color_hex" },
    ]);
  });
});

describe("computeLocalPreflight — primitive → formula (discard_then_author)", () => {
  test("flags non-empty source cells as discarded for formula authoring", () => {
    const result = computeLocalPreflight("short_text", "formula", [
      { rowId: "r1", rawValue: "101" },
      { rowId: "r2", rawValue: "" },
      { rowId: "r3", rawValue: null },
      { rowId: "r4", rawValue: "102" },
    ]);

    expect(result).not.toBeNull();
    expect(result!.total).toBe(4);
    expect(result!.incompatible).toEqual([
      { rowId: "r1", rawValue: "101", reason: "discarded_for_formula_authoring" },
      { rowId: "r4", rawValue: "102", reason: "discarded_for_formula_authoring" },
    ]);
  });
});

describe("computeLocalPreflight — formula snapshots", () => {
  test("canonicalizes computed booleans before text coercion", () => {
    const result = computeLocalPreflight("formula", "short_text", [
      { rowId: "r1", rawValue: true },
      { rowId: "r2", rawValue: false },
    ]);

    expect(result).not.toBeNull();
    expect(result!.incompatible).toEqual([]);
  });

  test("canonicalizes computed booleans before numeric coercion", () => {
    const result = computeLocalPreflight("formula", "number", [{ rowId: "r1", rawValue: true }]);

    expect(result).not.toBeNull();
    expect(result!.incompatible).toEqual([{ rowId: "r1", rawValue: true, reason: "not_a_number" }]);
  });
});

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
