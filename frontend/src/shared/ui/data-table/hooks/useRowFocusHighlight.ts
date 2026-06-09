// PRD Q19 — when a linked-record pill click navigates to the
// destination table with `?focus=<row_id>`, the destination scrolls the
// matching `<tr data-row-id>` into view and applies a transient
// `data-focus="true"` attribute that the table CSS animates briefly.
//
// Standalone hook: the caller (route component) owns the search-params
// read and the container ref, so this works with whatever router and
// table-mount lifecycle the consumer already has.
import { useEffect } from "react";

const DEFAULT_HIGHLIGHT_MS = 1500;

export type UseRowFocusHighlightOptions = {
  // Container that scopes the `tr[data-row-id]` lookup. When null, the
  // hook no-ops — useful for guarding behind "table mounted" flags.
  containerRef: React.RefObject<HTMLElement | null>;
  // Row id from `?focus=<row_id>`. Null/empty no-ops.
  rowId: string | null | undefined;
  // Bump to re-trigger when the route changes but `rowId` stays the
  // same — e.g. when a sibling re-renders. Optional.
  dependencyKey?: unknown;
  // Override the default 1.5s highlight window.
  durationMs?: number;
};

export function useRowFocusHighlight({
  containerRef,
  rowId,
  dependencyKey,
  durationMs = DEFAULT_HIGHLIGHT_MS,
}: UseRowFocusHighlightOptions): void {
  useEffect(() => {
    if (!rowId) return;
    const container = containerRef.current;
    if (!container) return;
    // §A6 — scope the selector to `<tr>` so pill buttons with a
    // `data-row-id` attribute (LinkedRecordCell renders one per pill
    // link) don't shadow the actual row in document order.
    const row = container.querySelector<HTMLElement>(`tr[data-row-id="${cssEscape(rowId)}"]`);
    if (!row) return;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    row.setAttribute("data-focus", "true");
    const handle = window.setTimeout(() => {
      row.removeAttribute("data-focus");
    }, durationMs);
    return () => {
      window.clearTimeout(handle);
      row.removeAttribute("data-focus");
    };
  }, [containerRef, rowId, dependencyKey, durationMs]);
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, "\\$&");
}
