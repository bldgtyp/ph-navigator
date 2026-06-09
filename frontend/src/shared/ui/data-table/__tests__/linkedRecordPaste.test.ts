import { describe, expect, test } from "vitest";
import { coerceFieldValue } from "../lib/rows/defaults";

// Phase 1 record-linking — `coerceFieldValue` paste branch for
// linked_record fields. Round-trips the JSON id list emitted by
// `formatClipboardValue` (sibling-cell copy) and rejects anything
// else, per PRD §11 Q24.
describe("coerceFieldValue — linked_record (paste)", () => {
  const linkedField = {
    field_key: "cf_pumps",
    field_type: "linked_record" as const,
    display_name: "Pumps",
    linked_record_config: {
      target_table_path: ["tables", "pumps"],
      max_links: null,
    },
  };

  test("accepts a JSON id list (round-trip from copy)", () => {
    expect(coerceFieldValue('["pump-a","pump-b"]', linkedField, () => [])).toEqual({
      ok: true,
      value: ["pump-a", "pump-b"],
    });
  });

  test("dedupes and drops empty entries", () => {
    expect(coerceFieldValue('["pump-a","","pump-a","pump-b"]', linkedField, () => [])).toEqual({
      ok: true,
      value: ["pump-a", "pump-b"],
    });
  });

  test("blank paste clears the cell", () => {
    expect(coerceFieldValue("", linkedField, () => [])).toEqual({ ok: true, value: [] });
  });

  test("stringified pill text is rejected", () => {
    const result = coerceFieldValue("Pump A, Pump B", linkedField, () => []);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/JSON list/);
  });

  test("non-array JSON is rejected", () => {
    const result = coerceFieldValue('{"id":"pump-a"}', linkedField, () => []);
    expect(result.ok).toBe(false);
  });

  test("over-cap paste is rejected for max_links=1", () => {
    const single = {
      ...linkedField,
      linked_record_config: { ...linkedField.linked_record_config, max_links: 1 },
    };
    const result = coerceFieldValue('["pump-a","pump-b"]', single, () => []);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/at most 1 link/);
  });
});
