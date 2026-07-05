import { useMemo } from "react";
import {
  buildLinkedRecordOps,
  DataTable,
  DATA_TABLE_COLUMN_WIDTHS,
  RECORD_ID_FIELD_KEY,
  attachmentColumn,
  identifierColumn,
  linkColumn,
  type DataTableColumnDef,
  type DataTableProps,
  type LinkedRecordCellOps,
  type TableSchema,
  type ViewState,
} from "../../../shared/ui/data-table";
import {
  HEAT_PUMP_LINK_TARGETS,
  incomingIndoorUnitColumnDef,
  incomingIndoorUnitIds,
  incomingIndoorUnitsFieldDef,
} from "../heat-pumps/link-fields";
import type { HeatPumpIndoorUnitRow } from "../heat-pumps/types";
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { useAssetUrls } from "../../assets/hooks";
import { DATASHEET_ATTACHMENT_CONFIG } from "../../assets/lib";
import { sortedVentilators } from "../lib";
import { statusColumn } from "../lib/statusColumn";
import { customNumberValue, customTextValue } from "../lib/customValueReaders";
import {
  customFieldColumnDefs,
  type CustomFieldTableActions,
} from "../../../shared/ui/data-table/feature";
import {
  VENTILATOR_DATASHEET_FIELD_KEY,
  VENTILATOR_FROST_PROTECTION_KEY,
  VENTILATOR_INSIDE_OUTSIDE_COLUMN_ID,
  VENTILATOR_INSIDE_OUTSIDE_KEY,
  type VentilatorRow,
  type VentilatorsSlice,
} from "../types";

const EMPTY_HEAT_PUMP_INDOOR_UNITS: readonly HeatPumpIndoorUnitRow[] = [];

