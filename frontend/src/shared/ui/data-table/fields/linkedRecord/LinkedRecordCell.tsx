import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { linkedRecordLabelFromRecordId } from "./display";

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
  /** Click on a pill -> open the target row. Omit in viewer mode. */
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
   * onPillClick. When false, pill clicks are inert so the cell
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
  const scrollRef = useRef<HTMLSpanElement | null>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  const measureOverflow = useCallback(() => {
    const element = scrollRef.current;
    const next = Boolean(element && element.scrollWidth > element.clientWidth + 1);
    setHasOverflow((previous) => (previous === next ? previous : next));
  }, []);

  useLayoutEffect(() => {
    measureOverflow();
  });

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    if ("ResizeObserver" in globalThis) {
      const observer = new ResizeObserver(measureOverflow);
      observer.observe(element);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", measureOverflow);
    return () => window.removeEventListener("resize", measureOverflow);
  }, [ids.length, measureOverflow]);

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
    // linked-row callback when the cell is already active.
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

  // Active unlink renders a span pill so the inline unlink button is
  // not nested inside the pill's open button.
  const isInteractive = Boolean(onPillClick || onPillUnlink);
  const showUnlinkButton = isActive && Boolean(onPillUnlink);

  return (
    <span
      className={"data-table-linked-record-cell" + (hasOverflow ? " has-overflow-cue" : "")}
      data-testid="linked-record-cell"
    >
      <span ref={scrollRef} className="data-table-linked-record-scroll">
        {ids.map((rowId) => {
          const resolution = resolve(rowId);
          // §B7 — separate the two not-canonical states. `null`
          // resolution means the target row no longer exists (orphan
          // pill); a `{recordId: null}` resolution means the target row
          // is present but has no `record_id` set yet (the Q18 fallback).
          const isOrphan = resolution === null;
          const recordId = resolution?.recordId ?? null;
          const label = linkedRecordLabelFromRecordId(rowId, recordId);
          const isFallback = !recordId || recordId.length === 0;
          const className =
            "data-table-linked-record-pill" +
            (isActive ? " is-active" : "") +
            (isFallback ? " data-table-linked-record-pill-fallback" : "") +
            (isOrphan ? " data-table-linked-record-pill-orphan" : "");
          const pillAttrs = {
            className,
            "data-row-id": rowId,
            "data-fallback": isFallback ? "true" : undefined,
            "data-orphan": isOrphan ? "true" : undefined,
            title: isOrphan ? "Linked record no longer exists" : undefined,
          };
          const labelNode = <span className="data-table-linked-record-pill-label">{label}</span>;
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
              <span key={rowId} {...pillAttrs}>
                {labelNode}
              </span>
            );
          }
          if (showUnlinkButton) {
            return (
              <span key={rowId} {...pillAttrs}>
                <button
                  type="button"
                  className="data-table-linked-record-pill-open"
                  onClick={onClick(rowId)}
                  onKeyDown={onKeyDown(rowId)}
                >
                  {labelNode}
                </button>
                {unlinkButton}
              </span>
            );
          }
          return (
            <button
              key={rowId}
              type="button"
              {...pillAttrs}
              onClick={onClick(rowId)}
              onKeyDown={onKeyDown(rowId)}
            >
              {labelNode}
              {unlinkButton}
            </button>
          );
        })}
        {addButton}
      </span>
      {hasOverflow ? (
        <span className="data-table-linked-record-overflow-cue" aria-hidden="true">
          ...
        </span>
      ) : null}
    </span>
  );
}
