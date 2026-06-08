import type { KeyboardEvent, MouseEvent } from "react";

/**
 * Per-pill resolution result. The cell does not know how to look up
 * a row id in the target table; the caller passes a resolver that
 * returns the row's `record_id` (or null when the target row is
 * present but has no `record_id` set). A missing return surfaces the
 * row id muted/italic per PRD Q18.
 */
export type LinkedRecordPillResolution = {
  recordId: string | null;
};

export type LinkedRecordPillResolver = (rowId: string) => LinkedRecordPillResolution | null;

export type LinkedRecordCellProps = {
  /** Ordered id list from `row.custom_links[field_key]` (PRD Q20). */
  ids: readonly string[];
  /** Resolves each id to its display `record_id` or the row-id fallback. */
  resolve: LinkedRecordPillResolver;
  /** Click on a pill → navigate to the target row (PRD Q19). Omit in viewer mode. */
  onPillClick?: (rowId: string) => void;
  /** Backspace on a focused pill → unlink. Omit in viewer mode. */
  onPillUnlink?: (rowId: string) => void;
  /** Optional empty-state caption. Defaults to "Empty". */
  emptyLabel?: string;
};

/**
 * Pill-list renderer for a `linked_record` cell. Each pill shows the
 * target row's `record_id`; an empty/null `record_id` falls back to
 * the row id rendered muted/italic (PRD Q18).
 *
 * The cell is presentational — fetching the target table's rows and
 * minting an opaque resolver function is the caller's responsibility.
 */
export function LinkedRecordCell({
  ids,
  resolve,
  onPillClick,
  onPillUnlink,
  emptyLabel = "Empty",
}: LinkedRecordCellProps) {
  if (ids.length === 0) {
    return <span className="muted-cell">{emptyLabel}</span>;
  }

  const onClick = (rowId: string) => (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onPillClick?.(rowId);
  };

  const onKeyDown = (rowId: string) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Backspace" || event.key === "Delete") {
      if (!onPillUnlink) return;
      event.preventDefault();
      event.stopPropagation();
      onPillUnlink(rowId);
    }
  };

  return (
    <span className="data-table-linked-record-cell" data-testid="linked-record-cell">
      {ids.map((rowId) => {
        const resolution = resolve(rowId);
        const recordId = resolution?.recordId ?? null;
        const label = recordId && recordId.length > 0 ? recordId : rowId;
        const isFallback = !recordId || recordId.length === 0;
        return (
          <button
            key={rowId}
            type="button"
            className={
              "data-table-linked-record-pill" +
              (isFallback ? " data-table-linked-record-pill-fallback" : "")
            }
            data-row-id={rowId}
            data-fallback={isFallback ? "true" : undefined}
            onClick={onClick(rowId)}
            onKeyDown={onKeyDown(rowId)}
            disabled={!onPillClick && !onPillUnlink}
          >
            {label}
          </button>
        );
      })}
    </span>
  );
}
