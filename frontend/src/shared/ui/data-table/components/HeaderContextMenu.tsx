import * as Popover from "@radix-ui/react-popover";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";
import { pointAnchorRef } from "../lib/popoverAnchor";
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
  // Optional so the pinned identifier column and the synthetic
  // `__record_id__` field can suppress these without forcing the
  // caller to wire no-op handlers (Plan 30 D7 / P7.5).
  onGroupBy?: () => void;
  onHide?: () => void;
};

type MenuItem = {
  key: string;
  label: string;
  danger?: boolean;
  restoreFocus?: boolean;
  onSelect: () => void;
};

type OpenState = { x: number; y: number; activeIndex: number };

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
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const restoreFocusOnCloseRef = useRef(true);

  const isCustomField = fieldDef.read_only_schema !== true;
  const items: MenuItem[] = [];
  if (isCustomField && onEditFieldConfig) {
    items.push({
      key: "edit-field",
      label: "Edit field…",
      onSelect: onEditFieldConfig,
    });
  }
  if (isCustomField && onDeleteField) {
    items.push({
      key: "delete-field",
      label: "Delete field",
      danger: true,
      onSelect: onDeleteField,
    });
  }
  if (isCustomField && onDuplicateField) {
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
    setOpen({ x, y, activeIndex: 0 });
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

  useEffect(() => {
    if (open) itemRefs.current[open.activeIndex]?.focus();
  }, [open]);

  if (isViewer) return null;

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!open) return;
    const last = items.length - 1;
    const set = (activeIndex: number) => setOpen({ ...open, activeIndex });
    if (event.key === "ArrowDown") {
      event.preventDefault();
      set((open.activeIndex + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      set((open.activeIndex - 1 + items.length) % items.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      set(0);
    } else if (event.key === "End") {
      event.preventDefault();
      set(last);
    }
  };

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
