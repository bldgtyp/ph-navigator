import { describe, expect, it } from "vitest";
import type { RowInsertPayload } from "../types";
import { flattenBatchedRowInserts } from "./rowInsertBatching";

const row = (rowId: string, anchorRowId: string | null): RowInsertPayload => ({
  rowId,
  anchorRowId,
  fieldDefaults: {},
});

describe("flattenBatchedRowInserts", () => {
  it("chains same-anchor inserts in gesture order", () => {
    expect(
      flattenBatchedRowInserts([[row("A", "anchor")], [row("B", "anchor")], [row("C", "anchor")]]),
    ).toEqual([row("A", "anchor"), row("B", "A"), row("C", "B")]);
  });

  it("keeps unrelated anchor chains independent", () => {
    expect(
      flattenBatchedRowInserts([
        [row("A", "anchor"), row("X", "other")],
        [row("B", "anchor"), row("Y", "other")],
      ]),
    ).toEqual([row("A", "anchor"), row("X", "other"), row("B", "A"), row("Y", "X")]);
  });
});
