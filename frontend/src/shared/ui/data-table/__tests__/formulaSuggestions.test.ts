import { describe, expect, test } from "vitest";
import { buildFormulaSuggestions, getFormulaCaretContext } from "../lib/formula/suggestions";
import type { FieldRegistryEntry } from "../lib/formula";

const fields: FieldRegistryEntry[] = [
  { field_id: "name", display_name: "Name", origin: "core", field_type: "text" },
  { field_id: "number", display_name: "Number", origin: "core", field_type: "number" },
  { field_id: "notes", display_name: "Notes", origin: "custom", field_type: "text" },
];

describe("getFormulaCaretContext", () => {
  test("detects field reference drafts", () => {
    expect(getFormulaCaretContext("{N", 2)).toEqual({
      mode: "field",
      query: "N",
      range: { start: 0, end: 2 },
    });
  });

  test("detects bare word drafts", () => {
    expect(getFormulaCaretContext("upper(N", 7)).toEqual({
      mode: "bare",
      query: "N",
      range: { start: 6, end: 7 },
    });
  });

  test("suppresses suggestions inside quoted strings and closed field refs", () => {
    expect(getFormulaCaretContext('"N', 2).mode).toBe("none");
    expect(getFormulaCaretContext("{Name}", 6).mode).toBe("none");
  });
});

describe("buildFormulaSuggestions", () => {
  test("filters fields in brace mode", () => {
    const suggestions = buildFormulaSuggestions(getFormulaCaretContext("{N", 2), fields);
    expect(suggestions.map((suggestion) => suggestion.label)).toEqual(["Name", "Notes", "Number"]);
    expect(suggestions.every((suggestion) => suggestion.kind === "field")).toBe(true);
  });

  test("offers fields and functions in bare mode", () => {
    const suggestions = buildFormulaSuggestions(getFormulaCaretContext("lo", 2), fields);
    expect(suggestions.map((suggestion) => suggestion.label)).toContain("lower");
    expect(suggestions.map((suggestion) => suggestion.label)).not.toContain("Name");
  });
});
