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
  // AirTable-style row-expand affordance: the icon reveals on row-hover
  // in the right gutter lane. When wired, it invokes the consumer's
  // row-open callback; otherwise it renders as a visual-only affordance
  // so catalog and project tables keep the same gutter layout.
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

  const className = [
    "data-table-gutter",
    selected ? "data-table-gutter-selected" : "",
    showCheckbox ? "data-table-gutter-selectable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <th className={className} scope="row">
      <div className="data-table-gutter-inner">
        <button
          type="button"
          className="data-table-gutter-number"
          aria-label={`Highlight row ${rowNumber}`}
          tabIndex={-1}
          onClick={onSelectRow}
        >
          {rowNumber}
        </button>
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
        ) : (
          <span className="data-table-gutter-expand" aria-hidden="true">
            <Maximize2 size={12} aria-hidden="true" />
          </span>
        )}
      </div>
    </th>
  );
}

function modeFromEvent(event: MouseEvent<HTMLInputElement>): RowSelectionMode {
  if (event.shiftKey) return "shift";
  if (event.metaKey || event.ctrlKey) return "cmd";
  return "single";
}
