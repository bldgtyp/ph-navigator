import type { DataTableColumnDef, FieldDef, SortRule, ViewState } from "../../types";
import { pruneExpandedGroups } from "../body/prune";
import { fieldKeyFieldDefMap } from "../internal/fieldKeyFieldDefMap";

// Derived sort prepended with group rules. The user's `view.sort` is
// preserved as-is in user intent; only the derived list dedups against
// `view.group` so a field doesn't appear twice in the comparator. The
// group's direction wins when a field is in both lists.
export function effectiveSortFromView(view: Pick<ViewState, "group" | "sort">): SortRule[] {
  if (view.group.length === 0) return view.sort;
  const groupSort: SortRule[] = view.group.map((rule) => ({
    fieldKey: rule.fieldKey,
    direction: rule.direction,
  }));
  const groupKeys = new Set(groupSort.map((rule) => rule.fieldKey));
  const userSort = view.sort.filter((rule) => !groupKeys.has(rule.fieldKey));
  return [...groupSort, ...userSort];
}

// Drop view-state references to columns or single-select options that
// no longer exist in the currently-rendered schema. Render-only — the
// persistence layer must not auto-save the sanitized result, so an
// older locked version with fewer fields cannot destroy the head-
// version preference.
export function sanitizeViewStateForSchema(
  view: ViewState,
  fieldDefs: readonly FieldDef[],
  columns: readonly DataTableColumnDef<unknown>[],
): ViewState {
  const fieldDefByKey = fieldKeyFieldDefMap(fieldDefs);
  const columnIds = new Set(columns.map((column) => column.id));
  const fieldKeys = new Set(columns.map((column) => column.fieldKey));
  const validOptionIds = (fieldKey: string): Set<string> | null => {
    const fieldDef = fieldDefByKey.get(fieldKey);
    if (fieldDef?.field_type !== "single_select") return null;
    return new Set((fieldDef.options ?? []).map((option) => option.id));
  };

  const filter = view.filter
    .filter((rule) => fieldKeys.has(rule.fieldKey))
    .map((rule) => {
      const options = validOptionIds(rule.fieldKey);
      if (!options || !rule.valueList) return rule;
      const pruned = rule.valueList.filter((optionId) => options.has(optionId));
      return pruned.length === rule.valueList.length ? rule : { ...rule, valueList: pruned };
    });

  const sort = view.sort.filter((rule) => fieldKeys.has(rule.fieldKey));
  const group = view.group.filter((rule) => fieldKeys.has(rule.fieldKey));

  const aggregations: Record<string, (typeof view.aggregations)[string]> = {};
  for (const [fieldKey, kind] of Object.entries(view.aggregations)) {
    if (fieldKeys.has(fieldKey)) aggregations[fieldKey] = kind;
  }

  const columnOrder = view.columnOrder.filter((id) => columnIds.has(id));

  const columnWidths: Record<string, number> = {};
  for (const [id, width] of Object.entries(view.columnWidths)) {
    if (columnIds.has(id)) columnWidths[id] = width;
  }

  const hiddenColumns = view.hiddenColumns.filter((id) => columnIds.has(id));

  // Expansion keys are scoped to the (possibly sanitized) group rules;
  // when group narrows we also prune the deeper paths so stale entries
  // don't outlive the rules they belonged to.
  const expandedGroups = pruneExpandedGroups(view.expandedGroups, group);

  return {
    filter,
    sort,
    group,
    aggregations,
    columnOrder,
    columnWidths,
    hiddenColumns,
    expandedGroups,
  };
}
