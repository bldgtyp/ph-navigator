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
  options: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean } = {},
): SyntheticKeyEvent {
  const preventDefault = vi.fn();
  return {
    key,
    metaKey: options.metaKey ?? false,
    ctrlKey: options.ctrlKey ?? false,
    shiftKey: options.shiftKey ?? false,
    defaultPrevented: false,
    preventDefault,
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
