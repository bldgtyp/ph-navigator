import type { MouseEvent } from "react";
import { Maximize2 } from "lucide-react";
import type { RowSelectionMode } from "../hooks/useGridRowSelection";

// Row-number / row-select gutter cell. Lives outside the TanStack
// column model (PoC L2.2) so column-level features (sort, group,
// filter, copy) don't interact with it. Phase 2 adds a checkbox lane
// driving the multi-row selection set independently of the cell range.
export type GridGutterProps = {
  rowNumber: number;
  selected: boolean;
  showCheckbox: boolean;
  onSelectRow: () => void;
  onToggleSelected: (mode: RowSelectionMode) => void;
  // AirTable-style row-expand affordance: when wired, an Expand icon
  // overlays the row number on row-hover and invokes the consumer's
  // row-open callback. Plan 04 took the Enter key for inline editing,
  // so this button is the new keyboard-and-mouse path to the row
  // detail dialog.
  onExpandRow?: () => void;
};

export function GridGutter({
  rowNumber,
  selected,
  showCheckbox,
  onSelectRow,
  onToggleSelected,
  onExpandRow,
}: GridGutterProps) {
  const handleCheckboxClick = (event: MouseEvent<HTMLInputElement>) => {
    // Stop the click from bubbling to the gutter cell and triggering the
    // row-number's selectRow on the surrounding cell-range channel.
    event.stopPropagation();
    onToggleSelected(modeFromEvent(event));
  };

  const handleExpandClick = (event: MouseEvent<HTMLButtonElement>) => {
    // Stop the click from bubbling so the surrounding gutter cell
    // doesn't fire selectRow.
    event.stopPropagation();
    onExpandRow?.();
  };

  return (
    <th className={`data-table-gutter${selected ? " data-table-gutter-selected" : ""}`} scope="row">
      <div className="data-table-gutter-inner">
        {showCheckbox ? (
          <input
            type="checkbox"
            className="data-table-gutter-checkbox"
            aria-label={`Select row ${rowNumber}`}
            checked={selected}
            // Re-driven by onClick so we can read modifier keys; React's
            // onChange doesn't expose shift/meta state reliably.
            onChange={() => undefined}
            onClick={handleCheckboxClick}
            tabIndex={-1}
          />
        ) : null}
        <span className="data-table-gutter-number-stack">
          <button
            type="button"
            className="data-table-gutter-number"
            aria-label={`Highlight row ${rowNumber}`}
            tabIndex={-1}
            onClick={onSelectRow}
          >
            {rowNumber}
          </button>
          {onExpandRow ? (
            <button
              type="button"
              className="data-table-gutter-expand"
              aria-label={`Expand row ${rowNumber}`}
              title="Expand row"
              tabIndex={-1}
              onClick={handleExpandClick}
            >
              <Maximize2 size={12} aria-hidden="true" />
            </button>
          ) : null}
        </span>
      </div>
    </th>
  );
}

function modeFromEvent(event: MouseEvent<HTMLInputElement>): RowSelectionMode {
  if (event.shiftKey) return "shift";
  if (event.metaKey || event.ctrlKey) return "cmd";
  return "single";
}
