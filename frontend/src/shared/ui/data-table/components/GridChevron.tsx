import { ChevronDown } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";

// Plan 05 — AirTable-style chevron affordance on writable single-select
// cells. Lives at the cell's right edge; click opens the popover. The
// chevron stops mousedown propagation so the parent <td>'s click /
// drag handlers don't race with the popover-open path, and
// preventDefault keeps native focus from briefly landing on the button
// — when the button then unmounts (chevron is hidden during edit),
// focus would revert to body and trip Radix's focus-outside dismissal
// before the popover input's autoFocus could claim focus.
//
// `tabIndex={-1}` keeps the chevron out of the Tab cycle — the keyboard
// path (Enter / F2 / Space / type-to-edit) is wired through
// useGridKeyboard, not focus.
export type GridChevronProps = {
  onMouseDown: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  ariaLabel?: string;
};

export function GridChevron({ onMouseDown, ariaLabel = "Open options" }: GridChevronProps) {
  return (
    <button
      type="button"
      className="data-table-cell-chevron"
      aria-label={ariaLabel}
      tabIndex={-1}
      onMouseDown={(event) => {
        event.stopPropagation();
        event.preventDefault();
        onMouseDown(event);
      }}
    >
      <ChevronDown />
    </button>
  );
}
