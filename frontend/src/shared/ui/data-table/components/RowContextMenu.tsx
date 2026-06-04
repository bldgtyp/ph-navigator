import * as Popover from "@radix-ui/react-popover";
import { Fragment, useEffect, type ReactNode } from "react";
import { ArrowDown, Copy, Maximize2, Trash2 } from "lucide-react";
import { pointAnchorRef } from "../lib/popoverAnchor";
import { useGridMenuKeyboard } from "../hooks/useGridMenuKeyboard";
import type { RowAction } from "../types";

// Per-row right-click menu. DataTable owns the open state and passes
// it as `open`; the menu is portaled and anchored at the pointer
// location captured at right-click time (or the row's bottom-left for
// keyboard-opened menus). Same Radix Popover surface as
// HeaderContextMenu so the visual / a11y / portal behavior stays
// uniform across the two menus.
//
// PRD §5 render-perf contract: `selectionCount`, `rowIsInSelection`,
// and the consumer's `rowActions` items are frozen at right-click
// time. The menu derives its branch (collapsed multi-row Delete vs.
// full single-row items) from the frozen snapshot and does not re-read
// row-selection state while open.

export type RowContextMenuOpenState = {
  rowId: string;
  rowNumber: number;
  x: number;
  y: number;
  // Element to refocus when the menu closes (the row's gutter button
  // for keyboard-opened menus; null for pointer-opened menus so focus
  // returns to wherever the click landed).
  returnFocus: HTMLElement | null;
  // Frozen at right-click time per PRD §5. When both are truthy and
  // `selectionCount >= 2`, the menu renders the collapsed branch.
  selectionCount: number;
  rowIsInSelection: boolean;
  // Phase 4 — consumer-supplied items, captured at right-click time.
  // Empty in the collapsed branch (rule 1 suppression).
  customActions: RowAction[];
};

export type RowContextMenuProps = {
  open: RowContextMenuOpenState | null;
  onClose: () => void;
  onInsertBelow: () => void;
  onDuplicate: () => void;
  onOpen?: () => void;
  onDelete: () => void;
  onDeleteSelection: () => void;
};

type MenuItem = {
  key: string;
  label: string;
  icon: ReactNode;
  shortcutHint?: string;
  danger?: boolean;
  onSelect: () => void;
};

function buildBuiltInItems(args: {
  collapsed: boolean;
  selectionCount: number;
  onInsertBelow: () => void;
  onDuplicate: () => void;
  onOpen?: () => void;
  onDelete: () => void;
  onDeleteSelection: () => void;
}): MenuItem[] {
  if (args.collapsed) {
    return [
      {
        key: "delete-selection",
        label: `Delete ${args.selectionCount} records`,
        icon: <Trash2 size={14} aria-hidden="true" />,
        danger: true,
        onSelect: args.onDeleteSelection,
      },
    ];
  }
  const items: MenuItem[] = [
    {
      key: "insert",
      label: "Insert record",
      icon: <ArrowDown size={14} aria-hidden="true" />,
      shortcutHint: "⇧ ⏎",
      onSelect: args.onInsertBelow,
    },
    {
      key: "duplicate",
      label: "Duplicate record",
      icon: <Copy size={14} aria-hidden="true" />,
      onSelect: args.onDuplicate,
    },
  ];
  if (args.onOpen) {
    items.push({
      key: "expand",
      label: "Expand record",
      icon: <Maximize2 size={14} aria-hidden="true" />,
      onSelect: args.onOpen,
    });
  }
  items.push({
    key: "delete",
    label: "Delete record",
    icon: <Trash2 size={14} aria-hidden="true" />,
    shortcutHint: "⌫",
    danger: true,
    onSelect: args.onDelete,
  });
  return items;
}

function rowActionToMenuItem(action: RowAction): MenuItem {
  return {
    key: action.key,
    label: action.label,
    icon: action.icon ?? null,
    shortcutHint: action.shortcutHint,
    danger: action.danger,
    onSelect: action.onSelect,
  };
}

export function RowContextMenu({
  open,
  onClose,
  onInsertBelow,
  onDuplicate,
  onOpen,
  onDelete,
  onDeleteSelection,
}: RowContextMenuProps) {
  const collapsed = open !== null && open.selectionCount >= 2 && open.rowIsInSelection;
  const builtIns = buildBuiltInItems({
    collapsed,
    selectionCount: open?.selectionCount ?? 0,
    onInsertBelow,
    onDuplicate,
    onOpen,
    onDelete,
    onDeleteSelection,
  });
  // Custom actions are suppressed in the collapsed branch (PRD §5
  // rule 1). They were also empty in the open snapshot for that
  // branch, but guarding by `collapsed` keeps the render contract
  // explicit at the call site.
  const customItems = collapsed ? [] : (open?.customActions ?? []).map(rowActionToMenuItem);
  const items = [...builtIns, ...customItems];
  const showDivider = customItems.length > 0;

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
  const ariaLabel = collapsed ? "Selected rows actions" : `Row ${open.rowNumber} actions`;

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
          aria-label={ariaLabel}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            open.returnFocus?.focus();
          }}
          onKeyDown={onKeyDown}
        >
          {items.map((item, index) => {
            const isFirstCustom = showDivider && index === builtIns.length;
            return (
              <Fragment key={item.key}>
                {isFirstCustom ? (
                  <div className="data-table-column-menu-divider" role="separator" />
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  className="data-table-column-menu-item data-table-column-menu-item--with-icon"
                  data-danger={item.danger ? "true" : undefined}
                  data-row-action-key={item.key}
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
              </Fragment>
            );
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
