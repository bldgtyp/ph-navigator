import { act, renderHook } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRowFocusHighlight } from "../hooks/useRowFocusHighlight";

describe("useRowFocusHighlight", () => {
  let container: HTMLDivElement;
  let row: HTMLTableRowElement;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    const table = document.createElement("table");
    const tbody = document.createElement("tbody");
    row = document.createElement("tr");
    row.setAttribute("data-row-id", "rm_42");
    row.scrollIntoView = vi.fn();
    tbody.appendChild(row);
    table.appendChild(tbody);
    container.appendChild(table);
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.useRealTimers();
  });

  function renderWithRef(rowId: string | null) {
    return renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(container);
      useRowFocusHighlight({ containerRef: ref, rowId });
    });
  }

  it("scrolls and marks the matching row, then clears the attribute", () => {
    renderWithRef("rm_42");
    expect(row.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(row.getAttribute("data-focus")).toBe("true");
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(row.hasAttribute("data-focus")).toBe(false);
  });

  it("no-ops when rowId is null", () => {
    renderWithRef(null);
    expect(row.scrollIntoView).not.toHaveBeenCalled();
    expect(row.hasAttribute("data-focus")).toBe(false);
  });

  it("no-ops when no matching row exists", () => {
    renderWithRef("rm_does_not_exist");
    expect(row.scrollIntoView).not.toHaveBeenCalled();
    expect(row.hasAttribute("data-focus")).toBe(false);
  });

  it("cleans up the highlight when unmounted", () => {
    const { unmount } = renderWithRef("rm_42");
    expect(row.getAttribute("data-focus")).toBe("true");
    unmount();
    expect(row.hasAttribute("data-focus")).toBe(false);
  });

  // §A6 regression: previously the selector was
  // `[data-row-id="..."]`, which matched <button> pills carrying the
  // same id BEFORE the actual <tr>. The fix scopes it to `tr[...]`.
  it("ignores non-tr elements carrying the same data-row-id", () => {
    const pill = document.createElement("button");
    pill.setAttribute("data-row-id", "rm_42");
    pill.scrollIntoView = vi.fn();
    container.insertBefore(pill, container.firstChild);
    renderWithRef("rm_42");
    expect(pill.hasAttribute("data-focus")).toBe(false);
    expect(row.getAttribute("data-focus")).toBe("true");
  });

  // §A5 regression: when the row isn't mounted yet on first run, the
  // hook used to never re-fire. The consumer now bumps `dependencyKey`
  // when the rows arrive; this test pins that re-fire behavior.
  it("re-runs and finds the row when dependencyKey changes after rows mount", () => {
    const lateRow = document.createElement("tr");
    lateRow.setAttribute("data-row-id", "rm_99");
    lateRow.scrollIntoView = vi.fn();
    const { rerender } = renderHook(
      ({ key }: { key: string }) => {
        const ref = useRef<HTMLDivElement | null>(container);
        useRowFocusHighlight({ containerRef: ref, rowId: "rm_99", dependencyKey: key });
      },
      { initialProps: { key: "loading" } },
    );
    expect(lateRow.scrollIntoView).not.toHaveBeenCalled();
    container.querySelector("tbody")!.appendChild(lateRow);
    rerender({ key: "ready:1" });
    expect(lateRow.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(lateRow.getAttribute("data-focus")).toBe("true");
  });
});
