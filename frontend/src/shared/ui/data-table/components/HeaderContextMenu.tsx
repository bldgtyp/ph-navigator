import * as Popover from "@radix-ui/react-popover";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";
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
  onInsertFieldLeft?: () => void;
  onInsertFieldRight?: () => void;
  onSortAsc: () => void;
  onSortDesc: () => void;
  onGroupBy: () => void;
  onHide: () => void;
};

type MenuItem = {
  key: string;
  label: string;
  danger?: boolean;
  onSelect: () => void;
};

type OpenState = { x: number; y: number; activeIndex: number };

export function HeaderContextMenu({
  fieldDef,
  triggerRef,
  isViewer,
  onDeleteField,
  onInsertFieldLeft,
  onInsertFieldRight,
  onSortAsc,
  onSortDesc,
  onGroupBy,
  onHide,
}: HeaderContextMenuProps) {
  const [open, setOpen] = useState<OpenState | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const items: MenuItem[] = [
    { key: "sort-asc", label: "Sort A → Z", onSelect: onSortAsc },
    { key: "sort-desc", label: "Sort Z → A", onSelect: onSortDesc },
    { key: "group-by", label: "Group by this field", onSelect: onGroupBy },
    { key: "hide", label: "Hide field", onSelect: onHide },
  ];
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
  if (fieldDef.read_only_schema !== true && onDeleteField) {
    items.push({
      key: "delete-field",
      label: "Delete field",
      danger: true,
      onSelect: onDeleteField,
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

  // Virtual anchor (Radix pattern): a synthetic rect at the pointer for
  // right-click, or the trigger's bottom-left for keyboard invocation.
  // Avoids a real DOM node + dedicated CSS rule for positioning.
  const virtualRef = open
    ? {
        getBoundingClientRect: () =>
          ({
            x: open.x,
            y: open.y,
            top: open.y,
            left: open.x,
            right: open.x,
            bottom: open.y,
            width: 0,
            height: 0,
            toJSON: () => ({}),
          }) as DOMRect,
      }
    : null;

  return (
    <Popover.Root
      open={open !== null}
      onOpenChange={(next) => {
        if (!next) setOpen(null);
      }}
    >
      {virtualRef ? <Popover.Anchor virtualRef={{ current: virtualRef }} /> : null}
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
            triggerRef.current?.focus();
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
