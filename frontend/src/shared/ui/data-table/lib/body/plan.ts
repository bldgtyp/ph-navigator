import type { BodyPlanItem, DataTableColumnDef, FieldDef, GroupRule, ViewState } from "../../types";
import { computeAggregatesByPath } from "./aggregates";

// Stable string key for an `expandedGroups` lookup. Client-only;
// never reaches the backend.
export function groupPathKey(values: readonly unknown[]): string {
  return values.map((value) => JSON.stringify(value ?? null)).join("::");
}

// Build the interleaved group-header + data-row plan. `rows` must be
// pre-sorted via `effectiveSortFromView` so rows sharing a path arrive
// contiguously. Aggregated values are precomputed and passed in so a
// chevron toggle (which only flips `view.expandedGroups`) skips the
// aggregation pass entirely.
export function buildBodyPlan<TRow>(
  rows: readonly TRow[],
  columns: readonly DataTableColumnDef<TRow>[],
  fieldDefs: readonly FieldDef[],
  getRowId: (row: TRow) => string,
  view: Pick<ViewState, "group" | "expandedGroups" | "aggregations">,
  aggregatesByPath?: Map<string, { count: number; values: Map<string, string> }>,
): BodyPlanItem<TRow>[] {
  if (view.group.length === 0) {
    return rows.map((row) => ({
      kind: "data",
      row,
      rowId: getRowId(row),
      depth: 0,
    }));
  }
  const resolved = resolveGroupRules(view.group, columns, fieldDefs);
  if (!resolved) {
    return rows.map((row) => ({
      kind: "data",
      row,
      rowId: getRowId(row),
      depth: 0,
    }));
  }
  const { groupFieldDefs, groupAccessors } = resolved;
  const aggregates =
    aggregatesByPath ?? computeAggregatesByPath(rows, columns, fieldDefs, view, groupAccessors);

  const plan: BodyPlanItem<TRow>[] = [];
  let prevPath: unknown[] = [];
  let isFirstRow = true;
  for (const row of rows) {
    const path = groupAccessors.map((accessor) => accessor(row));
    const divergeAt = isFirstRow ? 0 : firstDivergeIndex(prevPath, path);
    isFirstRow = false;
    if (
      divergeAt < view.group.length &&
      !isAncestorCollapsed(view.expandedGroups, path, divergeAt)
    ) {
      for (let depth = divergeAt; depth < view.group.length; depth += 1) {
        const pathKey = groupPathKey(path.slice(0, depth + 1));
        const expanded = view.expandedGroups[pathKey] ?? true;
        const agg = aggregates.get(pathKey);
        plan.push({
          kind: "group",
          depth,
          pathKey,
          fieldDef: groupFieldDefs[depth]!,
          groupValue: path[depth],
          count: agg?.count ?? 0,
          expanded,
          aggregatedValues: agg?.values ?? new Map(),
        });
        // Hide both data rows AND deeper group headers under a
        // collapsed parent.
        if (!expanded) break;
      }
    }
    prevPath = path;
    if (!isPathFullyExpanded(view.expandedGroups, path)) continue;
    plan.push({
      kind: "data",
      row,
      rowId: getRowId(row),
      depth: view.group.length,
    });
  }
  return plan;
}

export function resolveGroupRules<TRow>(
  group: readonly GroupRule[],
  columns: readonly DataTableColumnDef<TRow>[],
  fieldDefs: readonly FieldDef[],
): { groupFieldDefs: FieldDef[]; groupAccessors: ((row: TRow) => unknown)[] } | null {
  const fieldDefByKey = new Map(fieldDefs.map((f) => [f.field_key, f]));
  const columnByKey = new Map(columns.map((c) => [c.fieldKey, c]));
  const groupFieldDefs: FieldDef[] = [];
  const groupAccessors: ((row: TRow) => unknown)[] = [];
  for (const rule of group) {
    const fieldDef = fieldDefByKey.get(rule.fieldKey);
    const column = columnByKey.get(rule.fieldKey);
    if (!fieldDef || !column) return null;
    groupFieldDefs.push(fieldDef);
    groupAccessors.push(column.accessor);
  }
  return { groupFieldDefs, groupAccessors };
}

export function isAncestorCollapsed(
  expandedGroups: Readonly<Record<string, boolean>>,
  path: readonly unknown[],
  divergeAt: number,
): boolean {
  for (let depth = 0; depth < divergeAt; depth += 1) {
    const key = groupPathKey(path.slice(0, depth + 1));
    if (expandedGroups[key] === false) return true;
  }
  return false;
}

// Returns the index where `prev` and `next` first diverge. If one is a
// prefix of the other, returns the shorter length.
export function firstDivergeIndex(prev: readonly unknown[], next: readonly unknown[]): number {
  const len = Math.min(prev.length, next.length);
  for (let i = 0; i < len; i += 1) {
    const a = prev[i];
    const b = next[i];
    if (a === b) continue;
    // Group keys are primitive cell values 99% of the time; only fall
    // through to a structural compare for the rare object case.
    if (
      a !== null &&
      b !== null &&
      typeof a === "object" &&
      typeof b === "object" &&
      JSON.stringify(a) === JSON.stringify(b)
    )
      continue;
    return i;
  }
  return len;
}

export function isPathFullyExpanded(
  expandedGroups: Readonly<Record<string, boolean>>,
  path: readonly unknown[],
): boolean {
  for (let depth = 0; depth < path.length; depth += 1) {
    const key = groupPathKey(path.slice(0, depth + 1));
    if (expandedGroups[key] === false) return false;
  }
  return true;
}

// Next `expandedGroups` with every collapsed ancestor of `path`
// removed (absence == expanded), so the row at `path` becomes visible.
// Returns null when nothing on the path is collapsed.
export function expandedGroupsRevealing(
  expandedGroups: Readonly<Record<string, boolean>>,
  path: readonly unknown[],
): Record<string, boolean> | null {
  if (isPathFullyExpanded(expandedGroups, path)) return null;
  const next = { ...expandedGroups };
  for (let depth = 0; depth < path.length; depth += 1) {
    delete next[groupPathKey(path.slice(0, depth + 1))];
  }
  return next;
}

// Map data-row id → innermost group's `pathKey`. Group-header items are
// skipped; their pathKey is recorded as the "current path" so subsequent
// data items inherit it. Ungrouped views produce a map where every
// entry maps to the empty-string sentinel.
export function groupPathByRowIdFromBodyPlan<TRow>(
  bodyPlan: readonly BodyPlanItem<TRow>[],
): Map<string, string> {
  const map = new Map<string, string>();
  let currentPathKey = "";
  for (const item of bodyPlan) {
    if (item.kind === "group") {
      currentPathKey = item.pathKey;
      continue;
    }
    map.set(item.rowId, currentPathKey);
  }
  return map;
}
