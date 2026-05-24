import type { PointerEvent as ReactPointerEvent } from "react";

// 4 px wide grab zone hugging the right edge of a `<th>`. Half overlaps
// the cell border so the resize cursor / drag affordance reads the
// AirTable way. Parent `<th>` is already `position: relative` (the
// header row sticky rule + the existing data-table-th styling cover it
// — see App.css `.data-table th`).

export type ColumnResizeHandleProps = {
  columnId: string;
  active: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDoubleClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
};

export function ColumnResizeHandle({
  columnId,
  active,
  onPointerDown,
  onDoubleClick,
}: ColumnResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize column"
      data-column-resize-handle={columnId}
      data-active={active ? "true" : undefined}
      className="data-table-resize-handle"
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onClick={(event) => {
        // Pointer-down already handled the gesture; swallow the click
        // so it does not bubble to the header (which would trigger
        // column-select).
        event.stopPropagation();
      }}
      onMouseDown={(event) => {
        // useGridPointerDrag listens for mousedown on the header; stop
        // propagation so the resize gesture does not also kick off a
        // column-select drag.
        event.stopPropagation();
      }}
    />
  );
}
