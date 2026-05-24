import { act, renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { useGridHistory } from "../hooks/useGridHistory";
import { useGridWriteReducer } from "../hooks/useGridWriteReducer";
import type { WriteOp } from "../types";

const forward: WriteOp = {
  kind: "cell",
  writes: [{ rowId: "rm_1", fieldKey: "name", value: "next" }],
};
const inverse: WriteOp = {
  kind: "cell",
  writes: [{ rowId: "rm_1", fieldKey: "name", value: "prev" }],
};

function useHarness(onWrite?: (op: WriteOp) => void | Promise<void>) {
  const history = useGridHistory();
  const reducer = useGridWriteReducer({ history, onWrite });
  return { history, reducer };
}

describe("useGridWriteReducer", () => {
  test("dispatchWrite forwards the op and pushes one history entry", async () => {
    const onWrite = vi.fn();
    const { result } = renderHook(() => useHarness(onWrite));

    await act(async () => {
      await result.current.reducer.dispatchWrite(forward, inverse);
    });

    expect(onWrite).toHaveBeenCalledTimes(1);
    expect(onWrite).toHaveBeenCalledWith(forward);
    expect(result.current.history.canUndo).toBe(true);
  });

  test("undoOnce dispatches the inverse op without pushing a new entry", async () => {
    const onWrite = vi.fn();
    const { result } = renderHook(() => useHarness(onWrite));

    await act(async () => {
      await result.current.reducer.dispatchWrite(forward, inverse);
    });
    onWrite.mockClear();

    await act(async () => {
      await result.current.reducer.undoOnce();
    });

    expect(onWrite).toHaveBeenCalledWith(inverse);
    expect(result.current.history.canUndo).toBe(false);
    expect(result.current.history.canRedo).toBe(true);
  });

  test("redoOnce dispatches the forward op without pushing a new entry", async () => {
    const onWrite = vi.fn();
    const { result } = renderHook(() => useHarness(onWrite));

    await act(async () => {
      await result.current.reducer.dispatchWrite(forward, inverse);
      await result.current.reducer.undoOnce();
    });
    onWrite.mockClear();

    await act(async () => {
      await result.current.reducer.redoOnce();
    });

    expect(onWrite).toHaveBeenCalledWith(forward);
    expect(result.current.history.canUndo).toBe(true);
    expect(result.current.history.canRedo).toBe(false);
  });

  test("rejected dispatch leaves history untouched", async () => {
    const onWrite = vi.fn().mockRejectedValueOnce(new Error("nope"));
    const { result } = renderHook(() => useHarness(onWrite));

    await act(async () => {
      await expect(result.current.reducer.dispatchWrite(forward, inverse)).rejects.toThrow("nope");
    });

    expect(result.current.history.canUndo).toBe(false);
  });

  test("fieldDefMutation with cellWrites round-trips through undo / redo", async () => {
    const onWrite = vi.fn();
    const { result } = renderHook(() => useHarness(onWrite));
    const fieldDefForward: WriteOp = {
      kind: "fieldDefMutation",
      before: {
        field_key: "floor",
        field_type: "single_select",
        display_name: "Floor",
        options: [
          { id: "opt_a", label: "A", color: "#000", order: 0 },
          { id: "opt_b", label: "B", color: "#000", order: 1 },
        ],
      },
      after: {
        field_key: "floor",
        field_type: "single_select",
        display_name: "Floor",
        options: [{ id: "opt_a", label: "A", color: "#000", order: 0 }],
      },
      cellWrites: [{ rowId: "rm_1", fieldKey: "floor", value: null }],
    };
    const fieldDefInverse: WriteOp = {
      kind: "fieldDefMutation",
      before: fieldDefForward.after,
      after: fieldDefForward.before,
      cellWrites: [{ rowId: "rm_1", fieldKey: "floor", value: "opt_b" }],
    };

    await act(async () => {
      await result.current.reducer.dispatchWrite(fieldDefForward, fieldDefInverse);
    });
    expect(onWrite).toHaveBeenLastCalledWith(fieldDefForward);

    await act(async () => {
      await result.current.reducer.undoOnce();
    });
    expect(onWrite).toHaveBeenLastCalledWith(fieldDefInverse);

    await act(async () => {
      await result.current.reducer.redoOnce();
    });
    expect(onWrite).toHaveBeenLastCalledWith(fieldDefForward);
  });

  test("dispatchWrite with skipHistory does not push", async () => {
    const onWrite = vi.fn();
    const { result } = renderHook(() => useHarness(onWrite));

    await act(async () => {
      await result.current.reducer.dispatchWrite(forward, inverse, { skipHistory: true });
    });

    expect(onWrite).toHaveBeenCalledWith(forward);
    expect(result.current.history.canUndo).toBe(false);
  });
});
