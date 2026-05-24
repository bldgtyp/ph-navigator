import { describe, expect, test } from "vitest";
import {
  buildBodyPlan,
  effectiveSortFromView,
  firstDivergeIndex,
  groupPathKey,
  pruneExpandedGroups,
} from "../lib";
import type { BodyPlanItem, DataTableColumnDef, FieldDef, ViewState } from "../types";

type Room = {
  id: string;
  floor: string;
  zone: string;
  icfa: number;
};

const rooms: Room[] = [
  { id: "rm_1", floor: "1st", zone: "A", icfa: 100 },
  { id: "rm_2", floor: "1st", zone: "A", icfa: 200 },
  { id: "rm_3", floor: "1st", zone: "B", icfa: 50 },
  { id: "rm_4", floor: "2nd", zone: "A", icfa: 150 },
  { id: "rm_5", floor: "2nd", zone: "B", icfa: 75 },
];

const columns: DataTableColumnDef<Room>[] = [
  { id: "floor", fieldKey: "floor", header: "Floor", accessor: (r) => r.floor },
  { id: "zone", fieldKey: "zone", header: "Zone", accessor: (r) => r.zone },
  { id: "icfa", fieldKey: "icfa", header: "iCFA", accessor: (r) => r.icfa },
];

const fieldDefs: FieldDef[] = [
  { field_key: "floor", field_type: "text", display_name: "Floor" },
  { field_key: "zone", field_type: "text", display_name: "Zone" },
  { field_key: "icfa", field_type: "number", display_name: "iCFA" },
];

function emptyView(overrides: Partial<ViewState> = {}): ViewState {
  return {
    filter: [],
    sort: [],
    group: [],
    aggregations: {},
    columnOrder: [],
    columnWidths: {},
    hiddenColumns: [],
    expandedGroups: {},
    ...overrides,
  };
}

describe("groupPathKey", () => {
  test("returns stable strings for identical paths", () => {
    expect(groupPathKey(["1st", "A"])).toBe(groupPathKey(["1st", "A"]));
  });
  test("differs across slightly-different paths", () => {
    expect(groupPathKey([1, "a"])).not.toBe(groupPathKey([1, "b"]));
  });
  test("normalizes null and undefined to the same segment", () => {
    expect(groupPathKey([null])).toBe(groupPathKey([undefined]));
  });
});

describe("firstDivergeIndex", () => {
  test("returns the index of the first different element", () => {
    expect(firstDivergeIndex(["1st", "A"], ["1st", "B"])).toBe(1);
    expect(firstDivergeIndex(["1st", "A"], ["2nd", "A"])).toBe(0);
    expect(firstDivergeIndex(["1st", "A"], ["1st", "A"])).toBe(2);
  });
  test("returns the shorter length when one is a prefix of the other", () => {
    expect(firstDivergeIndex(["1st"], ["1st", "A"])).toBe(1);
  });
});

describe("pruneExpandedGroups", () => {
  test("clears the map when nextGroup is empty", () => {
    expect(pruneExpandedGroups({ a: false }, [])).toEqual({});
  });
  test("drops keys whose depth exceeds the new group depth", () => {
    const map = {
      [groupPathKey(["1st"])]: false,
      [groupPathKey(["1st", "A"])]: false,
    };
    const next = pruneExpandedGroups(map, [{ fieldKey: "floor", direction: "asc" }]);
    expect(Object.keys(next)).toEqual([groupPathKey(["1st"])]);
  });
  test("keeps keys at or below the new depth", () => {
    const map = {
      [groupPathKey(["1st"])]: false,
      [groupPathKey(["1st", "A"])]: false,
    };
    const next = pruneExpandedGroups(map, [
      { fieldKey: "floor", direction: "asc" },
      { fieldKey: "zone", direction: "asc" },
    ]);
    expect(Object.keys(next).sort()).toEqual(
      [groupPathKey(["1st"]), groupPathKey(["1st", "A"])].sort(),
    );
  });
});

describe("effectiveSortFromView", () => {
  test("returns view.sort unchanged when there are no group rules", () => {
    const view = emptyView({ sort: [{ fieldKey: "icfa", direction: "asc" }] });
    expect(effectiveSortFromView(view)).toBe(view.sort);
  });

  test("prepends group rules to sort rules", () => {
    const view = emptyView({
      group: [{ fieldKey: "floor", direction: "asc" }],
      sort: [{ fieldKey: "icfa", direction: "desc" }],
    });
    expect(effectiveSortFromView(view)).toEqual([
      { fieldKey: "floor", direction: "asc" },
      { fieldKey: "icfa", direction: "desc" },
    ]);
  });

  test("drops a sort rule whose field also appears in group (group direction wins)", () => {
    const view = emptyView({
      group: [{ fieldKey: "floor", direction: "asc" }],
      sort: [{ fieldKey: "floor", direction: "desc" }],
    });
    expect(effectiveSortFromView(view)).toEqual([{ fieldKey: "floor", direction: "asc" }]);
    // User-intent sort is preserved unchanged in the input.
    expect(view.sort).toEqual([{ fieldKey: "floor", direction: "desc" }]);
  });
});

