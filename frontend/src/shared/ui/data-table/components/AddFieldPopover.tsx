// Add-field popover anchored to a header cell or the tail `+` cell.
//
// Plan-15 P2.6 ships the real popover for the four Phase 2 types
// (`short_text`, `long_text`, `number`, `url`) with inline duplicate-
// name preflight (US-CF-12), optional description (US-CF-14), and
// per-type config. P2.0 places the file so the popover can be wired
// from `AddFieldTailCell` and `HeaderContextMenu` without follow-up
// renames; the typed `AddFieldPopoverProps` shape lands with the
// real implementation in P2.6.

export function AddFieldPopover(): null {
  // TODO P2.6 — render Radix Popover with the field editor.
  return null;
}
