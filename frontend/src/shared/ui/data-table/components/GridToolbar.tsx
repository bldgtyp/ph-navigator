import { useMemo, useState, type ReactNode } from "react";
import { ArrowUpDown, EyeOff, Filter, Group } from "lucide-react";
import { FilterPopover } from "./FilterPopover";
import { SortPopover } from "./SortPopover";
import { GroupPopover } from "./GroupPopover";
import { ViewMenuOverflow } from "./ViewMenuOverflow";
import { HideFieldsPopover } from "./HideFieldsPopover";
import type { HideFieldsColumn, HideFieldsPanelChange } from "./HideFieldsPanel";
import type { FieldDef, FilterCondition, GroupRule, SortRule, ViewState } from "../types";

// Toolbar shell. Status chips on the left, right-aligned axis buttons.
// The `actions` slot — used for the row-delete button — sits below the
// toolbar row so a destructive action never overlaps the Sort / Filter
// / overflow controls reaching for the same area.
export type GridToolbarProps = {
  tableName: string;
  view: ViewState;
  fieldDefByKey: Map<string, FieldDef>;
  filterableFieldDefs: FieldDef[];
  sortableFieldDefs: FieldDef[];
  groupableFieldDefs: FieldDef[];
  // Full column list — ordered, includes hidden ones — so the Hide-
  // fields panel can render every row with the right toggle state.
  orderedColumnsForHidePanel: HideFieldsColumn[];
  onFilterChange: (next: FilterCondition[]) => void;
  onSortChange: (next: SortRule[]) => void;
  onGroupChange: (next: GroupRule[]) => void;
  onCollapseAllGroups: () => void;
  onExpandAllGroups: () => void;
  onResetView: () => void;
  // Built-in CSV download for the current view. Required — see
  // ViewMenuOverflowProps.onDownloadCsv (parent-owned iron-law affordance).
  onDownloadCsv: () => void;
  // Whether the Download CSV item is shown (CP-7: hidden from viewers). The
  // handler stays required/wired; only visibility is access-gated.
  canDownloadCsv: boolean;
  onHideFieldsChange: (change: HideFieldsPanelChange) => void;
  overflowMenuActions?: ReactNode;
  actions?: ReactNode;
};

type AxisRule = { fieldKey: string };

export function GridToolbar({
  tableName,
  view,
  fieldDefByKey,
  filterableFieldDefs,
  sortableFieldDefs,
  groupableFieldDefs,
  orderedColumnsForHidePanel,
  onFilterChange,
  onSortChange,
  onGroupChange,
  onCollapseAllGroups,
  onExpandAllGroups,
  onResetView,
  onDownloadCsv,
  canDownloadCsv,
  onHideFieldsChange,
  overflowMenuActions,
  actions,
}: GridToolbarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [hideFieldsOpen, setHideFieldsOpen] = useState(false);
  // De-dupe hiddenColumns against the live ordered list so a stale id
  // (column the consumer removed) doesn't bump the label count.
  const hiddenCount = useMemo(() => {
    const knownIds = new Set(orderedColumnsForHidePanel.map((column) => column.id));
    return view.hiddenColumns.reduce((acc, id) => acc + (knownIds.has(id) ? 1 : 0), 0);
  }, [orderedColumnsForHidePanel, view.hiddenColumns]);
  const hideFieldsLabel = hiddenCount === 0 ? "Hide fields" : `Hide fields (${hiddenCount})`;
  const hideFieldsActive = hiddenCount > 0;

  const filterLabel = describeAxisLabel(view.filter, fieldDefByKey, "Filter", "Filtered by");
  const sortLabel = describeAxisLabel(view.sort, fieldDefByKey, "Sort", "Sorted by");
  const groupLabel = describeAxisLabel(view.group, fieldDefByKey, "Group", "Grouped by");
  // Buttons tint as soon as any rule exists (matches AirTable's
  // chip-on-rule-present behaviour, including dormant rules). Per-
  // column cell tint requires a contributing rule and is computed in
  // DataTable.tsx.
  const filterActive = view.filter.length > 0;
  const sortActive = view.sort.length > 0;
  const groupActive = view.group.length > 0;
  const canResetView =
    filterActive ||
    sortActive ||
    groupActive ||
    Object.keys(view.aggregations).length > 0 ||
    Object.keys(view.expandedGroups).length > 0;

  return (
    <div className="data-table-toolbar" aria-label="Table view controls">
      <div className="data-table-toolbar-status">
        <h2 className="data-table-toolbar-title" title={tableName}>
          {tableName}
        </h2>
        {groupActive ? <span>Ungroup to paste</span> : null}
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
                <Filter />
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
                <ArrowUpDown />
              </span>
              <span>{sortLabel}</span>
            </button>
          }
        />
        <GroupPopover
          open={groupOpen}
          onOpenChange={setGroupOpen}
          rules={view.group}
          onGroupChange={onGroupChange}
          groupableFieldDefs={groupableFieldDefs}
          onCollapseAll={onCollapseAllGroups}
          onExpandAll={onExpandAllGroups}
          canToggleExpand={groupActive}
          trigger={
            <button
              type="button"
              className="data-table-toolbar-button"
              data-axis="group"
              data-axis-active={groupActive ? "true" : undefined}
              aria-label={groupLabel}
            >
              <span className="data-table-toolbar-button-icon" aria-hidden>
                <Group />
              </span>
              <span>{groupLabel}</span>
            </button>
          }
        />
        <HideFieldsPopover
          open={hideFieldsOpen}
          onOpenChange={setHideFieldsOpen}
          orderedColumns={orderedColumnsForHidePanel}
          fieldDefByKey={fieldDefByKey}
          hiddenColumns={view.hiddenColumns}
          onChange={onHideFieldsChange}
          trigger={
            <button
              type="button"
              className="data-table-toolbar-button"
              data-axis="hide-fields"
              data-axis-active={hideFieldsActive ? "true" : undefined}
              aria-label={hideFieldsLabel}
            >
              <span className="data-table-toolbar-button-icon" aria-hidden>
                <EyeOff />
              </span>
              <span>{hideFieldsLabel}</span>
            </button>
          }
        />
        <ViewMenuOverflow
          onReset={onResetView}
          canReset={canResetView}
          onDownloadCsv={onDownloadCsv}
          canDownloadCsv={canDownloadCsv}
          actions={overflowMenuActions}
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
