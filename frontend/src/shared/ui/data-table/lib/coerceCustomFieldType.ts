// TypeScript port of backend `_try_coerce_for_change_type`
// (schema_mutations.py). Drives the field-config type-change preflight panel.
// The backend remains authoritative on commit; the two implementations
// must agree byte-for-byte on outcomes.

import type { CustomFieldType } from "../hooks/useTableSchema";
import type { FieldOption } from "../types";
import { conversionPolicy } from "./typeConversionMatrix";

export type CoerceOk = { ok: true; value: string | number | null };
export type CoerceFail = { ok: false; reason: string };
export type CoerceResult = CoerceOk | CoerceFail;

export type PreflightRow = { rowId: string; rawValue: unknown; reason: string };
export type PreflightSourceRow = { rowId: string; rawValue: unknown };
export type LocalPreflightResult = { incompatible: PreflightRow[]; total: number };

// Returns null when the conversion is forbidden by the matrix.
export function computeLocalPreflight(
  fromType: CustomFieldType,
  toType: CustomFieldType,
  rows: ReadonlyArray<PreflightSourceRow>,
  targetOptionList?: ReadonlyArray<FieldOption>,
): LocalPreflightResult | null {
  const policy = conversionPolicy(fromType, toType);
  if (policy === null) return null;
  // create_options materializes options server-side from row text
  // values, so the local preview reports no incompatibilities.
  if (policy === "create_options") return { incompatible: [], total: rows.length };
  const incompatible: PreflightRow[] = [];
  for (const row of rows) {
    const result = coerceCustomValue(row.rawValue, toType, { optionList: targetOptionList ?? [] });
    if (!result.ok) {
      incompatible.push({ rowId: row.rowId, rawValue: row.rawValue, reason: result.reason });
    }
  }
  return { incompatible, total: rows.length };
}

function formatNumberForText(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(value);
}

function normalizeForOptionLookup(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function coerceCustomValue(
  rawValue: unknown,
  toType: CustomFieldType,
  args?: { optionList?: ReadonlyArray<FieldOption> },
): CoerceResult {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return { ok: true, value: null };
  }
  switch (toType) {
    case "short_text": {
      if (typeof rawValue === "string") {
        if (rawValue.length > 4000) return { ok: false, reason: "exceeds_short_text_max_length" };
        return { ok: true, value: rawValue };
      }
      if (typeof rawValue === "number") return { ok: true, value: formatNumberForText(rawValue) };
      return { ok: false, reason: "not_coercible_to_short_text" };
    }
    case "long_text": {
      if (typeof rawValue === "string") return { ok: true, value: rawValue };
      if (typeof rawValue === "number") return { ok: true, value: formatNumberForText(rawValue) };
      return { ok: false, reason: "not_coercible_to_long_text" };
    }
    case "number": {
      if (typeof rawValue === "boolean") return { ok: false, reason: "boolean_not_numeric" };
      if (typeof rawValue === "number") return { ok: true, value: rawValue };
      if (typeof rawValue === "string") {
        const stripped = rawValue.trim();
        if (!stripped) return { ok: true, value: null };
        const parsed = Number(stripped);
        if (!Number.isFinite(parsed)) return { ok: false, reason: "not_a_number" };
        return { ok: true, value: parsed };
      }
      return { ok: false, reason: "not_coercible_to_number" };
    }
    case "url": {
      if (typeof rawValue !== "string") return { ok: false, reason: "url_must_be_string" };
      const stripped = rawValue.trim();
      if (!stripped) return { ok: true, value: null };
      const lowered = stripped.toLocaleLowerCase();
      if (!(lowered.startsWith("http://") || lowered.startsWith("https://"))) {
        return { ok: false, reason: "missing_url_scheme" };
      }
      return { ok: true, value: stripped };
    }
    case "single_select": {
      const optionList = args?.optionList;
      if (!optionList) return { ok: false, reason: "missing_target_option_list" };
      if (typeof rawValue !== "string") return { ok: false, reason: "single_select_requires_text" };
      const normalized = normalizeForOptionLookup(rawValue);
      if (!normalized) return { ok: true, value: null };
      for (const option of optionList) {
        if (normalizeForOptionLookup(option.label) === normalized) {
          return { ok: true, value: option.id };
        }
      }
      return { ok: false, reason: "no_matching_option" };
    }
    case "formula":
      return { ok: false, reason: "any_to_formula_disallowed" };
    default:
      return { ok: false, reason: `unsupported_to_type:${toType as string}` };
  }
}
