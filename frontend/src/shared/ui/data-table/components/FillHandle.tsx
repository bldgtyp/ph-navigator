import type { MouseEvent as ReactMouseEvent } from "react";

// Pure presentational handle anchored at the bottom-right of the
// source cell. Positioning is entirely CSS — see App.css
// `.data-table-fill-handle`. The button stops mousedown propagation
// so the parent <td>'s drag handler doesn't interpret the click as a
// range-collapse / range-start gesture.
//
// `tabIndex={-1}` keeps the handle out of the Tab cycle: drag is
// pointer-only, ⌘D / ⌘R are the keyboard path.
export type FillHandleProps = {
  onMouseDown: (event: ReactMouseEvent<HTMLButtonElement>) => void;
};

export function FillHandle({ onMouseDown }: FillHandleProps) {
  return (
    <button
      type="button"
      className="data-table-fill-handle"
      aria-label="Drag to fill"
      tabIndex={-1}
      onMouseDown={onMouseDown}
    />
  );
}
