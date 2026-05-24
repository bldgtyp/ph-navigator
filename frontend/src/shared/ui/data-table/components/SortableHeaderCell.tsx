import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from "react";
import type { AxisRoleSubset } from "../types";

// Plan 08 §4.1 — wraps the header `<th>` in a dnd-kit Sortable so a
// horizontal drag of the column header writes to `ViewState.columnOrder`.
// The primary (frozen) column is non-draggable: `useSortable` is called
// with `disabled: true`, the grab-cursor affordance is suppressed via
// `data-draggable`, and the drop slot is excluded from `SortableContext`
// items in `GridHeader` (so the indicator never lands beside it).
//
// dnd-kit's pointer sensor is configured at the `DndContext` level with
// `activationConstraint: { distance: 8 }` so a short mousedown still
// reaches the column-select handler (Phase 3 R1) — only a drag past 8 px
// transitions ownership to dnd-kit. Spreading `sortable.attributes` /
// `sortable.listeners` directly on the `<th>` lets the same element
// participate in both gestures (§4.2).
export type SortableHeaderCellProps = {
  id: string;
  isPrimary: boolean;
  cellRef: (node: HTMLTableCellElement | null) => void;
  ariaColIndex: number;
  className: string;
  axisTint?: AxisRoleSubset;
  fieldEditable: boolean;
  fieldEditorOpen: boolean;
  isPickedUp?: boolean;
  onMouseDown?: (event: ReactMouseEvent<HTMLElement>) => void;
  onDoubleClick?: (event: ReactMouseEvent<HTMLElement>) => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLTableCellElement>) => void;
  children: ReactNode;
};

export function SortableHeaderCell({
  id,
  isPrimary,
  cellRef,
  ariaColIndex,
  className,
  axisTint,
  fieldEditable,
  fieldEditorOpen,
  isPickedUp = false,
  onMouseDown,
  onDoubleClick,
  onKeyDown,
  children,
}: SortableHeaderCellProps) {
  // Override dnd-kit's default `role="button"` on `attributes` so the
  // `<th>` keeps its `role="columnheader"` semantics. Without this, the
  // spread of `sortable.attributes` would clobber the role and break
  // `getByRole("columnheader", ...)` queries plus assistive-tech output.
  const sortable = useSortable({
    id,
    disabled: isPrimary,
    attributes: { role: "columnheader", roleDescription: "sortable column" },
  });

  const setRef = (node: HTMLTableCellElement | null) => {
    sortable.setNodeRef(node);
    cellRef(node);
  };

  const style: CSSProperties = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
  };

  const dragProps = isPrimary
    ? {}
    : { ...sortable.attributes, ...sortable.listeners };

  return (
    <th
      ref={setRef}
      style={style}
      role="columnheader"
      aria-colindex={ariaColIndex}
      data-axis-tint={axisTint}
      data-field-editable={fieldEditable ? "true" : undefined}
      data-field-editor-open={fieldEditorOpen ? "true" : undefined}
      data-draggable={isPrimary ? undefined : "true"}
      data-dragging={sortable.isDragging ? "true" : undefined}
      data-picked-up={isPickedUp ? "true" : undefined}
      aria-grabbed={isPickedUp ? true : undefined}
      className={className}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      {...dragProps}
      // Spread last so the keyboard reorder handler wins over any
      // `onKeyDown` dnd-kit may install via its sensor listeners.
      onKeyDown={onKeyDown}
    >
      {children}
    </th>
  );
}
