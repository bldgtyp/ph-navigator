import { useMemo } from "react";
import {
  DataTable,
  DATA_TABLE_COLUMN_WIDTHS,
  RECORD_ID_FIELD_KEY,
  attachmentColumn,
  identifierColumn,
  incomingLinkColumn,
  incomingLinkFieldDef,
  linkColumn,
  type DataTableColumnDef,
  type DataTableProps,
  type FieldDef,
  type TableSchema,
  type ViewState,
} from "../../../shared/ui/data-table";
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { useAssetUrls } from "../../assets/hooks";
import { DATASHEET_ATTACHMENT_CONFIG } from "../../assets/lib";
import { sortedPumps } from "../lib";
import { customNumberValue, customTextValue } from "../lib/customValueReaders";
import {
  inverseColumnHeader,
  inverseFieldKey,
  inverseIdsForTarget,
  isRoomsSource,
} from "../lib/inverseSource";
import { statusColumn } from "../lib/statusColumn";
import {
  customFieldColumnDefs,
  type CustomFieldTableActions,
} from "../../../shared/ui/data-table/feature";
import {
  PUMP_DATASHEET_FIELD_KEY,
  PUMP_DEVICE_TYPE_COLUMN_ID,
  PUMP_DEVICE_TYPE_KEY,
  PUMP_INSIDE_OUTSIDE_KEY,
  type InverseLinkField,
  type PumpRow,
  type PumpsSlice,
} from "../types";

