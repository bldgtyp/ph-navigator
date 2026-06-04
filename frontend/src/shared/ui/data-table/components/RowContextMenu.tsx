import * as Popover from "@radix-ui/react-popover";
import { useEffect, type ReactNode } from "react";
import { ArrowDown, Maximize2, Trash2 } from "lucide-react";
import { pointAnchorRef } from "../lib/popoverAnchor";
import { useGridMenuKeyboard } from "../hooks/useGridMenuKeyboard";

// Per-row right-click menu. DataTable owns the open state and passes
// it as `open`; the menu is portaled and anchored at the pointer
// location captured at right-click time (or the row's bottom-left for
// keyboard-opened menus). Same Radix Popover surface as
// HeaderContextMenu so the visual / a11y / portal behavior stays
// uniform across the two menus.
//
// Phase 1 ships Insert / Expand / Delete only. Duplicate (Phase 3a),
// multi-row delete collapse (Phase 2), and the rowActions extension
// slot (Phase 4) layer in later.

export type RowContextMenuOpenState = {
  rowId: string;
  rowNumber: number;
  x: number;
  y: number;
  // Element to refocus when the menu closes (the row's gutter button
  // for keyboard-opened menus; null for pointer-opened menus so focus
  // returns to wherever the click landed).
  returnFocus: HTMLElement | null;
};

export type RowContextMenuProps = {
  open: RowContextMenuOpenState | null;
  onClose: () => void;
  onInsertBelow: () => void;
  onOpen?: () => void;
  onDelete: () => void;
};

type MenuItem = {
  key: string;
  label: string;
  icon: ReactNode;
  shortcutHint?: string;
  danger?: boolean;
  onSelect: () => void;
};

export function RowContextMenu({
  open,
  onClose,
  onInsertBelow,
  onOpen,
  onDelete,
}: RowContextMenuProps) {
  const items: MenuItem[] = [
    {
      key: "insert",
      label: "Insert record",
      icon: <ArrowDown size={14} aria-hidden="true" />,
      shortcutHint: "⇧ ⏎",
      onSelect: onInsertBelow,
    },
  ];
  if (onOpen) {
    items.push({
      key: "expand",
      label: "Expand record",
      icon: <Maximize2 size={14} aria-hidden="true" />,
      onSelect: onOpen,
    });
  }
  items.push({
    key: "delete",
    label: "Delete record",
    icon: <Trash2 size={14} aria-hidden="true" />,
    shortcutHint: "⌫",
    danger: true,
    onSelect: onDelete,
  });

  const { itemRefs, onKeyDown, resetToInitial } = useGridMenuKeyboard({
    itemCount: items.length,
  });

  // Reset focus to the first item on every (re-)open. Without this,
  // re-opening at the same activeIndex would skip the focus effect.
  useEffect(() => {
    if (open) resetToInitial();
  }, [open, resetToInitial]);

  if (!open) return null;

  const anchorRef = pointAnchorRef(open.x, open.y);

  return (
    <Popover.Root
      open={true}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Popover.Anchor virtualRef={anchorRef} />
      <Popover.Portal>
        <Popover.Content
          className="data-table-column-menu"
          side="bottom"
          align="start"
          sideOffset={2}
          role="menu"
          aria-label={`Row ${open.rowNumber} actions`}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            open.returnFocus?.focus();
          }}
          onKeyDown={onKeyDown}
        >
          {items.map((item, index) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className="data-table-column-menu-item data-table-column-menu-item--with-icon"
              data-danger={item.danger ? "true" : undefined}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              onClick={(event) => {
                event.preventDefault();
                onClose();
                item.onSelect();
              }}
            >
              <span className="data-table-column-menu-item-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="data-table-column-menu-item-label">{item.label}</span>
              {item.shortcutHint ? (
                <span className="data-table-column-menu-item-hint" aria-hidden="true">
                  {item.shortcutHint}
                </span>
              ) : null}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
