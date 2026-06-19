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
import { sortedElectricHeaters } from "../lib";
import { customNumberValue, customTextValue } from "../lib/customValueReaders";
import {
  ELECTRIC_HEATER_DATASHEET_FIELD_KEY,
  type ElectricHeaterRow,
  type ElectricHeatersSlice,
} from "../types";
import {
  customFieldColumnDefs,
  type CustomFieldTableActions,
} from "../../../shared/ui/data-table/feature";

export function ElectricHeatersTable({
  electricHeatersSlice,
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
  electricHeatersSlice: ElectricHeatersSlice;
  tableSchema: TableSchema;
  isEditor: boolean;
  projectId: string;
  view: ViewState;
  onViewChange: (next: ViewState) => void;
  onWrite: NonNullable<DataTableProps<ElectricHeaterRow>["onWrite"]>;
  buildEmptyRow?: DataTableProps<ElectricHeaterRow>["buildEmptyRow"];
  generateRowId?: DataTableProps<ElectricHeaterRow>["generateRowId"];
  sessionKey?: DataTableProps<ElectricHeaterRow>["sessionKey"];
  overflowMenuActions?: DataTableProps<ElectricHeaterRow>["overflowMenuActions"];
  footerAction?: DataTableProps<ElectricHeaterRow>["footerAction"];
  onResetView?: DataTableProps<ElectricHeaterRow>["onResetView"];
} & CustomFieldTableActions<ElectricHeaterRow>) {
  const sortedRows = useMemo(
    () => sortedElectricHeaters(electricHeatersSlice.electric_heaters),
    [electricHeatersSlice.electric_heaters],
  );
  const datasheetAssetIds = useMemo(
    () => Array.from(new Set(sortedRows.flatMap((heater) => heater.datasheet_asset_ids))),
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
  const customColumns = useMemo<DataTableColumnDef<ElectricHeaterRow>[]>(
    () =>
      customFieldColumnDefs({
        customFields,
        fieldDefByKey,
        rowsComputed: electricHeatersSlice.rows_computed,
      }),
    [customFields, fieldDefByKey, electricHeatersSlice.rows_computed],
  );
  const columns = useMemo<DataTableColumnDef<ElectricHeaterRow>[]>(
    () => [
      {
        id: RECORD_ID_FIELD_KEY,
        fieldKey: RECORD_ID_FIELD_KEY,
        header: fieldDefByKey.get(RECORD_ID_FIELD_KEY)?.display_name ?? "Tag",
        accessor: (heater) => customTextValue(heater, RECORD_ID_FIELD_KEY),
        defaultWidth: DATA_TABLE_COLUMN_WIDTHS.recordId,
      },
      identifierColumn({
        fieldDefByKey,
        accessor: (heater) => customTextValue(heater, "name"),
      }),
      {
        id: "model",
        fieldKey: "model",
        header: fieldDefByKey.get("model")?.display_name ?? "Model",
        accessor: (heater) => customTextValue(heater, "model"),
        defaultWidth: 140,
      },
      {
        id: "manufacturer",
        fieldKey: "manufacturer",
        header: fieldDefByKey.get("manufacturer")?.display_name ?? "Manufacturer",
        accessor: (heater) => customTextValue(heater, "manufacturer"),
        defaultWidth: 160,
      },
      {
        id: "watt",
        fieldKey: "watt",
        header: fieldDefByKey.get("watt")?.display_name ?? "Watt",
        accessor: (heater) => customNumberValue(heater, "watt"),
        defaultWidth: 100,
        className: "numeric-cell",
      },
      linkColumn({
        id: "url",
        header: fieldDefByKey.get("url")?.display_name ?? "URL",
        getValue: (heater) => heater.url,
      }),
      {
        id: "notes",
        fieldKey: "notes",
        header: fieldDefByKey.get("notes")?.display_name ?? "Notes",
        accessor: (heater) => heater.notes,
        defaultWidth: DATA_TABLE_COLUMN_WIDTHS.notes,
      },
      attachmentColumn({
        id: ELECTRIC_HEATER_DATASHEET_FIELD_KEY,
        fieldKey: ELECTRIC_HEATER_DATASHEET_FIELD_KEY,
        header: fieldDefByKey.get(ELECTRIC_HEATER_DATASHEET_FIELD_KEY)?.display_name ?? "Datasheet",
        projectId,
        isEditor,
        assetUrlById: datasheetUrlById,
        config: DATASHEET_ATTACHMENT_CONFIG,
        AttachmentCell,
        getAssetIds: (heater) => heater.datasheet_asset_ids,
        getRowId: (heater) => heater.id,
        onWrite,
      }),
      ...customColumns,
    ],
    [customColumns, datasheetUrlById, fieldDefByKey, isEditor, onWrite, projectId],
  );

  return (
    <DataTable
      rows={sortedRows}
      columnDefs={columns}
      fieldDefs={fieldDefs}
      getRowId={(heater) => heater.id}
      emptyMessage={
        isEditor ? "No electric heaters yet." : "No electric heaters are published in this version."
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
