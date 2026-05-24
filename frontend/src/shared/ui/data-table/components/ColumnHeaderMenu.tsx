import * as Popover from "@radix-ui/react-popover";
import { useState, type ReactNode } from "react";
import { getAggregationKinds, type AggregationKind } from "../fields/aggregations";
import type { FieldDef } from "../types";
import { AggregationMenuItem } from "./AggregationMenuItem";

// Per-column overflow menu opened from the header's `⋯` trigger.
// Items, in order: `Edit options…` (single_select + editable),
// `Aggregation: <current> ▾` (every aggregatable field), then any
// `extraItems?` the caller plugs in. Returns null when none of these
// would render, so the caller can mount unconditionally.

export type ColumnHeaderMenuProps = {
  fieldDef: FieldDef;
  // `Edit options…` is hidden when the column is read-only / has no
  // write handler. Aggregation picking stays available even in
  // read-only mode (view-state change, not a data write).
  canEditOptions: boolean;
  onEditOptions: () => void;
  currentAggregation: AggregationKind;
  onAggregationChange: (next: AggregationKind) => void;
  extraItems?: (fieldDef: FieldDef) => ReactNode;
};

export function ColumnHeaderMenu({
  fieldDef,
  canEditOptions,
  onEditOptions,
  currentAggregation,
  onAggregationChange,
  extraItems,
}: ColumnHeaderMenuProps) {
  const [open, setOpen] = useState(false);
  const showEditOptions = canEditOptions && fieldDef.field_type === "single_select";
  const showAggregation = getAggregationKinds(fieldDef).length > 0;
  if (!showEditOptions && !showAggregation) return null;
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
          {showEditOptions && showAggregation ? (
            <hr className="data-table-column-menu-divider" />
          ) : null}
          {showAggregation ? (
            <AggregationMenuItem
              fieldDef={fieldDef}
              current={currentAggregation}
              onPick={onAggregationChange}
              onAfterPick={() => setOpen(false)}
            />
          ) : null}
          {extraItems?.(fieldDef)}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
