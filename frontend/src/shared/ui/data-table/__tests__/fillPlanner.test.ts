// @size-exception: docs/plans/2026-05-25/plan-23-frontend-refactor-phased.md#phase-8--ci-guards-execute-8th--last
import { describe, expect, test } from "vitest";
import {
  buildFillTargetFromPointer,
  clampRangeToGroup,
  splitRangeByGroup,
} from "../lib/fill/target";
import { chooseFillAxis, chooseFillDirection } from "../lib/fill/axis";
import { planFill } from "../lib/fill/plan";
import { groupPathByRowIdFromBodyPlan } from "../lib/body/plan";
import type { NormalizedRange } from "../lib/range/normalize";
import type { BodyPlanItem, DataTableColumnDef, FieldDef } from "../types";

type Row = { id: string; name: string; floor: string; iCFA: number };

const rows: Row[] = [
  { id: "rm_1", name: "A", floor: "1st", iCFA: 10 },
  { id: "rm_2", name: "B", floor: "1st", iCFA: 20 },
  { id: "rm_3", name: "C", floor: "1st", iCFA: 30 },
  { id: "rm_4", name: "D", floor: "2nd", iCFA: 40 },
  { id: "rm_5", name: "E", floor: "2nd", iCFA: 50 },
];

const columns: DataTableColumnDef<Row>[] = [
  { id: "name", fieldKey: "name", header: "Name", accessor: (row) => row.name },
  { id: "floor", fieldKey: "floor", header: "Floor", accessor: (row) => row.floor },
  { id: "iCFA", fieldKey: "iCFA", header: "iCFA", accessor: (row) => row.iCFA },
];

const fieldDefs: FieldDef[] = [
  { field_key: "name", field_type: "text", display_name: "Name" },
  { field_key: "floor", field_type: "text", display_name: "Floor" },
  { field_key: "iCFA", field_type: "number", display_name: "iCFA" },
];

const getRowId = (row: Row) => row.id;

function rect(
  rowStart: number,
  rowEnd: number,
  columnStart: number,
  columnEnd: number,
): NormalizedRange {
  return { rowStart, rowEnd, columnStart, columnEnd };
}

describe("chooseFillAxis", () => {
  test("returns null below threshold on both axes", () => {
    expect(
      chooseFillAxis({
        pointerStart: { x: 0, y: 0 },
        pointerCurrent: { x: 3, y: 3 },
        axisThreshold: 8,
      }),
    ).toBe(null);
  });

  test("locks vertical when |dy| > |dx| above threshold", () => {
    expect(
      chooseFillAxis({
        pointerStart: { x: 0, y: 0 },
        pointerCurrent: { x: 4, y: 20 },
        axisThreshold: 8,
      }),
    ).toBe("vertical");
  });

  test("locks horizontal when |dx| > |dy| above threshold", () => {
    expect(
      chooseFillAxis({
        pointerStart: { x: 0, y: 0 },
        pointerCurrent: { x: 30, y: 5 },
        axisThreshold: 8,
      }),
    ).toBe("horizontal");
  });

  test("equal deltas at threshold resolve to vertical", () => {
    expect(
      chooseFillAxis({
        pointerStart: { x: 0, y: 0 },
        pointerCurrent: { x: 10, y: 10 },
        axisThreshold: 8,
      }),
    ).toBe("vertical");
  });
});

describe("chooseFillDirection", () => {
  test("vertical: positive dy => down", () => {
    expect(
      chooseFillDirection({
        pointerStart: { x: 0, y: 0 },
        pointerCurrent: { x: 0, y: 20 },
        axis: "vertical",
      }),
    ).toBe("down");
  });

  test("vertical: negative dy => up", () => {
    expect(
      chooseFillDirection({
        pointerStart: { x: 0, y: 0 },
        pointerCurrent: { x: 0, y: -20 },
        axis: "vertical",
      }),
    ).toBe("up");
  });

  test("horizontal: positive dx => right", () => {
    expect(
      chooseFillDirection({
        pointerStart: { x: 0, y: 0 },
        pointerCurrent: { x: 20, y: 0 },
        axis: "horizontal",
      }),
    ).toBe("right");
  });

  test("horizontal: negative dx => left", () => {
    expect(
      chooseFillDirection({
        pointerStart: { x: 0, y: 0 },
        pointerCurrent: { x: -20, y: 0 },
        axis: "horizontal",
      }),
    ).toBe("left");
  });

  test("zero delta defaults to positive direction", () => {
    expect(
      chooseFillDirection({
        pointerStart: { x: 5, y: 5 },
        pointerCurrent: { x: 5, y: 5 },
        axis: "vertical",
      }),
    ).toBe("down");
    expect(
      chooseFillDirection({
        pointerStart: { x: 5, y: 5 },
        pointerCurrent: { x: 5, y: 5 },
        axis: "horizontal",
      }),
    ).toBe("right");
  });
});

