// Right-click / Shift+F10 context menu on column header cells.
//
// Plan-15 P2.5 implements the real component (Radix DropdownMenu,
// view-state items for every field, schema items gated by
// `fieldDef.read_only_schema`, viewer-mode suppression per US-CF-9).
// P2.6 grows the menu with Insert field left/right, P2.7 adds
// rename / duplicate / edit description.
//
// P2.0 ships an inert placeholder so the file already exists where
// the spec says it does. The typed `HeaderContextMenuProps` shape
// lands with the real implementation in P2.5.

export function HeaderContextMenu(): null {
  // TODO P2.5 — render Radix DropdownMenu with view-state + schema items.
  return null;
}
