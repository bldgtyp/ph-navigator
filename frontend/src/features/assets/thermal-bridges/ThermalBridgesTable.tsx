import { useMemo } from "react";
import {
  DataTable,
  DATA_TABLE_COLUMN_WIDTHS,
  RECORD_ID_FIELD_KEY,
  attachmentColumn,
  identifierColumn,
  type DataTableColumnDef,
  type DataTableProps,
  type TableSchema,
  type ViewState,
} from "../../../shared/ui/data-table";
import { AttachmentCell } from "../components/AttachmentCell";
import { useAssetUrls } from "../hooks";
import {
  customFieldColumnDefs,
  type CustomFieldTableActions,
} from "../../../shared/ui/data-table/feature";
import { customNumberValue, customTextValue } from "../../equipment/lib/customValueReaders";
import { statusColumn } from "../../equipment/lib/statusColumn";
import {
  THERMAL_BRIDGE_PDF_REPORT_FIELD_KEY,
  THERMAL_BRIDGE_TYPE_KEY,
  type ThermalBridgeRow,
  type ThermalBridgesSlice,
} from "../../equipment/types";
import { PDF_REPORT_ATTACHMENT_CONFIG } from "./constants";
import { sortedThermalBridges } from "./payloads";

export function ThermalBridgesTable({
  slice,
  tableSchema,
  isEditor,
  projectId,
  view,
  onViewChange,
  onWrite,
  buildEmptyRow,
  generateRowId,
  sessionKey,
  footerAction,
  onResetView,
  ...customFieldActions
}: {
  slice: ThermalBridgesSlice;
  tableSchema: TableSchema;
  isEditor: boolean;
  projectId: string;
  view: ViewState;
  onViewChange: (next: ViewState) => void;
  onWrite: NonNullable<DataTableProps<ThermalBridgeRow>["onWrite"]>;
  buildEmptyRow?: DataTableProps<ThermalBridgeRow>["buildEmptyRow"];
  generateRowId?: DataTableProps<ThermalBridgeRow>["generateRowId"];
  sessionKey?: DataTableProps<ThermalBridgeRow>["sessionKey"];
  footerAction?: DataTableProps<ThermalBridgeRow>["footerAction"];
  onResetView?: DataTableProps<ThermalBridgeRow>["onResetView"];
} & CustomFieldTableActions<ThermalBridgeRow>) {
  const sortedRows = useMemo(
    () => sortedThermalBridges(slice.thermal_bridges),
    [slice.thermal_bridges],
  );
  const reportAssetIds = useMemo(
    () => Array.from(new Set(sortedRows.flatMap((row) => row.pdf_report_asset_ids))),
    [sortedRows],
  );
  const reportUrls = useAssetUrls(projectId, reportAssetIds);
  const reportUrlById = useMemo(
    () => new Map((reportUrls.data ?? []).map((item) => [item.asset_id, item])),
    [reportUrls.data],
  );
  const { fieldDefs, customFields } = tableSchema;
  const fieldDefByKey = useMemo(
    () => new Map(fieldDefs.map((fieldDef) => [fieldDef.field_key, fieldDef])),
    [fieldDefs],
  );
  const customColumns = useMemo<DataTableColumnDef<ThermalBridgeRow>[]>(
    () => customFieldColumnDefs({ customFields, fieldDefByKey, rowsComputed: slice.rows_computed }),
    [customFields, fieldDefByKey, slice.rows_computed],
  );
  const columns = useMemo<DataTableColumnDef<ThermalBridgeRow>[]>(
    () => [
      {
        id: RECORD_ID_FIELD_KEY,
        fieldKey: RECORD_ID_FIELD_KEY,
        header: fieldDefByKey.get(RECORD_ID_FIELD_KEY)?.display_name ?? "Tag",
        accessor: (row) => customTextValue(row, RECORD_ID_FIELD_KEY),
        defaultWidth: DATA_TABLE_COLUMN_WIDTHS.recordId,
      },
      identifierColumn({
        fieldDefByKey,
        accessor: (row) => customTextValue(row, "name"),
        defaultWidth: 190,
      }),
      {
        id: "sheet_name",
        fieldKey: "sheet_name",
        header: fieldDefByKey.get("sheet_name")?.display_name ?? "Sheet Name",
        accessor: (row) => customTextValue(row, "sheet_name"),
        defaultWidth: 120,
      },
      {
        id: "drawing_number",
        fieldKey: "drawing_number",
        header: fieldDefByKey.get("drawing_number")?.display_name ?? "Drawing Number",
        accessor: (row) => customTextValue(row, "drawing_number"),
        defaultWidth: 140,
      },
      {
        id: "quantity",
        fieldKey: "quantity",
        header: fieldDefByKey.get("quantity")?.display_name ?? "Quantity",
        accessor: (row) => customNumberValue(row, "quantity"),
        defaultWidth: 100,
        className: "numeric-cell",
      },
      {
        id: "psi_value_w_mk",
        fieldKey: "psi_value_w_mk",
        header: fieldDefByKey.get("psi_value_w_mk")?.display_name ?? "Psi-Value",
        accessor: (row) => customNumberValue(row, "psi_value_w_mk"),
        defaultWidth: 120,
        className: "numeric-cell",
      },
      {
        id: "frsi_value",
        fieldKey: "frsi_value",
        header: fieldDefByKey.get("frsi_value")?.display_name ?? "fRSI Value",
        accessor: (row) => customNumberValue(row, "frsi_value"),
        defaultWidth: 110,
        className: "numeric-cell",
      },
      {
        id: THERMAL_BRIDGE_TYPE_KEY,
        fieldKey: THERMAL_BRIDGE_TYPE_KEY,
        header: fieldDefByKey.get(THERMAL_BRIDGE_TYPE_KEY)?.display_name ?? "Type",
        accessor: (row) => row.thermal_bridge_type,
        defaultWidth: 150,
      },
      attachmentColumn({
        id: THERMAL_BRIDGE_PDF_REPORT_FIELD_KEY,
        fieldKey: THERMAL_BRIDGE_PDF_REPORT_FIELD_KEY,
        header: "PDF Report",
        projectId,
        isEditor,
        assetUrlById: reportUrlById,
        config: PDF_REPORT_ATTACHMENT_CONFIG,
        AttachmentCell,
        getAssetIds: (row) => row.pdf_report_asset_ids,
        getRowId: (row) => row.id,
        onWrite,
        measureLabel: "PDF reports",
      }),
      {
        id: "notes",
        fieldKey: "notes",
        header: fieldDefByKey.get("notes")?.display_name ?? "Notes",
        accessor: (row) => row.notes,
        defaultWidth: DATA_TABLE_COLUMN_WIDTHS.notes,
      },
      statusColumn<ThermalBridgeRow>(fieldDefByKey),
      ...customColumns,
    ],
    [customColumns, fieldDefByKey, isEditor, onWrite, projectId, reportUrlById],
  );

  return (
    <DataTable
      tableName="Thermal Bridges"
      rows={sortedRows}
      columnDefs={columns}
      fieldDefs={fieldDefs}
      getRowId={(row) => row.id}
      emptyMessage={
        isEditor ? "No thermal bridges yet." : "No thermal bridges are published in this version."
      }
      readOnly={!isEditor}
      view={view}
      onViewChange={onViewChange}
      onWrite={onWrite}
      buildEmptyRow={buildEmptyRow}
      generateRowId={generateRowId}
      sessionKey={sessionKey}
      footerAction={footerAction}
      onResetView={onResetView}
      {...customFieldActions}
    />
  );
}
