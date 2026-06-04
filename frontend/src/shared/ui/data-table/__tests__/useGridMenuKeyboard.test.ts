import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { useGridMenuKeyboard } from "../hooks/useGridMenuKeyboard";

// Shared focus / arrow-key manager for HeaderContextMenu +
// RowContextMenu. The hook owns activeIndex + itemRefs; the consuming
// menu owns Radix Popover state. These tests cover the arithmetic;
// focus side-effects are covered by the per-menu component suites
// where real DOM nodes are mounted.

function fakeKeyboardEvent(key: string) {
  let prevented = false;
  return {
    key,
    preventDefault: () => {
      prevented = true;
    },
    get prevented() {
      return prevented;
    },
  } as unknown as React.KeyboardEvent<HTMLDivElement> & { prevented: boolean };
}

describe("useGridMenuKeyboard", () => {
  test("ArrowDown wraps from last → first; ArrowUp wraps from first → last", () => {
    const { result } = renderHook(() => useGridMenuKeyboard({ itemCount: 3 }));
    expect(result.current.activeIndex).toBe(0);
    act(() => result.current.onKeyDown(fakeKeyboardEvent("ArrowUp")));
    expect(result.current.activeIndex).toBe(2);
    act(() => result.current.onKeyDown(fakeKeyboardEvent("ArrowDown")));
    expect(result.current.activeIndex).toBe(0);
    act(() => result.current.onKeyDown(fakeKeyboardEvent("ArrowDown")));
    expect(result.current.activeIndex).toBe(1);
  });

  test("Home / End jump to bounds", () => {
    const { result } = renderHook(() => useGridMenuKeyboard({ itemCount: 4 }));
    act(() => result.current.onKeyDown(fakeKeyboardEvent("End")));
    expect(result.current.activeIndex).toBe(3);
    act(() => result.current.onKeyDown(fakeKeyboardEvent("Home")));
    expect(result.current.activeIndex).toBe(0);
  });

  test("custom initialIndex seeds activeIndex and resetToInitial returns to it", () => {
    const { result } = renderHook(() => useGridMenuKeyboard({ itemCount: 5, initialIndex: 2 }));
    expect(result.current.activeIndex).toBe(2);
    act(() => result.current.onKeyDown(fakeKeyboardEvent("End")));
    expect(result.current.activeIndex).toBe(4);
    act(() => result.current.resetToInitial());
    expect(result.current.activeIndex).toBe(2);
  });

  test("non-navigation keys are ignored", () => {
    const { result } = renderHook(() => useGridMenuKeyboard({ itemCount: 3 }));
    act(() => result.current.onKeyDown(fakeKeyboardEvent("Tab")));
    expect(result.current.activeIndex).toBe(0);
    act(() => result.current.onKeyDown(fakeKeyboardEvent("a")));
    expect(result.current.activeIndex).toBe(0);
  });

  test("itemCount=0 is a safe no-op", () => {
    const { result } = renderHook(() => useGridMenuKeyboard({ itemCount: 0 }));
    act(() => result.current.onKeyDown(fakeKeyboardEvent("ArrowDown")));
    expect(result.current.activeIndex).toBe(0);
  });
});
