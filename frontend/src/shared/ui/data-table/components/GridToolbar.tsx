import type { ReactNode } from "react";
import type { ViewState } from "../types";

// Toolbar shell extracted from DataTable.tsx (Phase 2 §4.9). Status
// chips on the left, action slot on the right. The action slot is
// library-owned — Phase 2 fills it with the row-delete button when
// the row-selection set is non-empty; Phases 4 / 5 / 6 will extend it
// with filter / sort / option-manager buttons in the same slot.
export type GridToolbarProps = {
  readOnly: boolean;
  view: ViewState;
  actions?: ReactNode;
};

export function GridToolbar({ readOnly, view, actions }: GridToolbarProps) {
  return (
    <div className="data-table-toolbar" aria-label="Table view controls">
      <div className="data-table-toolbar-status">
        <span>{readOnly ? "Read-only" : "Editable"}</span>
        <span>{view.filter.length ? `Filtered by ${view.filter.length} rule` : "No filters"}</span>
        <span>{view.group.length ? "Ungroup to paste" : "Ungrouped"}</span>
        <span>{view.sort.length ? `Sorted by ${view.sort.length} field` : "Unsorted"}</span>
      </div>
      {actions ? <div className="data-table-toolbar-actions">{actions}</div> : null}
    </div>
  );
}
