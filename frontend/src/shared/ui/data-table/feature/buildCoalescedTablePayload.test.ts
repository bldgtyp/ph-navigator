import { describe, expect, it, vi } from "vitest";
import type { WriteOp } from "../types";
import { buildCoalescedTablePayload } from "./buildCoalescedTablePayload";

type Slice = { rows: string[] };

describe("buildCoalescedTablePayload", () => {
  it("builds one insert projection and one cell projection for the whole batch", () => {
    const fromRowInsert = vi.fn((slice: Slice, rows: Array<{ rowId: string }>) => ({
      rows: [...slice.rows, ...rows.map((row) => row.rowId)],
    }));
    const fromCellWrites = vi.fn((slice: Slice) => ({ rows: [...slice.rows, "cells"] }));
    const ops: WriteOp[] = [
      {
        kind: "rowInsert",
        rows: [{ rowId: "A", anchorRowId: "root", fieldDefaults: {} }],
      },
      {
        kind: "rowInsert",
        rows: [{ rowId: "B", anchorRowId: "root", fieldDefaults: {} }],
      },
      {
        kind: "cell",
        writes: [{ rowId: "A", fieldKey: "name", value: "updated" }],
      },
    ];
    const payload = buildCoalescedTablePayload(
      { rows: ["root"] },
      ops,
      {
        fromRowInsert,
        fromCellWrites,
        fromRowDelete: vi.fn(),
        fromRowDuplicate: vi.fn(),
        validate: () => null,
      },
      ({ rowId }) => ({ id: rowId }),
    );
    expect(payload).toEqual({ rows: ["root", "A", "B", "cells"] });
    expect(fromRowInsert).toHaveBeenCalledOnce();
    expect(fromRowInsert.mock.calls[0]?.[1]).toEqual([
      { rowId: "A", anchorRowId: "root", fieldDefaults: {} },
      { rowId: "B", anchorRowId: "A", fieldDefaults: {} },
    ]);
    expect(fromCellWrites).toHaveBeenCalledOnce();
  });

  it("applies last-action-wins option delta algebra while preserving option order", () => {
    const fromCellWrites = vi.fn((_slice, _writes, newOptions, removedOptions) => ({
      rows: [JSON.stringify({ newOptions, removedOptions })],
    }));
    const optionA = { id: "a", label: "A", color: "#000000", order: 0 };
    const optionB = { id: "b", label: "B", color: "#ffffff", order: 1 };
    const ops: WriteOp[] = [
      {
        kind: "cell",
        writes: [],
        newOptions: { status: [optionA] },
        removedOptions: { status: ["b"] },
      },
      {
        kind: "cell",
        writes: [],
        newOptions: { status: [optionB] },
        removedOptions: { status: ["a"] },
      },
    ];
    buildCoalescedTablePayload(
      { rows: [] },
      ops,
      {
        fromCellWrites,
        fromRowInsert: vi.fn(),
        fromRowDelete: vi.fn(),
        fromRowDuplicate: vi.fn(),
        validate: () => null,
      },
      ({ rowId }) => ({ id: rowId }),
    );
    expect(fromCellWrites).toHaveBeenCalledWith(
      { rows: [] },
      [],
      { status: [optionB] },
      { status: ["a"] },
    );
  });
});
