import { useMemo } from "react";
import {
  DataTable,
  DATA_TABLE_COLUMN_WIDTHS,
  RECORD_ID_FIELD_KEY,
  attachmentColumn,
  identifierColumn,
  linkColumn,
  type DataTableColumnDef,
  type DataTableProps,
  type TableSchema,
  type ViewState,
} from "../../../shared/ui/data-table";
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { useAssetUrls } from "../../assets/hooks";
import { DATASHEET_ATTACHMENT_CONFIG } from "../../assets/lib";
import { sortedFans } from "../lib";
import { statusColumn } from "../lib/statusColumn";
import { customNumberValue, customTextValue } from "../lib/customValueReaders";
import {
  customFieldColumnDefs,
  type CustomFieldTableActions,
} from "../../../shared/ui/data-table/feature";
import {
  FAN_DATASHEET_FIELD_KEY,
  FAN_TYPE_COLUMN_ID,
  FAN_TYPE_KEY,
  type FanRow,
  type FansSlice,
} from "../types";

export function FansTable({
  fansSlice,
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
  ...customFieldActions
}: {
  fansSlice: FansSlice;
  tableSchema: TableSchema;
  isEditor: boolean;
  projectId: string;
  view: ViewState;
  onViewChange: (next: ViewState) => void;
  onWrite: NonNullable<DataTableProps<FanRow>["onWrite"]>;
  buildEmptyRow?: DataTableProps<FanRow>["buildEmptyRow"];
  generateRowId?: DataTableProps<FanRow>["generateRowId"];
  sessionKey?: DataTableProps<FanRow>["sessionKey"];
  overflowMenuActions?: DataTableProps<FanRow>["overflowMenuActions"];
  footerAction?: DataTableProps<FanRow>["footerAction"];
  onResetView?: DataTableProps<FanRow>["onResetView"];
} & CustomFieldTableActions<FanRow>) {
  const sortedRows = useMemo(() => sortedFans(fansSlice.fans), [fansSlice.fans]);
  const datasheetAssetIds = useMemo(
    () => Array.from(new Set(sortedRows.flatMap((fan) => fan.datasheet_asset_ids))),
    [sortedRows],
  );
  const datasheetUrls = useAssetUrls(projectId, datasheetAssetIds);
  const datasheetUrlById = useMemo(
    () => new Map((datasheetUrls.data ?? []).map((item) => [item.asset_id, item])),
    [datasheetUrls.data],
  );
  const { fieldDefs, customFields } = tableSchema;
  const fieldDefByKey = useMemo(
    () => new Map(fieldDefs.map((fieldDef) => [fieldDef.field_key, fieldDef])),
    [fieldDefs],
  );
  const customColumns = useMemo<DataTableColumnDef<FanRow>[]>(
    () =>
      customFieldColumnDefs({ customFields, fieldDefByKey, rowsComputed: fansSlice.rows_computed }),
    [customFields, fieldDefByKey, fansSlice.rows_computed],
  );
  const columns = useMemo<DataTableColumnDef<FanRow>[]>(
    () => [
      {
        id: RECORD_ID_FIELD_KEY,
        fieldKey: RECORD_ID_FIELD_KEY,
        header: fieldDefByKey.get(RECORD_ID_FIELD_KEY)?.display_name ?? "Tag",
        accessor: (fan) => customTextValue(fan, RECORD_ID_FIELD_KEY),
        defaultWidth: DATA_TABLE_COLUMN_WIDTHS.recordId,
      },
      identifierColumn({
        fieldDefByKey,
        accessor: (fan) => customTextValue(fan, "name"),
      }),
      {
        id: "quantity",
        fieldKey: "quantity",
        header: fieldDefByKey.get("quantity")?.display_name ?? "Quantity",
        accessor: (fan) => customNumberValue(fan, "quantity"),
        defaultWidth: 100,
        className: "numeric-cell",
      },
      {
        id: FAN_TYPE_COLUMN_ID,
        fieldKey: FAN_TYPE_KEY,
        header: fieldDefByKey.get(FAN_TYPE_KEY)?.display_name ?? "Type",
        accessor: (fan) => fan.fan_type,
        defaultWidth: 170,
      },
      {
        id: "model",
        fieldKey: "model",
        header: fieldDefByKey.get("model")?.display_name ?? "Model",
        accessor: (fan) => customTextValue(fan, "model"),
        defaultWidth: 140,
      },
      {
        id: "manufacturer",
        fieldKey: "manufacturer",
        header: fieldDefByKey.get("manufacturer")?.display_name ?? "Manufacturer",
        accessor: (fan) => customTextValue(fan, "manufacturer"),
        defaultWidth: 160,
      },
      {
        id: "annual_runtime_min_yr",
        fieldKey: "annual_runtime_min_yr",
        header:
          fieldDefByKey.get("annual_runtime_min_yr")?.display_name ??
          "Annual Runtime (Mins / Year)",
        accessor: (fan) => customNumberValue(fan, "annual_runtime_min_yr"),
        defaultWidth: 210,
        className: "numeric-cell",
      },
      {
        id: "airflow_m3h",
        fieldKey: "airflow_m3h",
        header: fieldDefByKey.get("airflow_m3h")?.display_name ?? "Airflow",
        accessor: (fan) => customNumberValue(fan, "airflow_m3h"),
        defaultWidth: 150,
        className: "numeric-cell",
      },
      {
        id: "amps",
        fieldKey: "amps",
        header: fieldDefByKey.get("amps")?.display_name ?? "Amps",
        accessor: (fan) => customNumberValue(fan, "amps"),
        defaultWidth: DATA_TABLE_COLUMN_WIDTHS.smallNumeric,
        className: "numeric-cell",
      },
      {
        id: "volts",
        fieldKey: "volts",
        header: fieldDefByKey.get("volts")?.display_name ?? "Volts",
        accessor: (fan) => customNumberValue(fan, "volts"),
        defaultWidth: DATA_TABLE_COLUMN_WIDTHS.smallNumeric,
        className: "numeric-cell",
      },
      {
        id: "phase",
        fieldKey: "phase",
        header: fieldDefByKey.get("phase")?.display_name ?? "Phase",
        accessor: (fan) => fan.phase,
        defaultWidth: DATA_TABLE_COLUMN_WIDTHS.smallNumeric,
        className: "numeric-cell",
      },
      {
        id: "power_factor",
        fieldKey: "power_factor",
        header: fieldDefByKey.get("power_factor")?.display_name ?? "Power Factor",
        accessor: (fan) => customNumberValue(fan, "power_factor"),
        defaultWidth: 130,
        className: "numeric-cell",
      },
      {
        id: "watts",
        fieldKey: "watts",
        header: fieldDefByKey.get("watts")?.display_name ?? "Watts",
        accessor: (fan) => customNumberValue(fan, "watts"),
        defaultWidth: 100,
        className: "numeric-cell",
      },
      linkColumn({
        id: "url",
        header: fieldDefByKey.get("url")?.display_name ?? "URL",
        getValue: (fan) => fan.url,
      }),
      {
        id: "notes",
        fieldKey: "notes",
        header: fieldDefByKey.get("notes")?.display_name ?? "Notes",
        accessor: (fan) => fan.notes,
        defaultWidth: DATA_TABLE_COLUMN_WIDTHS.notes,
      },
      attachmentColumn({
        id: FAN_DATASHEET_FIELD_KEY,
        fieldKey: FAN_DATASHEET_FIELD_KEY,
        header: fieldDefByKey.get(FAN_DATASHEET_FIELD_KEY)?.display_name ?? "Datasheet",
        projectId,
        isEditor,
        assetUrlById: datasheetUrlById,
        config: DATASHEET_ATTACHMENT_CONFIG,
        AttachmentCell,
        getAssetIds: (fan) => fan.datasheet_asset_ids,
        getRowId: (fan) => fan.id,
        onWrite,
      }),
      statusColumn<FanRow>(fieldDefByKey),
      ...customColumns,
    ],
    [customColumns, datasheetUrlById, fieldDefByKey, isEditor, onWrite, projectId],
  );

  return (
    <DataTable
      tableName="Fans"
      rows={sortedRows}
      columnDefs={columns}
      fieldDefs={fieldDefs}
      getRowId={(fan) => fan.id}
      emptyMessage={isEditor ? "No fans yet." : "No fans are published in this version."}
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
