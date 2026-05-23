import { useState, type ReactNode } from "react";
import { FilterPopover } from "./FilterPopover";
import type { FieldDef, FilterCondition, ViewState } from "../types";

// Toolbar shell. Status chips on the left, right-aligned axis buttons
// (Phase 4 §4.8). The `actions` slot — used by Phase 2 for the row-
// delete button — sits below the toolbar row so the destructive action
// never overlaps the Sort / Filter / overflow controls reaching for
// the same area.
export type GridToolbarProps = {
  readOnly: boolean;
  view: ViewState;
  fieldDefs: FieldDef[];
  filterableFieldDefs: FieldDef[];
  onFilterChange: (next: FilterCondition[]) => void;
  actions?: ReactNode;
};

export function GridToolbar({
  readOnly,
  view,
  fieldDefs,
  filterableFieldDefs,
  onFilterChange,
  actions,
}: GridToolbarProps) {
  const [filterOpen, setFilterOpen] = useState(false);

  const filterButtonLabel = describeFilterLabel(view.filter, fieldDefs);
  // §4.8: button tints as soon as any rule exists (matches AirTable —
  // the chip colors on rule-present, dormant or not). The per-column
  // cell tint requires a contributing rule and is computed separately
  // in DataTable.tsx.
  const filterActive = view.filter.length > 0;

  return (
    <div className="data-table-toolbar" aria-label="Table view controls">
      <div className="data-table-toolbar-status">
        <span>{readOnly ? "Read-only" : "Editable"}</span>
        <span>{view.group.length ? "Ungroup to paste" : "Ungrouped"}</span>
      </div>
      <div className="data-table-toolbar-buttons">
        <FilterPopover
          open={filterOpen}
          onOpenChange={setFilterOpen}
          rules={view.filter}
          onFilterChange={onFilterChange}
          filterableFieldDefs={filterableFieldDefs}
          trigger={
            <button
              type="button"
              className="data-table-toolbar-button"
              data-axis="filter"
              data-axis-active={filterActive ? "true" : undefined}
              aria-label={filterButtonLabel.ariaLabel}
            >
              <span className="data-table-toolbar-button-icon" aria-hidden>
                ☰
              </span>
              <span>{filterButtonLabel.text}</span>
            </button>
          }
        />
      </div>
      {actions ? <div className="data-table-toolbar-actions">{actions}</div> : null}
    </div>
  );
}

function describeFilterLabel(
  rules: FilterCondition[],
  fieldDefs: FieldDef[],
): { text: string; ariaLabel: string } {
  if (rules.length === 0) return { text: "Filter", ariaLabel: "Filter" };
  if (rules.length === 1) {
    const rule = rules[0]!;
    const fieldName =
      fieldDefs.find((def) => def.field_key === rule.fieldKey)?.display_name ?? rule.fieldKey;
    return {
      text: `Filtered by ${fieldName}`,
      ariaLabel: `Filtered by ${fieldName}`,
    };
  }
  return {
    text: `Filtered by ${rules.length} fields`,
    ariaLabel: `Filtered by ${rules.length} fields`,
  };
}
