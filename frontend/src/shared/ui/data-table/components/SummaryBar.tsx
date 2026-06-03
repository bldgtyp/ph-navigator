import * as Popover from "@radix-ui/react-popover";
import { useMemo, useState } from "react";
import type { UnitSystem } from "../../../../lib/units";
import { getAggregationKinds, type AggregationKind } from "../fields/aggregations";
import { computeAggregate } from "../hooks/useGridAggregations";
import type { DataTableColumnDef, FieldDef } from "../types";
import { AddFieldTailCell } from "./AddFieldTailCell";

// Plan 06: pinned <tfoot> rendered at the bottom of the table. The
// first column always shows `Count: N` over the post-filter visible
// row set; subsequent columns show the user-picked aggregate (Sum /
// Mean / etc.) or empty. Clicking a non-first cell opens a picker
// that re-uses the same per-field-type catalogue as the (now retired)
// column-header menu. Read-only mode disables the picker but still
// renders the values.

const KIND_LABELS: Record<AggregationKind, string> = {
  none: "None",
  count: "Count",
  count_unique: "Count unique",
  sum: "Sum",
  mean: "Mean",
  min: "Min",
  max: "Max",
};

export type SummaryBarProps<TRow> = {
  columns: readonly DataTableColumnDef<TRow>[];
  visibleRows: readonly TRow[];
  aggregations: Record<string, AggregationKind | null | undefined>;
  fieldDefByKey: Map<string, FieldDef>;
  readOnly: boolean;
  onAggregationChange: (fieldKey: string, next: AggregationKind) => void;
  unitSystem?: UnitSystem;
};

export function SummaryBar<TRow>({
  columns,
  visibleRows,
  aggregations,
  fieldDefByKey,
  readOnly,
  onAggregationChange,
  unitSystem = "SI",
}: SummaryBarProps<TRow>) {
  if (columns.length === 0) return null;
  return (
    <tfoot className="data-table-summary-bar" data-testid="data-table-summary-bar">
      <tr role="row">
        <td className="data-table-gutter data-table-summary-gutter" aria-hidden />
        {columns.map((column, idx) => {
          if (idx === 0) {
            return (
              <td
                key={column.id}
                className="data-table-summary-cell data-table-summary-count data-table-frozen"
                data-field-key={column.fieldKey}
              >
                <span className="data-table-summary-count-inner">
                  <span className="data-table-summary-count-label">Count</span>
                  <span className="data-table-summary-count-value">{visibleRows.length}</span>
                </span>
              </td>
            );
          }
          return (
            <SummaryCell
              key={column.id}
              column={column}
              fieldDef={fieldDefByKey.get(column.fieldKey)}
              visibleRows={visibleRows}
              aggregation={normalizeKind(aggregations[column.fieldKey])}
              readOnly={readOnly}
              onPick={(next) => onAggregationChange(column.fieldKey, next)}
              unitSystem={unitSystem}
            />
          );
        })}
        <AddFieldTailCell variant="td" />
      </tr>
    </tfoot>
  );
}

// Plan 06 §4.1 forward-compat: treat both `null` and `undefined` as
// "no aggregation" so plan 09's persisted shape (which writes `null`
// for explicit-clear) renders identically to the in-memory default.
function normalizeKind(value: AggregationKind | null | undefined): AggregationKind {
  return value ?? "none";
}

type SummaryCellProps<TRow> = {
  column: DataTableColumnDef<TRow>;
  fieldDef: FieldDef | undefined;
  visibleRows: readonly TRow[];
  aggregation: AggregationKind;
  readOnly: boolean;
  onPick: (next: AggregationKind) => void;
  unitSystem: UnitSystem;
};

function SummaryCell<TRow>({
  column,
  fieldDef,
  visibleRows,
  aggregation,
  readOnly,
  onPick,
  unitSystem,
}: SummaryCellProps<TRow>) {
  const [open, setOpen] = useState(false);
  const catalogue = useMemo(() => getAggregationKinds(fieldDef), [fieldDef]);
  const hasCatalogue = catalogue.length > 0;
  const value = useMemo(
    () => computeAggregate(aggregation, visibleRows, column.accessor, fieldDef, unitSystem),
    [aggregation, visibleRows, column.accessor, fieldDef, unitSystem],
  );
  const pickerDisabled = readOnly || !hasCatalogue;
  const triggerLabel =
    aggregation === "none"
      ? `Pick aggregation for ${fieldDef?.display_name ?? column.header}`
      : `Change aggregation for ${fieldDef?.display_name ?? column.header} (currently ${KIND_LABELS[aggregation]})`;

  const cellClassName = [
    "data-table-summary-cell",
    aggregation !== "none" ? "data-table-summary-cell-active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (pickerDisabled) {
    return (
      <td
        className={cellClassName}
        data-field-key={column.fieldKey}
        data-readonly={readOnly ? "true" : undefined}
      >
        {aggregation !== "none" ? <SummaryValue kind={aggregation} value={value} /> : null}
      </td>
    );
  }

  const choices: AggregationKind[] = ["none", ...catalogue.map((def) => def.kind)];
  return (
    <td
      className={cellClassName}
      data-field-key={column.fieldKey}
      data-summary-open={open ? "true" : undefined}
    >
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="data-table-summary-trigger"
            aria-label={triggerLabel}
            // Phase 6 follow-up: the table's pointer-drag / focus
            // recovery sit on document-level listeners that can race
            // Radix's open and immediately treat the same click as an
            // outside interaction, snapping the popover shut. Stopping
            // propagation at the trigger keeps the open click owned by
            // Radix — mirrors the ColumnHeaderMenu trigger.
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            {aggregation !== "none" ? <SummaryValue kind={aggregation} value={value} /> : null}
            <span aria-hidden className="data-table-summary-chevron">
              ▾
            </span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="data-table-column-menu"
            align="end"
            side="top"
            sideOffset={6}
            aria-label={`${fieldDef?.display_name ?? column.header} aggregation`}
            // Body cells live under the same wrapper that owns the
            // grid's keyboard / paste handlers — without this guard a
            // stray focus shift back to the wrapper would close the
            // popover the instant it opened.
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            {choices.map((kind) => (
              <button
                key={kind}
                type="button"
                className="data-table-column-menu-item"
                aria-pressed={kind === aggregation}
                data-active={kind === aggregation ? "true" : undefined}
                onClick={() => {
                  onPick(kind);
                  setOpen(false);
                }}
              >
                {KIND_LABELS[kind]}
              </button>
            ))}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </td>
  );
}

function SummaryValue({ kind, value }: { kind: AggregationKind; value: string }) {
  return (
    <>
      <span className="data-table-summary-kind">{KIND_LABELS[kind]}</span>
      <span className="data-table-summary-value">{value}</span>
    </>
  );
}