describe("buildFillTargetFromPointer", () => {
  test("down: extends the bottom edge to the pointer row", () => {
    const target = buildFillTargetFromPointer({
      source: rect(2, 2, 0, 0),
      pointerCell: { rowIndex: 6, columnIndex: 0 },
      direction: "down",
      rowCount: 10,
      columnCount: 3,
    });
    expect(target).toEqual(rect(2, 6, 0, 0));
  });

  test("down: pointer above source collapses to source", () => {
    const source = rect(3, 4, 0, 0);
    const target = buildFillTargetFromPointer({
      source,
      pointerCell: { rowIndex: 1, columnIndex: 0 },
      direction: "down",
      rowCount: 10,
      columnCount: 3,
    });
    expect(target).toBe(source);
  });

  test("up: extends the top edge to the pointer row", () => {
    const target = buildFillTargetFromPointer({
      source: rect(8, 8, 0, 0),
      pointerCell: { rowIndex: 3, columnIndex: 0 },
      direction: "up",
      rowCount: 10,
      columnCount: 3,
    });
    expect(target).toEqual(rect(3, 8, 0, 0));
  });

  test("up: pointer below source collapses to source", () => {
    const source = rect(3, 4, 0, 0);
    const target = buildFillTargetFromPointer({
      source,
      pointerCell: { rowIndex: 6, columnIndex: 0 },
      direction: "up",
      rowCount: 10,
      columnCount: 3,
    });
    expect(target).toBe(source);
  });

  test("right: extends right edge to pointer column", () => {
    const target = buildFillTargetFromPointer({
      source: rect(0, 0, 1, 1),
      pointerCell: { rowIndex: 0, columnIndex: 2 },
      direction: "right",
      rowCount: 5,
      columnCount: 3,
    });
    expect(target).toEqual(rect(0, 0, 1, 2));
  });

  test("left: extends left edge to pointer column", () => {
    const target = buildFillTargetFromPointer({
      source: rect(0, 0, 2, 2),
      pointerCell: { rowIndex: 0, columnIndex: 0 },
      direction: "left",
      rowCount: 5,
      columnCount: 3,
    });
    expect(target).toEqual(rect(0, 0, 0, 2));
  });

  test("left: pointer right of source collapses to source", () => {
    const source = rect(0, 0, 1, 1);
    const target = buildFillTargetFromPointer({
      source,
      pointerCell: { rowIndex: 0, columnIndex: 2 },
      direction: "left",
      rowCount: 5,
      columnCount: 3,
    });
    expect(target).toBe(source);
  });

  test("clamps the pointer cell to grid bounds", () => {
    const target = buildFillTargetFromPointer({
      source: rect(0, 0, 0, 0),
      pointerCell: { rowIndex: 99, columnIndex: 0 },
      direction: "down",
      rowCount: 5,
      columnCount: 3,
    });
    expect(target).toEqual(rect(0, 4, 0, 0));
  });

  test("clamps negative pointer row on upward fill", () => {
    const target = buildFillTargetFromPointer({
      source: rect(4, 4, 0, 0),
      pointerCell: { rowIndex: -10, columnIndex: 0 },
      direction: "up",
      rowCount: 5,
      columnCount: 3,
    });
    expect(target).toEqual(rect(0, 4, 0, 0));
  });
});

describe("groupPathByRowIdFromBodyPlan", () => {
  test("ungrouped plan maps every row to the empty pathKey", () => {
    const plan: BodyPlanItem<Row>[] = rows.map((row) => ({
      kind: "data",
      row,
      rowId: row.id,
      depth: 0,
    }));
    const map = groupPathByRowIdFromBodyPlan(plan);
    expect(map.get("rm_1")).toBe("");
    expect(map.get("rm_5")).toBe("");
  });

  test("data items inherit the most recent group pathKey", () => {
    const plan: BodyPlanItem<Row>[] = [
      {
        kind: "group",
        depth: 0,
        pathKey: '"1st"',
        fieldDef: fieldDefs[1]!,
        groupValue: "1st",
        count: 3,
        expanded: true,
        aggregatedValues: new Map(),
      },
      { kind: "data", row: rows[0]!, rowId: "rm_1", depth: 1 },
      { kind: "data", row: rows[1]!, rowId: "rm_2", depth: 1 },
      { kind: "data", row: rows[2]!, rowId: "rm_3", depth: 1 },
      {
        kind: "group",
        depth: 0,
        pathKey: '"2nd"',
        fieldDef: fieldDefs[1]!,
        groupValue: "2nd",
        count: 2,
        expanded: true,
        aggregatedValues: new Map(),
      },
      { kind: "data", row: rows[3]!, rowId: "rm_4", depth: 1 },
      { kind: "data", row: rows[4]!, rowId: "rm_5", depth: 1 },
    ];
    const map = groupPathByRowIdFromBodyPlan(plan);
    expect(map.get("rm_1")).toBe('"1st"');
    expect(map.get("rm_3")).toBe('"1st"');
    expect(map.get("rm_4")).toBe('"2nd"');
    expect(map.get("rm_5")).toBe('"2nd"');
  });
});