export function PumpsTable({
  pumpsSlice,
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
  onInversePillClick,
  onInverseLinkEdit,
  resolveInverseLinkLabel,
  ...customFieldActions
}: {
  pumpsSlice: PumpsSlice;
  tableSchema: TableSchema;
  isEditor: boolean;
  projectId: string;
  view: ViewState;
  onViewChange: (next: ViewState) => void;
  onWrite: NonNullable<DataTableProps<PumpRow>["onWrite"]>;
  buildEmptyRow?: DataTableProps<PumpRow>["buildEmptyRow"];
  generateRowId?: DataTableProps<PumpRow>["generateRowId"];
  sessionKey?: DataTableProps<PumpRow>["sessionKey"];
  overflowMenuActions?: DataTableProps<PumpRow>["overflowMenuActions"];
  footerAction?: DataTableProps<PumpRow>["footerAction"];
  onResetView?: DataTableProps<PumpRow>["onResetView"];
  onInversePillClick?: (field: InverseLinkField, rowId: string) => void;
  onInverseLinkEdit?: (field: InverseLinkField, row: PumpRow) => void;
  resolveInverseLinkLabel?: (field: InverseLinkField, rowId: string) => string | null;
} & CustomFieldTableActions<PumpRow>) {
  const sortedRows = useMemo(() => sortedPumps(pumpsSlice.pumps), [pumpsSlice.pumps]);
  const datasheetAssetIds = useMemo(
    () => Array.from(new Set(sortedRows.flatMap((pump) => pump.datasheet_asset_ids))),
    [sortedRows],
  );
  const datasheetUrls = useAssetUrls(projectId, datasheetAssetIds);
  const datasheetUrlById = useMemo(
    () => new Map((datasheetUrls.data ?? []).map((item) => [item.asset_id, item])),
    [datasheetUrls.data],
  );
  const { fieldDefs, customFields } = tableSchema;
  const inverseLinkFields = pumpsSlice.inverse_link_fields;
  const inverseLinks = pumpsSlice.inverse_links;
  const inverseFieldDefs = useMemo<FieldDef[]>(
    () =>
      (inverseLinkFields ?? []).map((field) => ({
        ...incomingLinkFieldDef({
          fieldKey: inverseFieldKey(field),
          displayName: inverseColumnHeader(field),
          targetTablePath: field.source_table_path,
        }),
      })),
    [inverseLinkFields],
  );
  const dataTableFieldDefs = useMemo(
    () => [...fieldDefs, ...inverseFieldDefs],
    [fieldDefs, inverseFieldDefs],
  );
  const fieldDefByKey = useMemo(
    () => new Map(fieldDefs.map((fieldDef) => [fieldDef.field_key, fieldDef])),
    [fieldDefs],
  );
  const customColumns = useMemo<DataTableColumnDef<PumpRow>[]>(
    () =>
      customFieldColumnDefs({
        customFields,
        fieldDefByKey,
        rowsComputed: pumpsSlice.rows_computed,
      }),
    [customFields, fieldDefByKey, pumpsSlice.rows_computed],
  );
  const columns = useMemo<DataTableColumnDef<PumpRow>[]>(() => {
    const baseColumns: DataTableColumnDef<PumpRow>[] = [
      identifierColumn({
        fieldDefByKey,
        accessor: (pump) => customTextValue(pump, "name"),
        rowsComputed: pumpsSlice.rows_computed,
      }),
      {
        id: RECORD_ID_FIELD_KEY,
        fieldKey: RECORD_ID_FIELD_KEY,
        header: fieldDefByKey.get(RECORD_ID_FIELD_KEY)?.display_name ?? "Tag",
        accessor: (pump) => customTextValue(pump, RECORD_ID_FIELD_KEY),
        defaultWidth: DATA_TABLE_COLUMN_WIDTHS.recordId,
      },
      {
        id: "quantity",
        fieldKey: "quantity",
        header: fieldDefByKey.get("quantity")?.display_name ?? "Quantity",
        accessor: (pump) => customNumberValue(pump, "quantity"),
        defaultWidth: 100,
        className: "numeric-cell",
      },
      {
        id: PUMP_DEVICE_TYPE_COLUMN_ID,
        fieldKey: PUMP_DEVICE_TYPE_KEY,
        header: fieldDefByKey.get(PUMP_DEVICE_TYPE_KEY)?.display_name ?? "Device Type",
        accessor: (pump) => pump.device_type,
        defaultWidth: 150,
      },
      {
        id: PUMP_INSIDE_OUTSIDE_KEY,
        fieldKey: PUMP_INSIDE_OUTSIDE_KEY,
        header: fieldDefByKey.get(PUMP_INSIDE_OUTSIDE_KEY)?.display_name ?? "Inside / Outside",
        accessor: (pump) => customTextValue(pump, PUMP_INSIDE_OUTSIDE_KEY),
        defaultWidth: 150,
      },
      {
        id: "use",
        fieldKey: "use",
        header: fieldDefByKey.get("use")?.display_name ?? "Use",
        accessor: (pump) => customTextValue(pump, "use"),
        defaultWidth: 180,
      },
      {
        id: "manufacturer",
        fieldKey: "manufacturer",
        header: fieldDefByKey.get("manufacturer")?.display_name ?? "Manufacturer",
        accessor: (pump) => customTextValue(pump, "manufacturer"),
        defaultWidth: 160,
      },
      {
        id: "model",
        fieldKey: "model",
        header: fieldDefByKey.get("model")?.display_name ?? "Model",
        accessor: (pump) => customTextValue(pump, "model"),
        defaultWidth: 140,
      },
      {
        id: "volts",
        fieldKey: "volts",
        header: fieldDefByKey.get("volts")?.display_name ?? "Volts",
        accessor: (pump) => customNumberValue(pump, "volts"),
        defaultWidth: DATA_TABLE_COLUMN_WIDTHS.smallNumeric,
        className: "numeric-cell",
      },
      {
        id: "phase",
        fieldKey: "phase",
        header: fieldDefByKey.get("phase")?.display_name ?? "Phase",
        accessor: (pump) => pump.phase,
        defaultWidth: DATA_TABLE_COLUMN_WIDTHS.smallNumeric,
        className: "numeric-cell",
      },
      {
        id: "horse_power",
        fieldKey: "horse_power",
        header: fieldDefByKey.get("horse_power")?.display_name ?? "Horse Power",
        accessor: (pump) => customNumberValue(pump, "horse_power"),
        defaultWidth: 120,
        className: "numeric-cell",
      },
      {
        id: "wattage",
        fieldKey: "wattage",
        header: fieldDefByKey.get("wattage")?.display_name ?? "Wattage",
        accessor: (pump) => customNumberValue(pump, "wattage"),
        defaultWidth: 110,
        className: "numeric-cell",
      },
      {
        id: "flow_gpm",
        fieldKey: "flow_gpm",
        header: fieldDefByKey.get("flow_gpm")?.display_name ?? "Flow",
        accessor: (pump) => customNumberValue(pump, "flow_gpm"),
        defaultWidth: 120,
        className: "numeric-cell",
      },
      {
        id: "runtime_khr_yr",
        fieldKey: "runtime_khr_yr",
        header: fieldDefByKey.get("runtime_khr_yr")?.display_name ?? "Runtime - kHR/YEAR",
        accessor: (pump) => customNumberValue(pump, "runtime_khr_yr"),
        defaultWidth: 160,
        className: "numeric-cell",
      },
      {
        id: "annual_energy_kwh",
        fieldKey: "annual_energy_kwh",
        header: fieldDefByKey.get("annual_energy_kwh")?.display_name ?? "Annual Energy",
        accessor: (pump) => customNumberValue(pump, "annual_energy_kwh"),
        defaultWidth: 150,
        className: "numeric-cell",
      },
      {
        id: "internal_heat_gains_utilization_factor",
        fieldKey: "internal_heat_gains_utilization_factor",
        header:
          fieldDefByKey.get("internal_heat_gains_utilization_factor")?.display_name ??
          "Internal Heat Gains Utilization Factor",
        accessor: (pump) => customNumberValue(pump, "internal_heat_gains_utilization_factor"),
        defaultWidth: 240,
        className: "numeric-cell",
      },
      {
        id: "notes",
        fieldKey: "notes",
        header: fieldDefByKey.get("notes")?.display_name ?? "Notes",
        accessor: (pump) => pump.notes,
        defaultWidth: DATA_TABLE_COLUMN_WIDTHS.notes,
      },
      linkColumn({
        id: "link",
        fieldKey: "link",
        header: fieldDefByKey.get("link")?.display_name ?? "Link",
        getValue: (pump) => pump.link,
      }),
      attachmentColumn({
        id: PUMP_DATASHEET_FIELD_KEY,
        fieldKey: PUMP_DATASHEET_FIELD_KEY,
        header: fieldDefByKey.get(PUMP_DATASHEET_FIELD_KEY)?.display_name ?? "Datasheet",
        projectId,
        isEditor,
        assetUrlById: datasheetUrlById,
        config: DATASHEET_ATTACHMENT_CONFIG,
        AttachmentCell,
        getAssetIds: (pump) => pump.datasheet_asset_ids,
        getRowId: (pump) => pump.id,
        onWrite,
      }),
      statusColumn<PumpRow>(fieldDefByKey),
    ];
    const inverseColumns: DataTableColumnDef<PumpRow>[] = (inverseLinkFields ?? []).map((field) =>
      incomingLinkColumn({
        id: inverseFieldKey(field),
        header: inverseColumnHeader(field),
        getIncomingIds: (pump) => inverseIdsForTarget(inverseLinks, pump.id, field),
        resolveLabel: (rowId) => resolveInverseLinkLabel?.(field, rowId) ?? null,
        onPillClick: (rowId) => onInversePillClick?.(field, rowId),
        edit:
          isEditor && onInverseLinkEdit && isRoomsSource(field)
            ? { onActivate: (pump) => onInverseLinkEdit(field, pump) }
            : null,
      }),
    );
    return [...baseColumns, ...customColumns, ...inverseColumns];
  }, [
    customColumns,
    datasheetUrlById,
    fieldDefByKey,
    isEditor,
    onInversePillClick,
    onWrite,
    projectId,
    inverseLinkFields,
    inverseLinks,
    resolveInverseLinkLabel,
    onInverseLinkEdit,
    pumpsSlice.rows_computed,
  ]);

  return (
    <DataTable
      tableName="Pumps"
      rows={sortedRows}
      columnDefs={columns}
      fieldDefs={dataTableFieldDefs}
      getRowId={(pump) => pump.id}
      emptyMessage={isEditor ? "No pumps yet." : "No pumps are published in this version."}
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
