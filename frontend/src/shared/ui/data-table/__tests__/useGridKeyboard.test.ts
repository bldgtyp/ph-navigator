// @size-exception: docs/plans/2026-05-25/plan-23-frontend-refactor-phased.md#phase-8--ci-guards-execute-8th--last
import { act, renderHook } from "@testing-library/react";
import { type KeyboardEvent as ReactKeyboardEvent } from "react";
import { describe, expect, test, vi } from "vitest";
import { useGridKeyboard } from "../hooks/useGridKeyboard";
import type { GridSelection } from "../hooks/useGridSelection";
import type { GridEdit } from "../hooks/useGridEdit";

function makeSelection(): GridSelection {
  return {
    anchor: null,
    focus: null,
    activeCell: { rowIndex: 0, columnIndex: 0 },
    range: {
      anchor: { rowIndex: 0, columnIndex: 0 },
      focus: { rowIndex: 0, columnIndex: 0 },
    },
    normalizedRange: { rowStart: 0, rowEnd: 0, columnStart: 0, columnEnd: 0 },
    hasExplicitRange: false,
    setActive: vi.fn(),
    extendTo: vi.fn(),
    collapse: vi.fn(),
    selectRow: vi.fn(),
    selectColumn: vi.fn(),
    extendToColumn: vi.fn(),
    selectAll: vi.fn(),
    moveBy: vi.fn(),
  };
}

function makeEdit(): GridEdit {
  return {
    editing: null,
    cellError: () => null,
    isEditingCell: () => false,
    start: vi.fn(),
    draft: vi.fn(),
    highlight: vi.fn(),
    commit: vi.fn().mockResolvedValue(true),
    cancel: vi.fn(),
    queuePendingEdit: vi.fn(),
    consumePendingEdit: vi.fn(),
  };
}

type SyntheticKeyEvent = ReactKeyboardEvent<HTMLDivElement> & {
  preventDefault: ReturnType<typeof vi.fn>;
};

function makeKeyEvent(
  key: string,
  options: {
    metaKey?: boolean;
    ctrlKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
    isComposing?: boolean;
  } = {},
): SyntheticKeyEvent {
  const preventDefault = vi.fn();
  return {
    key,
    metaKey: options.metaKey ?? false,
    ctrlKey: options.ctrlKey ?? false,
    altKey: options.altKey ?? false,
    shiftKey: options.shiftKey ?? false,
    defaultPrevented: false,
    preventDefault,
    nativeEvent: { isComposing: options.isComposing ?? false },
  } as unknown as SyntheticKeyEvent;
}

