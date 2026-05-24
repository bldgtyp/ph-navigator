import { useState, type ReactNode } from "react";
import { FilterPopover } from "./FilterPopover";
import { SortPopover } from "./SortPopover";
import { ViewMenuOverflow } from "./ViewMenuOverflow";
import type { FieldDef, FilterCondition, SortRule, ViewState } from "../types";

// Toolbar shell. Status chips on the left, right-aligned axis buttons
// (Phase 4 §4.8). The `actions` slot — used by Phase 2 for the row-
// delete button — sits below the toolbar row so the destructive action
// never overlaps the Sort / Filter / overflow controls reaching for
// the same area.
export type GridToolbarProps = {
  readOnly: boolean;
  view: ViewState;
  fieldDefByKey: Map<string, FieldDef>;
  filterableFieldDefs: FieldDef[];
  sortableFieldDefs: FieldDef[];
  onFilterChange: (next: FilterCondition[]) => void;
  onSortChange: (next: SortRule[]) => void;
  onResetView: () => void;
  actions?: ReactNode;
};

type AxisRule = { fieldKey: string };

export function GridToolbar({
  readOnly,
  view,
  fieldDefByKey,
  filterableFieldDefs,
  sortableFieldDefs,
  onFilterChange,
  onSortChange,
  onResetView,
  actions,
}: GridToolbarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const filterLabel = describeAxisLabel(view.filter, fieldDefByKey, "Filter", "Filtered by");
  const sortLabel = describeAxisLabel(view.sort, fieldDefByKey, "Sort", "Sorted by");
  // §4.8: buttons tint as soon as any rule exists (matches AirTable —
  // the chip colors on rule-present, dormant or not). Per-column cell
  // tint requires a contributing rule and is computed in DataTable.tsx.
  const filterActive = view.filter.length > 0;
  const sortActive = view.sort.length > 0;

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
              aria-label={filterLabel}
            >
              <span className="data-table-toolbar-button-icon" aria-hidden>
                ☰
              </span>
              <span>{filterLabel}</span>
            </button>
          }
        />
        <SortPopover
          open={sortOpen}
          onOpenChange={setSortOpen}
          rules={view.sort}
          onSortChange={onSortChange}
          sortableFieldDefs={sortableFieldDefs}
          trigger={
            <button
              type="button"
              className="data-table-toolbar-button"
              data-axis="sort"
              data-axis-active={sortActive ? "true" : undefined}
              aria-label={sortLabel}
            >
              <span className="data-table-toolbar-button-icon" aria-hidden>
                ↑↓
              </span>
              <span>{sortLabel}</span>
            </button>
          }
        />
        <ViewMenuOverflow
          onReset={onResetView}
          canReset={view.filter.length > 0 || view.sort.length > 0}
        />
      </div>
      {actions ? <div className="data-table-toolbar-actions">{actions}</div> : null}
    </div>
  );
}

function describeAxisLabel(
  rules: AxisRule[],
  fieldDefByKey: Map<string, FieldDef>,
  idleLabel: string,
  activePrefix: string,
): string {
  if (rules.length === 0) return idleLabel;
  if (rules.length === 1) {
    const rule = rules[0]!;
    const fieldName = fieldDefByKey.get(rule.fieldKey)?.display_name ?? rule.fieldKey;
    return `${activePrefix} ${fieldName}`;
  }
  return `${activePrefix} ${rules.length} fields`;
}
