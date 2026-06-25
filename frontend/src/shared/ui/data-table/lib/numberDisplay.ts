import type { FieldDef } from "../types";
import { clampNumberPrecision } from "./numberPrecision";

export function isNumericFieldDef(fieldDef: FieldDef | undefined): boolean {
  return (
    fieldDef?.field_type === "number" ||
    (fieldDef?.field_type === "computed" && fieldDef.computed_type === "number")
  );
}

export function isEmptyNumericValue(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

export function formatPlainNumberDisplay(value: unknown, fieldDef: FieldDef | undefined): string {
  if (isEmptyNumericValue(value)) return "";
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return "";
  if (fieldDef?.numberPrecision === undefined) return String(value);
  return numeric.toFixed(clampNumberPrecision(fieldDef.numberPrecision));
}
