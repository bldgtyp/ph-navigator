// `?` glyph + tooltip beside the header cell's locked/unlocked
// indicator. Renders the field's plain-text description (US-CF-14).
//
// Plan-15 P2.5 ships the real Radix Tooltip; viewer-mode visible
// (US-CF-9 criterion 1 + US-CF-14 criterion 4). P2.0 places the
// file so imports from `SortableHeaderCell` can resolve; the typed
// `CustomFieldDescriptionTooltipProps` shape lands with the real
// implementation in P2.5.

export function CustomFieldDescriptionTooltip(): null {
  // TODO P2.5 — render Radix Tooltip when fieldDef.description is non-empty.
  return null;
}
