import * as Popover from "@radix-ui/react-popover";
import { useState, type ReactNode } from "react";
import { getAggregationKinds, type AggregationKind } from "../fields/aggregations";
import type { FieldDef } from "../types";
import { AggregationMenuItem } from "./AggregationMenuItem";

// Phase 6 §4.9: per-column overflow menu opened from the header's
// `⋯` trigger. Renders whenever the field has ≥1 menu item to show.
// Items, in order:
//   1. `Edit options…`     — single_select fields, editable mode only
//   2. `Aggregation: <current> ▾` — every aggregatable field
//   3. `extraItems?(fieldDef)` — forward-compat slot for future
//      column-config additions
// A divider separates groups 1 and 2 when both are present.

export type ColumnHeaderMenuProps = {
  fieldDef: FieldDef;
  // Hide `Edit options…` when read-only or when no write handler
  // exists (matches Phase 5's gating contract). Aggregation picking
  // stays available in read-only mode per constraint 9.
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
