import type { AxisRoleSubset } from "../types";

// Phase 6 §4.3 / L9.2: the seven non-empty subsets of
// {filter, sort, group}. Listed in lexical order — the codes
// concatenate the present axes' first letters in fixed order
// f < s < g so two callers can never disagree about which code to use.
//
// The actual paint lives as CSS custom properties in App.css, keyed
// by the subset code: `--data-table-tint-<code>-body` for cells and
// `--data-table-tint-<code>-header` for column headers. Cells emit
// `data-axis-tint="<code>"` so attribute selectors paint without any
// per-render JS work (matches Phase 4's contract).
export const AXIS_ROLE_SUBSETS: readonly AxisRoleSubset[] = [
  "f",
  "s",
  "g",
  "fs",
  "fg",
  "sg",
  "fsg",
] as const;
