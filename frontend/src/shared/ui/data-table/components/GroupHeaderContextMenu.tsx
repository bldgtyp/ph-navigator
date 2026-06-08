import * as Popover from "@radix-ui/react-popover";
import { useEffect } from "react";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { useGridMenuKeyboard } from "../hooks/useGridMenuKeyboard";
import { pointAnchorRef } from "../lib/popoverAnchor";

export type GroupHeaderContextMenuOpenState = {
  x: number;
  y: number;
};

export type GroupHeaderContextMenuProps = {
  open: GroupHeaderContextMenuOpenState | null;
  onClose: () => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
};

export function GroupHeaderContextMenu({
  open,
  onClose,
  onCollapseAll,
  onExpandAll,
}: GroupHeaderContextMenuProps) {
  const items = [
    {
      key: "collapse-all",
      label: "Collapse all",
      icon: <ChevronsDownUp size={14} aria-hidden="true" />,
      onSelect: onCollapseAll,
    },
    {
      key: "expand-all",
      label: "Expand all",
      icon: <ChevronsUpDown size={14} aria-hidden="true" />,
      onSelect: onExpandAll,
    },
  ];
  const { itemRefs, onKeyDown, resetToInitial } = useGridMenuKeyboard({
    itemCount: items.length,
  });

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
          aria-label="Group header actions"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onKeyDown={onKeyDown}
        >
          {items.map((item, index) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className="data-table-column-menu-item data-table-column-menu-item--with-icon"
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
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