describe("buildBodyPlan", () => {
  const getRowId = (r: Room) => r.id;

  test("ungrouped view returns a flat sequence of data items", () => {
    const view = emptyView();
    const plan = buildBodyPlan(rooms, columns, fieldDefs, getRowId, view);
    expect(plan).toHaveLength(rooms.length);
    expect(plan.every((item) => item.kind === "data")).toBe(true);
  });

  test("one-level group interleaves group headers between distinct values", () => {
    const view = emptyView({ group: [{ fieldKey: "floor", direction: "asc" }] });
    const plan = buildBodyPlan(rooms, columns, fieldDefs, getRowId, view);
    const kinds = plan.map((p) => p.kind);
    // Expected: [group "1st", data, data, data, group "2nd", data, data]
    expect(kinds).toEqual(["group", "data", "data", "data", "group", "data", "data"]);
    const firstGroup = plan[0] as Extract<BodyPlanItem<Room>, { kind: "group" }>;
    expect(firstGroup.depth).toBe(0);
    expect(firstGroup.groupValue).toBe("1st");
    expect(firstGroup.count).toBe(3);
  });

  test("two-level group emits depth-0 + depth-1 headers", () => {
    const view = emptyView({
      group: [
        { fieldKey: "floor", direction: "asc" },
        { fieldKey: "zone", direction: "asc" },
      ],
    });
    const plan = buildBodyPlan(rooms, columns, fieldDefs, getRowId, view);
    // 1st (depth 0) → A (depth 1) → rm_1 rm_2; B (depth 1) → rm_3
    // 2nd (depth 0) → A (depth 1) → rm_4; B (depth 1) → rm_5
    const groupItems = plan.filter(
      (p): p is Extract<BodyPlanItem<Room>, { kind: "group" }> => p.kind === "group",
    );
    expect(groupItems.map((g) => g.depth)).toEqual([0, 1, 1, 0, 1, 1]);
    expect(groupItems.map((g) => g.groupValue)).toEqual(["1st", "A", "B", "2nd", "A", "B"]);
  });

  test("collapsed parent hides descendants (data + child group headers)", () => {
    const collapseKey = groupPathKey(["1st"]);
    const view = emptyView({
      group: [
        { fieldKey: "floor", direction: "asc" },
        { fieldKey: "zone", direction: "asc" },
      ],
      expandedGroups: { [collapseKey]: false },
    });
    const plan = buildBodyPlan(rooms, columns, fieldDefs, getRowId, view);
    const groupItems = plan.filter(
      (p): p is Extract<BodyPlanItem<Room>, { kind: "group" }> => p.kind === "group",
    );
    // The 1st-floor header still appears (it's the collapsed parent), but
    // its child zone headers and its data rows are hidden.
    expect(groupItems.map((g) => g.groupValue)).toEqual(["1st", "2nd", "A", "B"]);
    const dataItems = plan.filter((p) => p.kind === "data");
    expect(
      dataItems.map((d) => (d as Extract<BodyPlanItem<Room>, { kind: "data" }>).rowId),
    ).toEqual(["rm_4", "rm_5"]);
  });

  test("count reflects all descendant data rows including collapsed ones", () => {
    const view = emptyView({
      group: [{ fieldKey: "floor", direction: "asc" }],
      expandedGroups: { [groupPathKey(["1st"])]: false },
    });
    const plan = buildBodyPlan(rooms, columns, fieldDefs, getRowId, view);
    const firstGroup = plan[0] as Extract<BodyPlanItem<Room>, { kind: "group" }>;
    expect(firstGroup.count).toBe(3);
  });

  test("aggregated values format via the registry", () => {
    const view = emptyView({
      group: [{ fieldKey: "floor", direction: "asc" }],
      aggregations: { icfa: "mean" },
    });
    const plan = buildBodyPlan(rooms, columns, fieldDefs, getRowId, view);
    const firstGroup = plan[0] as Extract<BodyPlanItem<Room>, { kind: "group" }>;
    // 1st-floor rooms: 100, 200, 50 → mean 116.67
    expect(firstGroup.aggregatedValues.get("icfa")).toBe("116.67");
  });

  test("aggregations of kind 'none' produce no aggregated entry", () => {
    const view = emptyView({
      group: [{ fieldKey: "floor", direction: "asc" }],
      aggregations: { icfa: "none" },
    });
    const plan = buildBodyPlan(rooms, columns, fieldDefs, getRowId, view);
    const firstGroup = plan[0] as Extract<BodyPlanItem<Room>, { kind: "group" }>;
    expect(firstGroup.aggregatedValues.size).toBe(0);
  });

  test("falls back to a flat data plan when group field is unknown", () => {
    const view = emptyView({ group: [{ fieldKey: "nonexistent", direction: "asc" }] });
    const plan = buildBodyPlan(rooms, columns, fieldDefs, getRowId, view);
    expect(plan.every((p) => p.kind === "data")).toBe(true);
    expect(plan).toHaveLength(rooms.length);
  });
});
