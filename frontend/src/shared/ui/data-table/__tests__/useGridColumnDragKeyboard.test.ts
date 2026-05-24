import { act, renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { useGridColumnDragKeyboard } from "../hooks/useGridColumnDragKeyboard";
import type { DataTableColumnDef } from "../types";

type Row = { id: string; name: string; floor: string; count: number };

const COLUMNS: DataTableColumnDef<Row>[] = [
  { id: "name", fieldKey: "name", header: "Name", accessor: (r) => r.name },
  { id: "floor", fieldKey: "floor", header: "Floor", accessor: (r) => r.floor },
  { id: "count", fieldKey: "count", header: "iCFA factor", accessor: (r) => r.count },
];

function setup() {
  const onColumnOrderChange = vi.fn();
  const onAnnounce = vi.fn();
  const hook = renderHook(() =>
    useGridColumnDragKeyboard({
      visibleColumns: COLUMNS,
      fullOrderedColumnIds: ["name", "floor", "count"],
      onColumnOrderChange,
      onAnnounce,
    }),
  );
  return { hook, onColumnOrderChange, onAnnounce };
}

describe("useGridColumnDragKeyboard", () => {
  test("onPickup(0) is a no-op — primary column is not pickable", () => {
    const { hook, onAnnounce } = setup();
    act(() => hook.result.current.onPickup(0));
    expect(hook.result.current.pickedUpColumnIndex).toBeNull();
    expect(onAnnounce).not.toHaveBeenCalled();
  });

  test("onPickup(1) enters pickup state and announces the field name", () => {
    const { hook, onAnnounce } = setup();
    act(() => hook.result.current.onPickup(1));
    expect(hook.result.current.pickedUpColumnIndex).toBe(1);
    expect(onAnnounce).toHaveBeenCalledWith(expect.stringContaining("Picked up Floor"));
  });

  test("onMove shifts the pickup target and clamps to [1, length-1]", () => {
    const { hook } = setup();
    act(() => hook.result.current.onPickup(1));
    act(() => hook.result.current.onMove(1));
    expect(hook.result.current.pickedUpColumnIndex).toBe(2);
    act(() => hook.result.current.onMove(1)); // clamp at length-1
    expect(hook.result.current.pickedUpColumnIndex).toBe(2);
    act(() => hook.result.current.onMove(-1));
    expect(hook.result.current.pickedUpColumnIndex).toBe(1);
    act(() => hook.result.current.onMove(-1)); // clamp at 1 (primary protected)
    expect(hook.result.current.pickedUpColumnIndex).toBe(1);
  });

  test("onMove before pickup is a no-op", () => {
    const { hook } = setup();
    act(() => hook.result.current.onMove(1));
    expect(hook.result.current.pickedUpColumnIndex).toBeNull();
  });

  test("onCommit with no positional change announces 'Canceled.' and does not fire onColumnOrderChange", () => {
    const { hook, onAnnounce, onColumnOrderChange } = setup();
    act(() => hook.result.current.onPickup(1));
    act(() => hook.result.current.onCommit());
    expect(onColumnOrderChange).not.toHaveBeenCalled();
    expect(onAnnounce).toHaveBeenLastCalledWith("Canceled.");
    expect(hook.result.current.pickedUpColumnIndex).toBeNull();
  });

  test("onCommit after a move calls onColumnOrderChange with the spliced order", () => {
    const { hook, onAnnounce, onColumnOrderChange } = setup();
    act(() => hook.result.current.onPickup(1));
    act(() => hook.result.current.onMove(1)); // Floor → position 2
    act(() => hook.result.current.onCommit());
    expect(onColumnOrderChange).toHaveBeenCalledWith(["name", "count", "floor"]);
    expect(onAnnounce).toHaveBeenLastCalledWith("Floor moved to position 3.");
    expect(hook.result.current.pickedUpColumnIndex).toBeNull();
  });

  test("onCancel clears state and announces 'Canceled.'", () => {
    const { hook, onAnnounce } = setup();
    act(() => hook.result.current.onPickup(2));
    act(() => hook.result.current.onMove(-1));
    act(() => hook.result.current.onCancel());
    expect(hook.result.current.pickedUpColumnIndex).toBeNull();
    expect(onAnnounce).toHaveBeenLastCalledWith("Canceled.");
  });

  test("onCancel before pickup is a no-op", () => {
    const { hook, onAnnounce } = setup();
    act(() => hook.result.current.onCancel());
    expect(onAnnounce).not.toHaveBeenCalled();
  });

  test("commit splices inside the full ordered list so hidden columns keep relative positions", () => {
    const onColumnOrderChange = vi.fn();
    const onAnnounce = vi.fn();
    const hook = renderHook(() =>
      useGridColumnDragKeyboard({
        // Visible: name, floor, count. `tags` is hidden — only present
        // in fullOrderedColumnIds.
        visibleColumns: COLUMNS,
        fullOrderedColumnIds: ["name", "floor", "tags", "count"],
        onColumnOrderChange,
        onAnnounce,
      }),
    );
    act(() => hook.result.current.onPickup(1)); // Floor
    act(() => hook.result.current.onMove(1)); // target = count (visible idx 2)
    act(() => hook.result.current.onCommit());
    expect(onColumnOrderChange).toHaveBeenCalledWith(["name", "tags", "count", "floor"]);
  });
});
