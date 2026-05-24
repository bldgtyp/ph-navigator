import type { AxisRoleSubset } from "../types";

// The seven non-empty subsets of {filter, sort, group}. Codes
// concatenate present axes' first letters in fixed order f < s < g.
// CSS variables in App.css are keyed off the codes
// (`--data-table-tint-<code>-body` / `-header`); cells emit the code
// as `data-axis-tint="<code>"` so attribute selectors paint without
// per-render JS work.
export const AXIS_ROLE_SUBSETS: readonly AxisRoleSubset[] = [
  "f",
  "s",
  "g",
  "fs",
  "fg",
  "sg",
  "fsg",
] as const;

export function buildSubsetCode(present: {
  filter: boolean;
  sort: boolean;
  group: boolean;
}): AxisRoleSubset | null {
  let code = "";
  if (present.filter) code += "f";
  if (present.sort) code += "s";
  if (present.group) code += "g";
  return code ? (code as AxisRoleSubset) : null;
}
