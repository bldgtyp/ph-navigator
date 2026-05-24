import * as Popover from "@radix-ui/react-popover";
import { useState } from "react";
import { getAggregationKinds, type AggregationKind } from "../fields/aggregations";
import type { FieldDef } from "../types";

// Phase 6 §4.9.1: per-column aggregation picker. The outer label
// reads `Aggregation: <current> ▾` and opens a sub-popover listing
// every kind the field's catalogue exposes plus an implicit `None`.
// Picking a kind closes the sub-popover and dispatches the new map.
// `None` deletes the key from view.aggregations so the map stays tight.
//
// Renders nothing when the field has no aggregation catalogue
// (attachment / argb_color). The parent (ColumnHeaderMenu) keys the
// `⋯` trigger visibility on the same predicate.

const KIND_LABELS: Record<AggregationKind, string> = {
  none: "None",
  count: "Count",
  sum: "Sum",
  mean: "Mean",
  min: "Min",
  max: "Max",
};

export type AggregationMenuItemProps = {
  fieldDef: FieldDef;
  current: AggregationKind;
  onPick: (next: AggregationKind) => void;
  onAfterPick?: () => void;
};

export function AggregationMenuItem({
  fieldDef,
  current,
  onPick,
  onAfterPick,
}: AggregationMenuItemProps) {
  const [open, setOpen] = useState(false);
  const catalogue = getAggregationKinds(fieldDef);
  if (catalogue.length === 0) return null;
  const choices: AggregationKind[] = ["none", ...catalogue.map((def) => def.kind)];
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className="data-table-column-menu-item">
          <span>Aggregation:</span>
          <span className="data-table-column-menu-item-value">{KIND_LABELS[current]}</span>
          <span aria-hidden>▾</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="data-table-column-menu-submenu"
          align="start"
          side="right"
          sideOffset={4}
          aria-label="Aggregation kind"
        >
          {choices.map((kind) => (
            <button
              key={kind}
              type="button"
              className="data-table-column-menu-item"
              aria-pressed={kind === current}
              data-active={kind === current ? "true" : undefined}
              onClick={() => {
                onPick(kind);
                setOpen(false);
                onAfterPick?.();
              }}
            >
              {KIND_LABELS[kind]}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
