import { useMemo, type CSSProperties } from "react";
import {
  DataTable,
  RECORD_ID_FIELD_KEY,
  type DataTableColumnDef,
  type DataTableProps,
  type FieldDef,
  type TableSchema,
  type ViewState,
} from "../../../shared/ui/data-table";
import { singleSelectOption } from "../../../shared/ui/data-table/lib";
import { sortedVentilators } from "../lib";
import { customNumberValue, customTextValue } from "../lib/customValueReaders";
import {
  customFieldColumnDefs,
  type CustomFieldTableActions,
} from "../../../shared/ui/data-table/feature";
import {
  VENTILATOR_INSIDE_OUTSIDE_COLUMN_ID,
  VENTILATOR_INSIDE_OUTSIDE_KEY,
  type VentilatorRow,
  type VentilatorsSlice,
} from "../types";

export const VENTILATOR_LINKED_HP_INDOOR_COLUMN_ID = "linked_hp_indoor_count";

export function VentilatorsTable({
  ventilatorsSlice,
  tableSchema,
  isEditor,
  view,
  onViewChange,
  onWrite,
  buildEmptyRow,
  generateRowId,
  sessionKey,
  overflowMenuActions,
  footerAction,
  onResetView,
  linkedHpIndoorCountById,
  ...customFieldActions
}: {
  ventilatorsSlice: VentilatorsSlice;
  tableSchema: TableSchema;
  isEditor: boolean;
  view: ViewState;
  onViewChange: (next: ViewState) => void;
  onWrite: NonNullable<DataTableProps<VentilatorRow>["onWrite"]>;
  buildEmptyRow?: DataTableProps<VentilatorRow>["buildEmptyRow"];
  generateRowId?: DataTableProps<VentilatorRow>["generateRowId"];
  sessionKey?: DataTableProps<VentilatorRow>["sessionKey"];
  overflowMenuActions?: DataTableProps<VentilatorRow>["overflowMenuActions"];
  footerAction?: DataTableProps<VentilatorRow>["footerAction"];
  onResetView?: DataTableProps<VentilatorRow>["onResetView"];
  // Reverse-lookup count: ventilator id → number of HP indoor units linking to it.
  // Phase 4 (US-EQ-4 amendment). Undefined while the HP slice is still loading;
  // the column accessor falls back to 0.
  linkedHpIndoorCountById?: Map<string, number>;
} & CustomFieldTableActions<VentilatorRow>) {
  const sortedRows = useMemo(
    () => sortedVentilators(ventilatorsSlice.ventilators),
    [ventilatorsSlice.ventilators],
  );
  const { fieldDefs, customFields } = tableSchema;
  const fieldDefByKey = useMemo(
    () => new Map(fieldDefs.map((fieldDef) => [fieldDef.field_key, fieldDef])),
    [fieldDefs],
  );
  const customColumns = useMemo<DataTableColumnDef<VentilatorRow>[]>(
    () =>
      customFieldColumnDefs({
        customFields,
        fieldDefByKey,
        rowsComputed: ventilatorsSlice.rows_computed,
      }),
    [customFields, fieldDefByKey, ventilatorsSlice.rows_computed],
  );
  const columns = useMemo<DataTableColumnDef<VentilatorRow>[]>(
    () => [
      {
        id: RECORD_ID_FIELD_KEY,
        fieldKey: RECORD_ID_FIELD_KEY,
        header: fieldDefByKey.get(RECORD_ID_FIELD_KEY)?.display_name ?? "Tag",
        accessor: (ventilator) => customTextValue(ventilator, RECORD_ID_FIELD_KEY),
        defaultWidth: 100,
      },
      {
        id: "name",
        fieldKey: "name",
        header: fieldDefByKey.get("name")?.display_name ?? "Name",
        accessor: (ventilator) => customTextValue(ventilator, "name"),
        defaultWidth: 180,
      },
      {
        id: "airflow_rate_m3h",
        fieldKey: "airflow_rate_m3h",
        header: fieldDefByKey.get("airflow_rate_m3h")?.display_name ?? "Airflow Rate",
        accessor: (ventilator) => customNumberValue(ventilator, "airflow_rate_m3h"),
        defaultWidth: 150,
        className: "numeric-cell",
      },
      {
        id: "model",
        fieldKey: "model",
        header: fieldDefByKey.get("model")?.display_name ?? "Model",
        accessor: (ventilator) => customTextValue(ventilator, "model"),
        defaultWidth: 140,
      },
      {
        id: "manufacturer",
        fieldKey: "manufacturer",
        header: fieldDefByKey.get("manufacturer")?.display_name ?? "Manufacturer",
        accessor: (ventilator) => customTextValue(ventilator, "manufacturer"),
        defaultWidth: 160,
      },
      {
        id: "heat_recovery_percent",
        fieldKey: "heat_recovery_percent",
        header: fieldDefByKey.get("heat_recovery_percent")?.display_name ?? "Heat Recovery %",
        accessor: (ventilator) => customNumberValue(ventilator, "heat_recovery_percent"),
        defaultWidth: 150,
        className: "numeric-cell",
      },
      {
        id: "moisture_recovery_percent",
        fieldKey: "moisture_recovery_percent",
        header:
          fieldDefByKey.get("moisture_recovery_percent")?.display_name ?? "Moisture Recovery %",
        accessor: (ventilator) => customNumberValue(ventilator, "moisture_recovery_percent"),
        defaultWidth: 170,
        className: "numeric-cell",
      },
      {
        id: "electrical_efficiency_wh_m3",
        fieldKey: "electrical_efficiency_wh_m3",
        header:
          fieldDefByKey.get("electrical_efficiency_wh_m3")?.display_name ?? "Electrical Efficiency",
        accessor: (ventilator) => customNumberValue(ventilator, "electrical_efficiency_wh_m3"),
        defaultWidth: 180,
        className: "numeric-cell",
      },
      {
        id: "filter_merv_rating",
        fieldKey: "filter_merv_rating",
        header: fieldDefByKey.get("filter_merv_rating")?.display_name ?? "Filter MERV Rating",
        accessor: (ventilator) => customNumberValue(ventilator, "filter_merv_rating"),
        defaultWidth: 160,
        className: "numeric-cell",
      },
      {
        id: VENTILATOR_INSIDE_OUTSIDE_COLUMN_ID,
        fieldKey: VENTILATOR_INSIDE_OUTSIDE_KEY,
        header:
          fieldDefByKey.get(VENTILATOR_INSIDE_OUTSIDE_KEY)?.display_name ?? "Inside / Outside",
        accessor: (ventilator) => ventilator.inside_outside,
        render: (ventilator) =>
          optionPill(ventilator.inside_outside, fieldDefByKey.get(VENTILATOR_INSIDE_OUTSIDE_KEY)),
        defaultWidth: 150,
      },
      {
        id: "url",
        fieldKey: "url",
        header: fieldDefByKey.get("url")?.display_name ?? "URL",
        accessor: (ventilator) => ventilator.url,
        render: (ventilator) =>
          ventilator.url ? (
            <a
              href={ventilator.url}
              target="_blank"
              rel="noopener noreferrer"
              className="data-table-link-cell"
            >
              {shortenUrl(ventilator.url)}
            </a>
          ) : null,
        measureText: (ventilator) => ventilator.url ?? "",
        defaultWidth: 180,
      },
      {
        id: "notes",
        fieldKey: "notes",
        header: fieldDefByKey.get("notes")?.display_name ?? "Notes",
        accessor: (ventilator) => ventilator.notes,
        defaultWidth: 280,
      },
      {
        id: VENTILATOR_LINKED_HP_INDOOR_COLUMN_ID,
        fieldKey: VENTILATOR_LINKED_HP_INDOOR_COLUMN_ID,
        header: "Linked HP indoor",
        // `linkedHpIndoorCountById === undefined` distinguishes "HP slice
        // still loading" from "loaded with no link" (count of 0). Both
        // the accessor (used for sort + filter) and the render must agree
        // on the loading case so the user never sorts or filters by a
        // phantom 0 while the cells visibly show `—`.
        accessor: (ventilator) =>
          linkedHpIndoorCountById === undefined
            ? null
            : (linkedHpIndoorCountById.get(ventilator.id) ?? 0),
        render: (ventilator) =>
          linkedHpIndoorCountById === undefined
            ? "—"
            : String(linkedHpIndoorCountById.get(ventilator.id) ?? 0),
        defaultWidth: 130,
        className: "numeric-cell",
      },
      ...customColumns,
    ],
    [customColumns, fieldDefByKey, linkedHpIndoorCountById],
  );

  return (
    <DataTable
      rows={sortedRows}
      columnDefs={columns}
      fieldDefs={fieldDefs}
      getRowId={(ventilator) => ventilator.id}
      emptyMessage={
        isEditor ? "No ventilators yet." : "No ventilators are published in this version."
      }
      readOnly={!isEditor}
      view={view}
      onViewChange={onViewChange}
      onWrite={onWrite}
      buildEmptyRow={buildEmptyRow}
      generateRowId={generateRowId}
      sessionKey={sessionKey}
      overflowMenuActions={overflowMenuActions}
      footerAction={footerAction}
      onResetView={onResetView}
      {...customFieldActions}
    />
  );
}

function optionPill(value: string | null, fieldDef: FieldDef | undefined) {
  const option = singleSelectOption(value, fieldDef);
  const label = value ? (option?.label ?? "Missing option") : "Unassigned";
  const applyColor = option && fieldDef?.colorCodeOptions !== false;
  return (
    <span
      className={
        option ? "single-select-pill" : value ? "single-select-pill missing" : "muted-cell"
      }
      style={applyColor ? ({ "--option-color": option.color } as CSSProperties) : undefined}
    >
      {label}
    </span>
  );
}

function shortenUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return value;
  }
}