describe("clampRangeToGroup", () => {
  const groupPathByRowId = new Map<string, string>([
    ["rm_1", "1st"],
    ["rm_2", "1st"],
    ["rm_3", "1st"],
    ["rm_4", "2nd"],
    ["rm_5", "2nd"],
  ]);
  const rowIds = ["rm_1", "rm_2", "rm_3", "rm_4", "rm_5"];

  test("horizontal axis is a no-op", () => {
    const target = rect(0, 4, 0, 2);
    const result = clampRangeToGroup({
      target,
      source: rect(0, 0, 0, 0),
      groupPathByRowId,
      rowIds,
      axis: "horizontal",
    });
    expect(result.clamped).toBe(target);
    expect(result.wasClamped).toBe(false);
  });

  test("ungrouped source ('' pathKey) is a no-op", () => {
    const result = clampRangeToGroup({
      target: rect(0, 4, 0, 0),
      source: rect(0, 0, 0, 0),
      groupPathByRowId: new Map(rowIds.map((id) => [id, ""])),
      rowIds,
      axis: "vertical",
    });
    expect(result.wasClamped).toBe(false);
    expect(result.clamped).toEqual(rect(0, 4, 0, 0));
  });

  test("vertical: trims target rowEnd to the last in-group row", () => {
    const result = clampRangeToGroup({
      target: rect(0, 4, 0, 0),
      source: rect(0, 0, 0, 0),
      groupPathByRowId,
      rowIds,
      axis: "vertical",
    });
    expect(result.clamped).toEqual(rect(0, 2, 0, 0));
    expect(result.wasClamped).toBe(true);
  });

  test("vertical: leaves rowEnd alone when target stays in-group", () => {
    const result = clampRangeToGroup({
      target: rect(0, 2, 0, 0),
      source: rect(0, 0, 0, 0),
      groupPathByRowId,
      rowIds,
      axis: "vertical",
    });
    expect(result.clamped).toEqual(rect(0, 2, 0, 0));
    expect(result.wasClamped).toBe(false);
  });

  test("vertical: trims target rowStart upward to the first in-group row", () => {
    // Source = rm_4 ("2nd" group). Target extends upward to row 0 (rm_1,
    // "1st" group). Expect clamp top edge to row 3 (rm_4 itself, since
    // every row above is in "1st").
    const result = clampRangeToGroup({
      target: rect(0, 3, 0, 0),
      source: rect(3, 3, 0, 0),
      groupPathByRowId,
      rowIds,
      axis: "vertical",
    });
    expect(result.clamped).toEqual(rect(3, 3, 0, 0));
    expect(result.wasClamped).toBe(true);
  });

  test("vertical: upward target stays put when run is in-group", () => {
    // Source = rm_3 ("1st"). Target extends upward to rm_1, all "1st".
    const result = clampRangeToGroup({
      target: rect(0, 2, 0, 0),
      source: rect(2, 2, 0, 0),
      groupPathByRowId,
      rowIds,
      axis: "vertical",
    });
    expect(result.clamped).toEqual(rect(0, 2, 0, 0));
    expect(result.wasClamped).toBe(false);
  });
});

describe("splitRangeByGroup", () => {
  const groupPathByRowId = new Map<string, string>([
    ["rm_1", "1st"],
    ["rm_2", "1st"],
    ["rm_3", "1st"],
    ["rm_4", "2nd"],
    ["rm_5", "2nd"],
  ]);
  const rowIds = ["rm_1", "rm_2", "rm_3", "rm_4", "rm_5"];

  test("single-group selection produces one sub-range", () => {
    const subs = splitRangeByGroup({
      range: rect(0, 2, 0, 1),
      groupPathByRowId,
      rowIds,
    });
    expect(subs).toEqual([rect(0, 2, 0, 1)]);
  });

  test("cross-group selection splits at the boundary", () => {
    const subs = splitRangeByGroup({
      range: rect(1, 4, 0, 2),
      groupPathByRowId,
      rowIds,
    });
    expect(subs).toEqual([rect(1, 2, 0, 2), rect(3, 4, 0, 2)]);
  });
});

