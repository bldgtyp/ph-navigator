import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { normalizeDisplayName } from "../../lib/fieldDisplayNames";

/**
 * A picker row — one candidate from the target table. The picker is
 * presentational; the caller is responsible for fetching the target
 * table's rows and projecting them into this shape.
 */
export type LinkedRecordPickerCandidate = {
  rowId: string;
  recordId: string | null;
  displayName?: string | null;
};

export type LinkedRecordPickerMode = "single" | "multi";

export type LinkedRecordPickerProps = {
  open: boolean;
  mode: LinkedRecordPickerMode;
  /** Currently linked ids (display as pre-selected). */
  selectedIds: readonly string[];
  /** All candidate rows from the target table. */
  candidates: readonly LinkedRecordPickerCandidate[];
  onConfirm: (nextIds: string[]) => void;
  onCancel: () => void;
  /** Modal heading. Defaults to "Link record". */
  title?: string;
  /** While true, swap the candidate list for a spinner. The target
   * slice is still being fetched from its own query; an empty
   * `candidates` array during the load must not be mistaken for
   * "no records exist". */
  isLoading?: boolean;
};

const VIRTUALIZE_THRESHOLD = 100;

/**
 * Modal record-picker for `linked_record` fields. Search filters by
 * substring on `record_id` using the document's existing display-name
 * normalization. Candidates are sorted `record_id` ascending. Past
 * 100 candidates the body switches to a basic windowed view; richer
 * virtualization is deferred to a follow-up — the threshold lives
 * here so the integration consumer can tune it without rewriting.
 *
 * Single mode: confirming a radio selection writes a one-id array;
 * multi mode: checkboxes; confirm writes the full selection set
 * preserving original candidate order (PRD Q20).
 */
export function LinkedRecordPicker({
  open,
  mode,
  selectedIds,
  candidates,
  onConfirm,
  onCancel,
  title = "Link record",
  isLoading = false,
}: LinkedRecordPickerProps) {
  const [search, setSearch] = useState("");
  const [draftIds, setDraftIds] = useState<string[]>(() => [...selectedIds]);

  // §A4 — only reseed on the rising edge of `open`. The parent re-renders
  // the picker constantly (every keystroke in the picker's own search
  // input, every cell hover) and used to pass a freshly-allocated
  // `selectedIds` array each time, so an `open + selectedIds` dep list
  // wiped the user's draft on every re-render. Track previous-open in a
  // ref and only reseed on closed → open. `selectedIds` is intentionally
  // captured at the transition (via the ref's current snapshot).
  const wasOpenRef = useRef(open);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDraftIds([...selectedIds]);
      setSearch("");
    }
    wasOpenRef.current = open;
  }, [open, selectedIds]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, open]);

  const normalizedSearch = useMemo(() => normalizeDisplayName(search), [search]);

  const visible = useMemo(() => {
    const sorted = [...candidates].sort((a, b) => {
      const left = a.recordId ?? a.rowId;
      const right = b.recordId ?? b.rowId;
      return left.localeCompare(right);
    });
    if (!normalizedSearch) return sorted;
    return sorted.filter((candidate) => {
      const haystack = normalizeDisplayName(candidate.recordId ?? candidate.rowId);
      return haystack.includes(normalizedSearch);
    });
  }, [candidates, normalizedSearch]);

  const virtualized = visible.length > VIRTUALIZE_THRESHOLD;

  const toggle = useCallback(
    (rowId: string) => {
      setDraftIds((current) => {
        if (mode === "single") {
          return current[0] === rowId ? [] : [rowId];
        }
        if (current.includes(rowId)) {
          return current.filter((id) => id !== rowId);
        }
        return [...current, rowId];
      });
    },
    [mode],
  );

  if (!open) return null;

  // Portal to the document body so stacking contexts created by the
  // data-table toolbar / summary bar / sticky chrome don't trap the
  // picker behind them. Without the portal, even `z-index: var(--z-modal)`
  // is scoped to the picker's nearest stacking-context ancestor and the
  // picker renders behind sibling chrome.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="data-table-linked-record-picker"
      data-testid="linked-record-picker"
    >
      <header className="data-table-linked-record-picker-header">
        <h2>{title}</h2>
        <input
          autoFocus
          type="search"
          placeholder="Search records…"
          aria-label="Search records"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </header>
      {isLoading ? (
        <div
          className="data-table-linked-record-picker-loading"
          role="status"
          aria-live="polite"
          data-testid="linked-record-picker-loading"
        >
          <span className="data-table-linked-record-picker-spinner" aria-hidden="true" />
          <span>Loading records…</span>
        </div>
      ) : null}
      <ul
        className="data-table-linked-record-picker-list"
        data-virtualized={virtualized ? "true" : "false"}
        role="listbox"
        aria-multiselectable={mode === "multi" ? true : undefined}
        hidden={isLoading}
      >
        {visible.length === 0 ? (
          <li className="muted-cell">No matching records.</li>
        ) : (
          visible.map((candidate) => {
            const checked = draftIds.includes(candidate.rowId);
            const labelText =
              candidate.recordId && candidate.recordId.length > 0
                ? candidate.recordId
                : candidate.rowId;
            const isFallback = !candidate.recordId || candidate.recordId.length === 0;
            return (
              <li key={candidate.rowId} role="option" aria-selected={checked}>
                <label className="data-table-linked-record-picker-row">
                  <input
                    type={mode === "single" ? "radio" : "checkbox"}
                    name="linked-record-picker"
                    checked={checked}
                    onChange={() => toggle(candidate.rowId)}
                    aria-label={`Link ${labelText}`}
                  />
                  <span data-fallback={isFallback ? "true" : undefined}>{labelText}</span>
                  {candidate.displayName ? (
                    <span className="muted-cell"> · {candidate.displayName}</span>
                  ) : null}
                </label>
              </li>
            );
          })
        )}
      </ul>
      <footer className="data-table-linked-record-picker-footer">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" onClick={() => onConfirm([...draftIds])}>
          Confirm
        </button>
      </footer>
    </div>,
    document.body,
  );
}
