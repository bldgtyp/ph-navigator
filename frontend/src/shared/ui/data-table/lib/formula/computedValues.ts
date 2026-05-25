import type { EvalErrorCode } from "./evaluator";

export type ComputedCellValue = string | number | boolean | null | { error: EvalErrorCode };

export const COMPUTED_ERROR_MESSAGES: Record<EvalErrorCode, string> = {
  div_by_zero: "Division by zero.",
  type_mismatch: "Operation on incompatible types.",
  missing_ref: "Formula references a field that no longer exists.",
  fuse_tripped: "Formula evaluation exceeded the per-row budget.",
  output_too_long: "Formula output exceeds the maximum length.",
};

export function isComputedErrorValue(value: unknown): value is { error: EvalErrorCode } {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  const code = obj.error;
  if (typeof code !== "string") return false;
  return code in COMPUTED_ERROR_MESSAGES;
}
