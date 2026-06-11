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
  /** Open the linked-record picker. When provided, the cell renders a
   * trailing "+" button and (for empty cells) replaces the empty-state
   * caption with the "+" affordance. Omit in viewer mode. */
  onActivateEdit?: () => void;
  /** Optional empty-state caption. Defaults to "Empty". */
  emptyLabel?: string;
  /** Airtable-parity active state. When true, each pill shows an inline
   * "x" affordance that calls onPillUnlink, and pill clicks fire
   * onPillClick (nav). When false, pill clicks are inert so the cell
   * click handler can activate the cell first. */
  isActive?: boolean;
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
  onActivateEdit,
  emptyLabel = "Empty",
  isActive = false,
}: LinkedRecordCellProps) {
  // Airtable parity: the "+" affordance only appears once the cell is
  // active, mirroring the inline "x" unlink button. Inactive empty
  // cells fall back to the muted "Empty" caption (or the bare wrapper
  // when no editor is wired).
  const addButton =
    isActive && onActivateEdit ? (
      <button
        type="button"
        className="data-table-linked-record-add"
        aria-label="Add linked record"
        title="Add linked record"
        onClick={(event) => {
          // Don't let the click reach the cell's onCellActivate
          // handler — we want the picker, not a focus-only toggle.
          event.stopPropagation();
          onActivateEdit();
        }}
      >
        +
      </button>
    ) : null;

  if (ids.length === 0) {
    if (addButton) {
      return (
        <span className="data-table-linked-record-cell" data-testid="linked-record-cell">
          {addButton}
        </span>
      );
    }
    return <span className="muted-cell">{emptyLabel}</span>;
  }

  const onClick = (rowId: string) => (event: MouseEvent<HTMLButtonElement>) => {
    // Inactive cell: let the click bubble to the td so the cell
    // activates on the first click (Airtable parity). Only fire the
    // nav callback when the cell is already active.
    if (!isActive) return;
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

  const onUnlinkClick = (rowId: string) => (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onPillUnlink?.(rowId);
  };

  // Render the chip as a <button> when ANY interaction is wired (nav
  // or unlink) so the keyboard handler stays attached. Inactive +
  // interactive: click does nothing (bubbles to cell). Inactive +
  // inert: span so the cell-level click handler still fires.
  const isInteractive = Boolean(onPillClick || onPillUnlink);
  const showUnlinkButton = isActive && Boolean(onPillUnlink);

  return (
    <span className="data-table-linked-record-cell" data-testid="linked-record-cell">
      {ids.map((rowId) => {
        const resolution = resolve(rowId);
        // §B7 — separate the two not-canonical states. `null`
        // resolution means the target row no longer exists (orphan
        // pill); a `{recordId: null}` resolution means the target row
        // is present but has no `record_id` set yet (the Q18 fallback).
        const isOrphan = resolution === null;
        const recordId = resolution?.recordId ?? null;
        const label = recordId && recordId.length > 0 ? recordId : rowId;
        const isFallback = !recordId || recordId.length === 0;
        const className =
          "data-table-linked-record-pill" +
          (isActive ? " is-active" : "") +
          (isFallback ? " data-table-linked-record-pill-fallback" : "") +
          (isOrphan ? " data-table-linked-record-pill-orphan" : "");
        const unlinkButton = showUnlinkButton ? (
          <button
            type="button"
            className="data-table-linked-record-pill-unlink"
            aria-label="Unlink record"
            title="Unlink record"
            onClick={onUnlinkClick(rowId)}
          >
            ×
          </button>
        ) : null;
        if (!isInteractive) {
          return (
            <span
              key={rowId}
              className={className}
              data-row-id={rowId}
              data-fallback={isFallback ? "true" : undefined}
              data-orphan={isOrphan ? "true" : undefined}
              title={isOrphan ? "Linked record no longer exists" : undefined}
            >
              <span className="data-table-linked-record-pill-label">{label}</span>
            </span>
          );
        }
        return (
          <button
            key={rowId}
            type="button"
            className={className}
            data-row-id={rowId}
            data-fallback={isFallback ? "true" : undefined}
            data-orphan={isOrphan ? "true" : undefined}
            title={isOrphan ? "Linked record no longer exists" : undefined}
            onClick={onClick(rowId)}
            onKeyDown={onKeyDown(rowId)}
          >
            <span className="data-table-linked-record-pill-label">{label}</span>
            {unlinkButton}
          </button>
        );
      })}
      {addButton}
    </span>
  );
}
