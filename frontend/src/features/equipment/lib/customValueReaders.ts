import { getCustomValue } from "../../../shared/ui/data-table";

export type RowWithCustomValues = {
  custom_values?: Record<string, unknown> | null | undefined;
  custom?: Record<string, unknown> | null | undefined;
  [key: string]: unknown;
};

export function customTextValue(row: RowWithCustomValues, fieldKey: string): string {
  return customTextValueOrNull(row, fieldKey) ?? "";
}

export function customTextValueOrNull(row: RowWithCustomValues, fieldKey: string): string | null {
  const value = getCustomValue(row, fieldKey);
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : String(value);
}

export function customNumberValue(row: RowWithCustomValues, fieldKey: string): number | null {
  const value = getCustomValue(row, fieldKey);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