describe("planFill", () => {
  test("1x1 source fill-down writes value to all target rows below", () => {
    const result = planFill({
      source: rect(0, 0, 0, 0),
      target: rect(0, 3, 0, 0),
      rows,
      columns,
      fieldDefs,
      getRowId,
    });
    expect(result.writes).toHaveLength(3);
    expect(result.writes.map((w) => w.value)).toEqual(["A", "A", "A"]);
    expect(result.writes.map((w) => w.rowId)).toEqual(["rm_2", "rm_3", "rm_4"]);
    expect(result.inverse.map((w) => w.value)).toEqual(["B", "C", "D"]);
    expect(result.skipped).toBe(0);
  });

  test("3x1 source fill-down repeats cyclically", () => {
    const result = planFill({
      source: rect(0, 2, 0, 0),
      target: rect(0, 4, 0, 0),
      rows,
      columns,
      fieldDefs,
      getRowId,
    });
    expect(result.writes).toHaveLength(2);
    expect(result.writes.map((w) => w.value)).toEqual(["A", "B"]);
  });

  test("1x1 source fill-right cycles across columns", () => {
    const result = planFill({
      source: rect(0, 0, 0, 0),
      target: rect(0, 0, 0, 2),
      rows,
      columns,
      fieldDefs,
      getRowId,
    });
    expect(result.writes).toHaveLength(2);
    expect(result.writes.map((w) => w.fieldKey)).toEqual(["floor", "iCFA"]);
    expect(result.writes.map((w) => w.value)).toEqual(["A", "A"]);
  });

  test("read-only target columns are skipped", () => {
    const ro: FieldDef[] = [
      { field_key: "name", field_type: "text", display_name: "Name" },
      { field_key: "floor", field_type: "text", display_name: "Floor", read_only: true },
      { field_key: "iCFA", field_type: "number", display_name: "iCFA" },
    ];
    const result = planFill({
      source: rect(0, 0, 0, 0),
      target: rect(0, 0, 0, 2),
      rows,
      columns,
      fieldDefs: ro,
      getRowId,
    });
    expect(result.writes).toHaveLength(1);
    expect(result.writes[0]!.fieldKey).toBe("iCFA");
    expect(result.skipped).toBe(1);
  });

  test("1x1 source fill-up cycles to source.rowEnd at the row immediately above", () => {
    // Source = row 3 ("D"). Target rows 0..3. Row 2 ("C") should
    // become "D", row 1 → "D", row 0 → "D" (1-row source, no cycle).
    const result = planFill({
      source: rect(3, 3, 0, 0),
      target: rect(0, 3, 0, 0),
      rows,
      columns,
      fieldDefs,
      getRowId,
    });
    expect(result.writes).toHaveLength(3);
    expect(result.writes.map((w) => w.rowId)).toEqual(["rm_1", "rm_2", "rm_3"]);
    expect(result.writes.map((w) => w.value)).toEqual(["D", "D", "D"]);
    expect(result.inverse.map((w) => w.value)).toEqual(["A", "B", "C"]);
  });

  test("3x1 source fill-up cycles values per the natural-extension rule", () => {
    // Source rows 2..4 (C, D, E). Target rows 0..4. The cycle continues
    // upward so the row immediately above source.rowStart=2 picks
    // source.rowEnd=4 (=E), then 3 (=D), with another tile above.
    const result = planFill({
      source: rect(2, 4, 0, 0),
      target: rect(0, 4, 0, 0),
      rows,
      columns,
      fieldDefs,
      getRowId,
    });
    expect(result.writes).toHaveLength(2);
    expect(result.writes.map((w) => w.rowId)).toEqual(["rm_1", "rm_2"]);
    // r=0: source.rowStart + (((-2) % 3 + 3) % 3) = 2 + 1 = 3 -> rm_4 "D"
    // r=1: source.rowStart + (((-1) % 3 + 3) % 3) = 2 + 2 = 4 -> rm_5 "E"
    expect(result.writes.map((w) => w.value)).toEqual(["D", "E"]);
  });

  test("1x1 source fill-left cycles across columns to the left", () => {
    // Source = row 0, column "iCFA" (col 2). Target row 0, columns 0..2.
    const result = planFill({
      source: rect(0, 0, 2, 2),
      target: rect(0, 0, 0, 2),
      rows,
      columns,
      fieldDefs,
      getRowId,
    });
    expect(result.writes).toHaveLength(2);
    expect(result.writes.map((w) => w.fieldKey)).toEqual(["name", "floor"]);
    expect(result.writes.map((w) => w.value)).toEqual([10, 10]);
  });

  test("source and target equal => zero writes (fill canceled)", () => {
    const result = planFill({
      source: rect(0, 0, 0, 0),
      target: rect(0, 0, 0, 0),
      rows,
      columns,
      fieldDefs,
      getRowId,
    });
    expect(result.writes).toEqual([]);
    expect(result.inverse).toEqual([]);
  });
});