export function VentilatorsTable({
  ventilatorsSlice,
  tableSchema,
  isEditor,
  projectId,
  view,
  onViewChange,
  onWrite,
  buildEmptyRow,
  generateRowId,
  sessionKey,
  overflowMenuActions,
  footerAction,
  onResetView,
  onEdit,
  onIncomingIndoorUnitOpen,
  onIncomingIndoorUnitsLinkEdit,
  heatPumpIndoorUnits = EMPTY_HEAT_PUMP_INDOOR_UNITS,
  ...customFieldActions
}: {
  ventilatorsSlice: VentilatorsSlice;
  tableSchema: TableSchema;
  isEditor: boolean;
  projectId: string;
  view: ViewState;
  onViewChange: (next: ViewState) => void;
  onWrite: NonNullable<DataTableProps<VentilatorRow>["onWrite"]>;
  buildEmptyRow?: DataTableProps<VentilatorRow>["buildEmptyRow"];
  generateRowId?: DataTableProps<VentilatorRow>["generateRowId"];
  sessionKey?: DataTableProps<VentilatorRow>["sessionKey"];
  overflowMenuActions?: DataTableProps<VentilatorRow>["overflowMenuActions"];
  footerAction?: DataTableProps<VentilatorRow>["footerAction"];
  onResetView?: DataTableProps<VentilatorRow>["onResetView"];
  onEdit?: (row: VentilatorRow) => void;
  onIncomingIndoorUnitOpen?: (rowId: string) => void;
  onIncomingIndoorUnitsLinkEdit?: (row: VentilatorRow) => void;
  heatPumpIndoorUnits?: readonly HeatPumpIndoorUnitRow[];
} & CustomFieldTableActions<VentilatorRow>) {
  const sortedRows = useMemo(
    () => sortedVentilators(ventilatorsSlice.ventilators),
    [ventilatorsSlice.ventilators],
  );
  const datasheetAssetIds = useMemo(
    () => Array.from(new Set(sortedRows.flatMap((ventilator) => ventilator.datasheet_asset_ids))),
    [sortedRows],
  );
  const datasheetUrls = useAssetUrls(projectId, datasheetAssetIds);
  const datasheetUrlById = useMemo(
    () => new Map((datasheetUrls.data ?? []).map((item) => [item.asset_id, item])),
    [datasheetUrls.data],
  );
  const { fieldDefs, customFields } = tableSchema;
  const tableFieldDefs = useMemo(
    () => [...fieldDefs, incomingIndoorUnitsFieldDef("HP indoor units")],
    [fieldDefs],
  );
  const fieldDefByKey = useMemo(
    () => new Map(tableFieldDefs.map((fieldDef) => [fieldDef.field_key, fieldDef])),
    [tableFieldDefs],
  );
  const sortedIndoorUnits = useMemo(
    () =>
      [...heatPumpIndoorUnits].sort(
        (a, b) =>
          a.tag.localeCompare(b.tag, undefined, { numeric: true }) || a.id.localeCompare(b.id),
      ),
    [heatPumpIndoorUnits],
  );
  const incomingIndoorUnitIdsByVentilatorId = useMemo(
    () => groupIndoorUnitIdsByVentilator(sortedIndoorUnits),
    [sortedIndoorUnits],
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
        defaultWidth: DATA_TABLE_COLUMN_WIDTHS.recordId,
      },
      identifierColumn({
        fieldDefByKey,
        accessor: (ventilator) => customTextValue(ventilator, "name"),
      }),
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
        id: VENTILATOR_FROST_PROTECTION_KEY,
        fieldKey: VENTILATOR_FROST_PROTECTION_KEY,
        header:
          fieldDefByKey.get(VENTILATOR_FROST_PROTECTION_KEY)?.display_name ?? "Frost Protection",
        accessor: (ventilator) => customTextValue(ventilator, VENTILATOR_FROST_PROTECTION_KEY),
        defaultWidth: 160,
      },
      {
        id: "frost_protection_limit_temp_c",
        fieldKey: "frost_protection_limit_temp_c",
        header:
          fieldDefByKey.get("frost_protection_limit_temp_c")?.display_name ??
          "Frost Protection Limit Temp",
        accessor: (ventilator) => customNumberValue(ventilator, "frost_protection_limit_temp_c"),
        defaultWidth: 210,
        className: "numeric-cell",
      },
      {
        id: VENTILATOR_INSIDE_OUTSIDE_COLUMN_ID,
        fieldKey: VENTILATOR_INSIDE_OUTSIDE_KEY,
        header:
          fieldDefByKey.get(VENTILATOR_INSIDE_OUTSIDE_KEY)?.display_name ?? "Inside / Outside",
        accessor: (ventilator) => ventilator.inside_outside,
        defaultWidth: 150,
      },
      linkColumn({
        id: "url",
        header: fieldDefByKey.get("url")?.display_name ?? "URL",
        getValue: (ventilator) => ventilator.url,
      }),
      {
        id: "notes",
        fieldKey: "notes",
        header: fieldDefByKey.get("notes")?.display_name ?? "Notes",
        accessor: (ventilator) => ventilator.notes,
        defaultWidth: DATA_TABLE_COLUMN_WIDTHS.notes,
      },
      attachmentColumn({
        id: VENTILATOR_DATASHEET_FIELD_KEY,
        fieldKey: VENTILATOR_DATASHEET_FIELD_KEY,
        header: fieldDefByKey.get(VENTILATOR_DATASHEET_FIELD_KEY)?.display_name ?? "Datasheet",
        projectId,
        isEditor,
        assetUrlById: datasheetUrlById,
        config: DATASHEET_ATTACHMENT_CONFIG,
        AttachmentCell,
        getAssetIds: (ventilator) => ventilator.datasheet_asset_ids,
        getRowId: (ventilator) => ventilator.id,
        onWrite,
      }),
      incomingIndoorUnitColumnDef<VentilatorRow>({
        header: "HP indoor units",
        indoorUnits: sortedIndoorUnits,
        getIncomingIds: (ventilator) =>
          incomingIndoorUnitIds(incomingIndoorUnitIdsByVentilatorId, ventilator.id),
        onPillClick: onIncomingIndoorUnitOpen,
        onActivateEdit: isEditor ? onIncomingIndoorUnitsLinkEdit : undefined,
      }),
      statusColumn<VentilatorRow>(fieldDefByKey),
      ...customColumns,
    ],
    [
      customColumns,
      datasheetUrlById,
      fieldDefByKey,
      incomingIndoorUnitIdsByVentilatorId,
      isEditor,
      onIncomingIndoorUnitOpen,
      onIncomingIndoorUnitsLinkEdit,
      onWrite,
      projectId,
      sortedIndoorUnits,
    ],
  );
  const linkedRecordOps = useMemo<ReadonlyMap<string, LinkedRecordCellOps>>(
    () =>
      buildLinkedRecordOps<HeatPumpIndoorUnitRow>({
        fieldDefs: tableFieldDefs,
        targetTablePath: HEAT_PUMP_LINK_TARGETS.indoorUnits,
        targetRows: sortedIndoorUnits,
        getRowId: (unit) => unit.id,
        getRecordId: (unit) => unit.tag || unit.id,
        onPillClick: onIncomingIndoorUnitOpen,
      }),
    [onIncomingIndoorUnitOpen, sortedIndoorUnits, tableFieldDefs],
  );

  return (
    <DataTable
      tableName="Ventilators"
      rows={sortedRows}
      columnDefs={columns}
      fieldDefs={tableFieldDefs}
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
      onRowOpen={onEdit}
      overflowMenuActions={overflowMenuActions}
      footerAction={footerAction}
      onResetView={onResetView}
      linkedRecordOps={linkedRecordOps}
      {...customFieldActions}
    />
  );
}

function groupIndoorUnitIdsByVentilator(
  indoorUnits: readonly HeatPumpIndoorUnitRow[],
): ReadonlyMap<string, readonly string[]> {
  const index = new Map<string, string[]>();
  for (const unit of indoorUnits) {
    if (!unit.linked_erv_unit_id) continue;
    const ids = index.get(unit.linked_erv_unit_id);
    if (ids) {
      ids.push(unit.id);
    } else {
      index.set(unit.linked_erv_unit_id, [unit.id]);
    }
  }
  return index;
}
