import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { useGridHistory, type HistoryEntry } from "../hooks/useGridHistory";
import type { WriteOp } from "../types";

function makeEntry(seed: string): HistoryEntry {
  const op: WriteOp = {
    kind: "cell",
    writes: [{ rowId: `rm_${seed}`, fieldKey: "name", value: seed }],
  };
  const inverse: WriteOp = {
    kind: "cell",
    writes: [{ rowId: `rm_${seed}`, fieldKey: "name", value: `${seed}-prev` }],
  };
  return { op, inverse };
}

describe("useGridHistory", () => {
  test("push adds an entry and exposes canUndo", () => {
    const { result } = renderHook(() => useGridHistory());
    expect(result.current.canUndo).toBe(false);

    act(() => result.current.push(makeEntry("a")));

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  test("undo moves entries to the redo stack", () => {
    const { result } = renderHook(() => useGridHistory());
    act(() => result.current.push(makeEntry("a")));

    let undone: HistoryEntry | null = null;
    act(() => {
      undone = result.current.undo();
    });

    expect(undone).not.toBeNull();
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  test("redo moves entries back to undo", () => {
    const { result } = renderHook(() => useGridHistory());
    act(() => result.current.push(makeEntry("a")));
    act(() => {
      result.current.undo();
    });

    act(() => {
      result.current.redo();
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  test("push clears the redo stack", () => {
    const { result } = renderHook(() => useGridHistory());
    act(() => result.current.push(makeEntry("a")));
    act(() => {
      result.current.undo();
    });
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.push(makeEntry("b")));

    expect(result.current.canRedo).toBe(false);
  });

  test("clear empties both stacks", () => {
    const { result } = renderHook(() => useGridHistory());
    act(() => {
      result.current.push(makeEntry("a"));
      result.current.push(makeEntry("b"));
      result.current.undo();
    });

    act(() => result.current.clear());

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  test("capacity drops oldest entries on overflow", () => {
    const { result } = renderHook(() => useGridHistory({ capacity: 2 }));
    act(() => {
      result.current.push(makeEntry("a"));
      result.current.push(makeEntry("b"));
      result.current.push(makeEntry("c"));
    });

    const seen: string[] = [];
    act(() => {
      let entry = result.current.undo();
      while (entry) {
        const op = entry.op;
        if (op.kind === "cell" && op.writes[0]) seen.push(String(op.writes[0].value));
        entry = result.current.undo();
      }
    });

    // Most-recent-first; "a" was evicted.
    expect(seen).toEqual(["c", "b"]);
  });
});
