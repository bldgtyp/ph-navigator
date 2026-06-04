import * as Popover from "@radix-ui/react-popover";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { pointAnchorRef } from "../lib/popoverAnchor";
import { isFieldDeletable, isFieldDuplicable } from "../lib/locks";
import { useGridMenuKeyboard } from "../hooks/useGridMenuKeyboard";
import type { FieldDef } from "../types";

// Right-click / Shift+F10 / ContextMenu key opens a per-header menu
// with view-state items (sort / group / hide) plus, for custom fields,
// `Delete field`. Viewer mode falls through to the browser's native
// context menu (US-CF-9 criterion 2).
//
// Built on `@radix-ui/react-popover` so the bundle and pnpm
// supply-chain surface match `ColumnHeaderMenu` rather than pulling
// in `@radix-ui/react-dropdown-menu`. The trade is hand-rolled
// arrow-key focus management.

export type HeaderContextMenuProps = {
  fieldDef: FieldDef;
  triggerRef: RefObject<HTMLElement | null>;
  isViewer: boolean;
  onDeleteField?: () => void;
  onDuplicateField?: () => void;
  // "Edit field…" entry that opens the unified field-config modal.
  // Forwarded for any custom field when the consumer supports schema edits.
  onEditFieldConfig?: () => void;
  onInsertFieldLeft?: () => void;
  onInsertFieldRight?: () => void;
  onSortAsc: () => void;
  onSortDesc: () => void;
  onFilterBy?: () => void;
  onGroupBy?: () => void;
  // Optional so the pinned record_id column can suppress this without
  // forcing the caller to wire a no-op handler.
  onHide?: () => void;
};

type MenuItem = {
  key: string;
  label: string;
  danger?: boolean;
  restoreFocus?: boolean;
  onSelect: () => void;
};

type OpenState = { x: number; y: number };

export function HeaderContextMenu({
  fieldDef,
  triggerRef,
  isViewer,
  onDeleteField,
  onDuplicateField,
  onEditFieldConfig,
  onInsertFieldLeft,
  onInsertFieldRight,
  onSortAsc,
  onSortDesc,
  onFilterBy,
  onGroupBy,
  onHide,
}: HeaderContextMenuProps) {
  const [open, setOpen] = useState<OpenState | null>(null);
  const restoreFocusOnCloseRef = useRef(true);

  const canEditField = onEditFieldConfig !== undefined;
  const canDeleteField = onDeleteField !== undefined && isFieldDeletable(fieldDef);
  const canDuplicateField = onDuplicateField !== undefined && isFieldDuplicable(fieldDef);
  const items: MenuItem[] = [];
  if (canEditField && onEditFieldConfig) {
    items.push({
      key: "edit-field",
      label: "Edit field…",
      onSelect: onEditFieldConfig,
    });
  }
  if (canDeleteField && onDeleteField) {
    items.push({
      key: "delete-field",
      label: "Delete field",
      danger: true,
      onSelect: onDeleteField,
    });
  }
  if (canDuplicateField && onDuplicateField) {
    items.push({ key: "duplicate-field", label: "Duplicate field", onSelect: onDuplicateField });
  }
  items.push(
    { key: "sort-asc", label: "Sort A → Z", onSelect: onSortAsc },
    { key: "sort-desc", label: "Sort Z → A", onSelect: onSortDesc },
  );
  if (onFilterBy) {
    items.push({ key: "filter-by", label: "Filter by this field", onSelect: onFilterBy });
  }
  if (onGroupBy) {
    items.push({ key: "group-by", label: "Group by this field", onSelect: onGroupBy });
  }
  if (onHide) {
    items.push({ key: "hide", label: "Hide field", onSelect: onHide });
  }
  // US-CF-6 criterion 3 — `Insert field left/right` is available on
  // both core and custom fields. Viewer mode never opens the menu at
  // all, so no extra gating here.
  if (onInsertFieldLeft) {
    items.push({
      key: "insert-field-left",
      label: "Insert field left",
      onSelect: onInsertFieldLeft,
    });
  }
  if (onInsertFieldRight) {
    items.push({
      key: "insert-field-right",
      label: "Insert field right",
      onSelect: onInsertFieldRight,
    });
  }

  const openAt = useCallback((x: number, y: number) => {
    setOpen({ x, y });
  }, []);

  useEffect(() => {
    if (isViewer) return undefined;
    const node = triggerRef.current;
    if (!node) return undefined;
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      openAt(event.clientX, event.clientY);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      const isShiftF10 = event.key === "F10" && event.shiftKey;
      const isContextKey = event.key === "ContextMenu";
      if (!isShiftF10 && !isContextKey) return;
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      openAt(rect.left + 8, rect.bottom);
    };
    node.addEventListener("contextmenu", handleContextMenu);
    node.addEventListener("keydown", handleKeyDown);
    return () => {
      node.removeEventListener("contextmenu", handleContextMenu);
      node.removeEventListener("keydown", handleKeyDown);
    };
  }, [triggerRef, isViewer, openAt]);

  const keyboard = useGridMenuKeyboard({ itemCount: items.length });
  const { itemRefs, onKeyDown: handleMenuKeyDown, resetToInitial } = keyboard;

  // Reset focus to the first item every time the menu re-opens so users
  // don't see leftover focus state from the previous open.
  useEffect(() => {
    if (open) resetToInitial();
  }, [open, resetToInitial]);

  if (isViewer) return null;

  const anchorRef = open ? pointAnchorRef(open.x, open.y) : null;

  return (
    <Popover.Root
      open={open !== null}
      onOpenChange={(next) => {
        if (!next) setOpen(null);
      }}
    >
      {anchorRef ? <Popover.Anchor virtualRef={anchorRef} /> : null}
      <Popover.Portal>
        <Popover.Content
          className="data-table-column-menu"
          side="bottom"
          align="start"
          sideOffset={2}
          role="menu"
          aria-label={`${fieldDef.display_name} column actions`}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (restoreFocusOnCloseRef.current) triggerRef.current?.focus();
            restoreFocusOnCloseRef.current = true;
          }}
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((item, index) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className="data-table-column-menu-item"
              data-danger={item.danger ? "true" : undefined}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              onClick={(event) => {
                event.preventDefault();
                restoreFocusOnCloseRef.current = item.restoreFocus !== false;
                setOpen(null);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
