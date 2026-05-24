import * as Popover from "@radix-ui/react-popover";
import { useState, type ReactNode } from "react";
import type { FieldDef } from "../types";

// Per-column overflow menu opened from the header's `⋯` trigger.
// Plan 06 retired the `Aggregation: …` entry — the SummaryBar at the
// table bottom is now the single picker. Remaining items: `Edit
// options…` (single_select + editable), then any `extraItems?` the
// caller plugs in. Returns null when none would render so the caller
// can mount unconditionally.

export type ColumnHeaderMenuProps = {
  fieldDef: FieldDef;
  // `Edit options…` is hidden when the column is read-only / has no
  // write handler.
  canEditOptions: boolean;
  onEditOptions: () => void;
  extraItems?: (fieldDef: FieldDef) => ReactNode;
};

export function ColumnHeaderMenu({
  fieldDef,
  canEditOptions,
  onEditOptions,
  extraItems,
}: ColumnHeaderMenuProps) {
  const [open, setOpen] = useState(false);
  const showEditOptions = canEditOptions && fieldDef.field_type === "single_select";
  const extraContent = extraItems?.(fieldDef);
  if (!showEditOptions && !extraContent) return null;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="data-table-header-menu-trigger"
          aria-label={`More actions for ${fieldDef.display_name}`}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          ⋯
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="data-table-column-menu"
          align="end"
          sideOffset={6}
          aria-label={`${fieldDef.display_name} column actions`}
        >
          {showEditOptions ? (
            <button
              type="button"
              className="data-table-column-menu-item"
              onClick={() => {
                setOpen(false);
                onEditOptions();
              }}
            >
              Edit options…
            </button>
          ) : null}
          {extraContent}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
