import type { MouseEvent } from "react";
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
};

export function GridGutter({
  rowNumber,
  selected,
  showCheckbox,
  onSelectRow,
  onToggleSelected,
}: GridGutterProps) {
  const handleCheckboxClick = (event: MouseEvent<HTMLInputElement>) => {
    // Stop the click from bubbling to the gutter cell and triggering the
    // row-number's selectRow on the surrounding cell-range channel.
    event.stopPropagation();
    onToggleSelected(modeFromEvent(event));
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
        <button
          type="button"
          className="data-table-gutter-number"
          aria-label={`Highlight row ${rowNumber}`}
          tabIndex={-1}
          onClick={onSelectRow}
        >
          {rowNumber}
        </button>
      </div>
    </th>
  );
}

function modeFromEvent(event: MouseEvent<HTMLInputElement>): RowSelectionMode {
  if (event.shiftKey) return "shift";
  if (event.metaKey || event.ctrlKey) return "cmd";
  return "single";
}
