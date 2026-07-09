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
import { sortedHotWaterHeaters } from "../lib";
import { customNumberValue, customTextValue } from "../lib/customValueReaders";
import { statusColumn } from "../lib/statusColumn";
import {
  customFieldColumnDefs,
  type CustomFieldTableActions,
} from "../../../shared/ui/data-table/feature";
import {
  HOT_WATER_HEATER_DATASHEET_FIELD_KEY,
  HOT_WATER_HEATER_TYPE_COLUMN_ID,
  HOT_WATER_HEATER_TYPE_KEY,
  type HotWaterHeaterRow,
  type HotWaterHeatersSlice,
} from "../types";

export function HotWaterHeatersTable({
  hotWaterHeatersSlice,
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
  hotWaterHeatersSlice: HotWaterHeatersSlice;
  tableSchema: TableSchema;
  isEditor: boolean;
  projectId: string;
  view: ViewState;
  onViewChange: (next: ViewState) => void;
  onWrite: NonNullable<DataTableProps<HotWaterHeaterRow>["onWrite"]>;
  buildEmptyRow?: DataTableProps<HotWaterHeaterRow>["buildEmptyRow"];
  generateRowId?: DataTableProps<HotWaterHeaterRow>["generateRowId"];
  sessionKey?: DataTableProps<HotWaterHeaterRow>["sessionKey"];
  overflowMenuActions?: DataTableProps<HotWaterHeaterRow>["overflowMenuActions"];
  footerAction?: DataTableProps<HotWaterHeaterRow>["footerAction"];
  onResetView?: DataTableProps<HotWaterHeaterRow>["onResetView"];
} & CustomFieldTableActions<HotWaterHeaterRow>) {
  const sortedRows = useMemo(
    () => sortedHotWaterHeaters(hotWaterHeatersSlice.hot_water_heaters),
    [hotWaterHeatersSlice.hot_water_heaters],
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
  const customColumns = useMemo<DataTableColumnDef<HotWaterHeaterRow>[]>(
    () =>
      customFieldColumnDefs({
        customFields,
        fieldDefByKey,
        rowsComputed: hotWaterHeatersSlice.rows_computed,
      }),
    [customFields, fieldDefByKey, hotWaterHeatersSlice.rows_computed],
  );
  const columns = useMemo<DataTableColumnDef<HotWaterHeaterRow>[]>(
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
        rowsComputed: hotWaterHeatersSlice.rows_computed,
      }),
      {
        id: "quantity",
        fieldKey: "quantity",
        header: fieldDefByKey.get("quantity")?.display_name ?? "Quantity",
        accessor: (heater) => customNumberValue(heater, "quantity"),
        defaultWidth: 100,
        className: "numeric-cell",
      },
      {
        id: HOT_WATER_HEATER_TYPE_COLUMN_ID,
        fieldKey: HOT_WATER_HEATER_TYPE_KEY,
        header: fieldDefByKey.get(HOT_WATER_HEATER_TYPE_KEY)?.display_name ?? "Type",
        accessor: (heater) => heater.heater_type,
        defaultWidth: 170,
      },
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
        id: "size_l",
        fieldKey: "size_l",
        header: fieldDefByKey.get("size_l")?.display_name ?? "Size",
        accessor: (heater) => customNumberValue(heater, "size_l"),
        defaultWidth: 120,
        className: "numeric-cell",
      },
      {
        id: "temperature_c",
        fieldKey: "temperature_c",
        header: fieldDefByKey.get("temperature_c")?.display_name ?? "Temperature",
        accessor: (heater) => customNumberValue(heater, "temperature_c"),
        defaultWidth: 130,
        className: "numeric-cell",
      },
      {
        id: "amps",
        fieldKey: "amps",
        header: fieldDefByKey.get("amps")?.display_name ?? "Amps",
        accessor: (heater) => customNumberValue(heater, "amps"),
        defaultWidth: DATA_TABLE_COLUMN_WIDTHS.smallNumeric,
        className: "numeric-cell",
      },
      {
        id: "volts",
        fieldKey: "volts",
        header: fieldDefByKey.get("volts")?.display_name ?? "Volts",
        accessor: (heater) => customNumberValue(heater, "volts"),
        defaultWidth: DATA_TABLE_COLUMN_WIDTHS.smallNumeric,
        className: "numeric-cell",
      },
      {
        id: "phase",
        fieldKey: "phase",
        header: fieldDefByKey.get("phase")?.display_name ?? "Phase",
        accessor: (heater) => heater.phase,
        defaultWidth: DATA_TABLE_COLUMN_WIDTHS.smallNumeric,
        className: "numeric-cell",
      },
      {
        id: "power_factor",
        fieldKey: "power_factor",
        header: fieldDefByKey.get("power_factor")?.display_name ?? "Power Factor",
        accessor: (heater) => customNumberValue(heater, "power_factor"),
        defaultWidth: 130,
        className: "numeric-cell",
      },
      {
        id: "watts",
        fieldKey: "watts",
        header: fieldDefByKey.get("watts")?.display_name ?? "Watts",
        accessor: (heater) => customNumberValue(heater, "watts"),
        defaultWidth: 100,
        className: "numeric-cell",
      },
      {
        id: "uef",
        fieldKey: "uef",
        header: fieldDefByKey.get("uef")?.display_name ?? "UEF",
        accessor: (heater) => customNumberValue(heater, "uef"),
        defaultWidth: DATA_TABLE_COLUMN_WIDTHS.smallNumeric,
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
        id: HOT_WATER_HEATER_DATASHEET_FIELD_KEY,
        fieldKey: HOT_WATER_HEATER_DATASHEET_FIELD_KEY,
        header:
          fieldDefByKey.get(HOT_WATER_HEATER_DATASHEET_FIELD_KEY)?.display_name ?? "Datasheet",
        projectId,
        isEditor,
        assetUrlById: datasheetUrlById,
        config: DATASHEET_ATTACHMENT_CONFIG,
        AttachmentCell,
        getAssetIds: (heater) => heater.datasheet_asset_ids,
        getRowId: (heater) => heater.id,
        onWrite,
      }),
      statusColumn<HotWaterHeaterRow>(fieldDefByKey),
      ...customColumns,
    ],
    [
      customColumns,
      datasheetUrlById,
      fieldDefByKey,
      isEditor,
      onWrite,
      projectId,
      hotWaterHeatersSlice.rows_computed,
    ],
  );

  return (
    <DataTable
      tableName="Hot Water Heaters"
      rows={sortedRows}
      columnDefs={columns}
      fieldDefs={fieldDefs}
      getRowId={(heater) => heater.id}
      emptyMessage={
        isEditor
          ? "No hot water heaters yet."
          : "No hot water heaters are published in this version."
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