describe("useGridKeyboard — ⌘D / ⌘R", () => {
  test("⌘D dispatches onFillDown and preventDefaults when wired", () => {
    const onFillDown = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useGridKeyboard({
        selection: makeSelection(),
        edit: makeEdit(),
        readOnly: false,
        isGrouped: false,
        onCopy: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onFillDown,
      }),
    );
    const event = makeKeyEvent("d", { metaKey: true });
    act(() => result.current.onKeyDown(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onFillDown).toHaveBeenCalled();
  });

  test("⌘D is a no-op (no preventDefault, no callback) when onFillDown is undefined", () => {
    const { result } = renderHook(() =>
      useGridKeyboard({
        selection: makeSelection(),
        edit: makeEdit(),
        readOnly: false,
        isGrouped: false,
        onCopy: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
      }),
    );
    const event = makeKeyEvent("d", { metaKey: true });
    act(() => result.current.onKeyDown(event));
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  test("⌘D is inert when readOnly", () => {
    const onFillDown = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useGridKeyboard({
        selection: makeSelection(),
        edit: makeEdit(),
        readOnly: true,
        isGrouped: false,
        onCopy: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onFillDown,
      }),
    );
    const event = makeKeyEvent("d", { metaKey: true });
    act(() => result.current.onKeyDown(event));
    expect(onFillDown).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  test("⌘R dispatches onFillRight and preventDefaults when wired", () => {
    const onFillRight = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useGridKeyboard({
        selection: makeSelection(),
        edit: makeEdit(),
        readOnly: false,
        isGrouped: false,
        onCopy: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onFillRight,
      }),
    );
    const event = makeKeyEvent("r", { metaKey: true });
    act(() => result.current.onKeyDown(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onFillRight).toHaveBeenCalled();
  });

  test("⌘R is a no-op when onFillRight is undefined", () => {
    const { result } = renderHook(() =>
      useGridKeyboard({
        selection: makeSelection(),
        edit: makeEdit(),
        readOnly: false,
        isGrouped: false,
        onCopy: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
      }),
    );
    const event = makeKeyEvent("r", { metaKey: true });
    act(() => result.current.onKeyDown(event));
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  test("⌘R is inert when readOnly", () => {
    const onFillRight = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useGridKeyboard({
        selection: makeSelection(),
        edit: makeEdit(),
        readOnly: true,
        isGrouped: false,
        onCopy: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onFillRight,
      }),
    );
    const event = makeKeyEvent("r", { metaKey: true });
    act(() => result.current.onKeyDown(event));
    expect(onFillRight).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  test("⌘⇧D dispatches onFillUp and preventDefaults when wired", () => {
    const onFillUp = vi.fn().mockResolvedValue(undefined);
    const onFillDown = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useGridKeyboard({
        selection: makeSelection(),
        edit: makeEdit(),
        readOnly: false,
        isGrouped: false,
        onCopy: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onFillDown,
        onFillUp,
      }),
    );
    const event = makeKeyEvent("d", { metaKey: true, shiftKey: true });
    act(() => result.current.onKeyDown(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onFillUp).toHaveBeenCalled();
    expect(onFillDown).not.toHaveBeenCalled();
  });

  test("⌘⇧D is a no-op when onFillUp is undefined", () => {
    const { result } = renderHook(() =>
      useGridKeyboard({
        selection: makeSelection(),
        edit: makeEdit(),
        readOnly: false,
        isGrouped: false,
        onCopy: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        // onFillDown wired but onFillUp not — the shift modifier must
        // NOT fall through to onFillDown.
        onFillDown: vi.fn().mockResolvedValue(undefined),
      }),
    );
    const event = makeKeyEvent("d", { metaKey: true, shiftKey: true });
    act(() => result.current.onKeyDown(event));
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  test("⌘⇧D is inert when readOnly", () => {
    const onFillUp = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useGridKeyboard({
        selection: makeSelection(),
        edit: makeEdit(),
        readOnly: true,
        isGrouped: false,
        onCopy: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onFillUp,
      }),
    );
    const event = makeKeyEvent("d", { metaKey: true, shiftKey: true });
    act(() => result.current.onKeyDown(event));
    expect(onFillUp).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  test("⌘⇧R dispatches onFillLeft and preventDefaults when wired", () => {
    const onFillLeft = vi.fn().mockResolvedValue(undefined);
    const onFillRight = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useGridKeyboard({
        selection: makeSelection(),
        edit: makeEdit(),
        readOnly: false,
        isGrouped: false,
        onCopy: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onFillRight,
        onFillLeft,
      }),
    );
    const event = makeKeyEvent("r", { metaKey: true, shiftKey: true });
    act(() => result.current.onKeyDown(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onFillLeft).toHaveBeenCalled();
    expect(onFillRight).not.toHaveBeenCalled();
  });

  test("⌘⇧R is a no-op when onFillLeft is undefined", () => {
    const { result } = renderHook(() =>
      useGridKeyboard({
        selection: makeSelection(),
        edit: makeEdit(),
        readOnly: false,
        isGrouped: false,
        onCopy: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onFillRight: vi.fn().mockResolvedValue(undefined),
      }),
    );
    const event = makeKeyEvent("r", { metaKey: true, shiftKey: true });
    act(() => result.current.onKeyDown(event));
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  test("⌘⇧R is inert when readOnly", () => {
    const onFillLeft = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useGridKeyboard({
        selection: makeSelection(),
        edit: makeEdit(),
        readOnly: true,
        isGrouped: false,
        onCopy: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onFillLeft,
      }),
    );
    const event = makeKeyEvent("r", { metaKey: true, shiftKey: true });
    act(() => result.current.onKeyDown(event));
    expect(onFillLeft).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  test("type-to-edit: printable char with no modifiers calls onPrintableKey", () => {
    const onPrintableKey = vi.fn();
    const { result } = renderHook(() =>
      useGridKeyboard({
        selection: makeSelection(),
        edit: makeEdit(),
        readOnly: false,
        isGrouped: false,
        onCopy: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onPrintableKey,
      }),
    );
    const event = makeKeyEvent("K");
    act(() => result.current.onKeyDown(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onPrintableKey).toHaveBeenCalledWith("K");
  });

  test("type-to-edit: printable char with ⌘ held does NOT call onPrintableKey", () => {
    const onPrintableKey = vi.fn();
    const { result } = renderHook(() =>
      useGridKeyboard({
        selection: makeSelection(),
        edit: makeEdit(),
        readOnly: false,
        isGrouped: false,
        onCopy: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onPrintableKey,
      }),
    );
    const event = makeKeyEvent("c", { metaKey: true });
    act(() => result.current.onKeyDown(event));
    expect(onPrintableKey).not.toHaveBeenCalled();
  });

  test("type-to-edit: IME composition keystroke does NOT call onPrintableKey", () => {
    const onPrintableKey = vi.fn();
    const { result } = renderHook(() =>
      useGridKeyboard({
        selection: makeSelection(),
        edit: makeEdit(),
        readOnly: false,
        isGrouped: false,
        onCopy: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onPrintableKey,
      }),
    );
    const event = makeKeyEvent("a", { isComposing: true });
    act(() => result.current.onKeyDown(event));
    expect(onPrintableKey).not.toHaveBeenCalled();
  });

  test("type-to-edit: no-op when an editor is already active", () => {
    const onPrintableKey = vi.fn();
    const editing = makeEdit();
    editing.editing = {
      rowId: "rm_1",
      fieldKey: "name",
      originalValue: "Bedroom",
      editor: { kind: "text", draftValue: "Bedroom" },
    };
    const { result } = renderHook(() =>
      useGridKeyboard({
        selection: makeSelection(),
        edit: editing,
        readOnly: false,
        isGrouped: false,
        onCopy: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onPrintableKey,
      }),
    );
    const event = makeKeyEvent("K");
    act(() => result.current.onKeyDown(event));
    expect(onPrintableKey).not.toHaveBeenCalled();
  });

  test("type-to-edit: multi-char keystrokes (Tab, Enter, arrows) do NOT call onPrintableKey", () => {
    const onPrintableKey = vi.fn();
    const { result } = renderHook(() =>
      useGridKeyboard({
        selection: makeSelection(),
        edit: makeEdit(),
        readOnly: false,
        isGrouped: false,
        onCopy: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onPrintableKey,
      }),
    );
    for (const key of ["Tab", "Escape", "F1", "ArrowDown"]) {
      const event = makeKeyEvent(key);
      act(() => result.current.onKeyDown(event));
    }
    expect(onPrintableKey).not.toHaveBeenCalled();
  });

  test("Backspace and Delete call onClearActiveCell", () => {
    const onClearActiveCell = vi.fn();
    const { result } = renderHook(() =>
      useGridKeyboard({
        selection: makeSelection(),
        edit: makeEdit(),
        readOnly: false,
        isGrouped: false,
        onCopy: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onClearActiveCell,
      }),
    );
    for (const key of ["Backspace", "Delete"]) {
      const event = makeKeyEvent(key);
      act(() => result.current.onKeyDown(event));
      expect(event.preventDefault).toHaveBeenCalled();
    }
    expect(onClearActiveCell).toHaveBeenCalledTimes(2);
  });

  test("Backspace with ⌘ held does NOT call onClearActiveCell (browser shortcut)", () => {
    const onClearActiveCell = vi.fn();
    const { result } = renderHook(() =>
      useGridKeyboard({
        selection: makeSelection(),
        edit: makeEdit(),
        readOnly: false,
        isGrouped: false,
        onCopy: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onClearActiveCell,
      }),
    );
    const event = makeKeyEvent("Backspace", { metaKey: true });
    act(() => result.current.onKeyDown(event));
    expect(onClearActiveCell).not.toHaveBeenCalled();
  });

  test("F2 calls onBeginEdit and preventDefaults", () => {
    const onBeginEdit = vi.fn();
    const { result } = renderHook(() =>
      useGridKeyboard({
        selection: makeSelection(),
        edit: makeEdit(),
        readOnly: false,
        isGrouped: false,
        onCopy: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onBeginEdit,
      }),
    );
    const event = makeKeyEvent("F2");
    act(() => result.current.onKeyDown(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onBeginEdit).toHaveBeenCalled();
  });

  test("Enter prefers onBeginEdit over onRowOpen when both are wired", () => {
    const onBeginEdit = vi.fn();
    const onRowOpen = vi.fn();
    const { result } = renderHook(() =>
      useGridKeyboard({
        selection: makeSelection(),
        edit: makeEdit(),
        readOnly: false,
        isGrouped: false,
        onCopy: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onBeginEdit,
        onRowOpen,
      }),
    );
    const event = makeKeyEvent("Enter");
    act(() => result.current.onKeyDown(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onBeginEdit).toHaveBeenCalled();
    expect(onRowOpen).not.toHaveBeenCalled();
  });

  test("Enter falls through to onRowOpen when onBeginEdit is undefined", () => {
    const onRowOpen = vi.fn();
    const { result } = renderHook(() =>
      useGridKeyboard({
        selection: makeSelection(),
        edit: makeEdit(),
        readOnly: false,
        isGrouped: false,
        onCopy: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onRowOpen,
      }),
    );
    const event = makeKeyEvent("Enter");
    act(() => result.current.onKeyDown(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onRowOpen).toHaveBeenCalled();
  });

  test("Arrow keys still navigate after the new handlers are wired", () => {
    const moveBy = vi.fn();
    const selection = makeSelection();
    selection.moveBy = moveBy;
    const { result } = renderHook(() =>
      useGridKeyboard({
        selection,
        edit: makeEdit(),
        readOnly: false,
        isGrouped: false,
        onCopy: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onPrintableKey: vi.fn(),
        onClearActiveCell: vi.fn(),
        onBeginEdit: vi.fn(),
      }),
    );
    const event = makeKeyEvent("ArrowDown");
    act(() => result.current.onKeyDown(event));
    expect(moveBy).toHaveBeenCalledWith("ArrowDown", false);
  });

  test("⌘C is unaffected by the fill wiring", () => {
    const onCopy = vi.fn();
    const onFillDown = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useGridKeyboard({
        selection: makeSelection(),
        edit: makeEdit(),
        readOnly: false,
        isGrouped: false,
        onCopy,
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onFillDown,
      }),
    );
    const event = makeKeyEvent("c", { metaKey: true });
    act(() => result.current.onKeyDown(event));
    expect(onCopy).toHaveBeenCalled();
    expect(onFillDown).not.toHaveBeenCalled();
  });
});
