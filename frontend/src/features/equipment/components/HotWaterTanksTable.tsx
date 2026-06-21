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
import { sortedHotWaterTanks } from "../lib";
import { customNumberValue, customTextValue } from "../lib/customValueReaders";
import {
  customFieldColumnDefs,
  type CustomFieldTableActions,
} from "../../../shared/ui/data-table/feature";
import {
  HOT_WATER_TANK_DATASHEET_FIELD_KEY,
  HOT_WATER_TANK_INSIDE_OUTSIDE_KEY,
  HOT_WATER_TANK_TYPE_COLUMN_ID,
  HOT_WATER_TANK_TYPE_KEY,
  type HotWaterTankRow,
  type HotWaterTanksSlice,
} from "../types";

export function HotWaterTanksTable({
  hotWaterTanksSlice,
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
  hotWaterTanksSlice: HotWaterTanksSlice;
  tableSchema: TableSchema;
  isEditor: boolean;
  projectId: string;
  view: ViewState;
  onViewChange: (next: ViewState) => void;
  onWrite: NonNullable<DataTableProps<HotWaterTankRow>["onWrite"]>;
  buildEmptyRow?: DataTableProps<HotWaterTankRow>["buildEmptyRow"];
  generateRowId?: DataTableProps<HotWaterTankRow>["generateRowId"];
  sessionKey?: DataTableProps<HotWaterTankRow>["sessionKey"];
  overflowMenuActions?: DataTableProps<HotWaterTankRow>["overflowMenuActions"];
  footerAction?: DataTableProps<HotWaterTankRow>["footerAction"];
  onResetView?: DataTableProps<HotWaterTankRow>["onResetView"];
} & CustomFieldTableActions<HotWaterTankRow>) {
  const sortedRows = useMemo(
    () => sortedHotWaterTanks(hotWaterTanksSlice.hot_water_tanks),
    [hotWaterTanksSlice.hot_water_tanks],
  );
  const datasheetAssetIds = useMemo(
    () => Array.from(new Set(sortedRows.flatMap((tank) => tank.datasheet_asset_ids))),
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
  const customColumns = useMemo<DataTableColumnDef<HotWaterTankRow>[]>(
    () =>
      customFieldColumnDefs({
        customFields,
        fieldDefByKey,
        rowsComputed: hotWaterTanksSlice.rows_computed,
      }),
    [customFields, fieldDefByKey, hotWaterTanksSlice.rows_computed],
  );
  const columns = useMemo<DataTableColumnDef<HotWaterTankRow>[]>(
    () => [
      {
        id: RECORD_ID_FIELD_KEY,
        fieldKey: RECORD_ID_FIELD_KEY,
        header: fieldDefByKey.get(RECORD_ID_FIELD_KEY)?.display_name ?? "Tag",
        accessor: (tank) => customTextValue(tank, RECORD_ID_FIELD_KEY),
        defaultWidth: DATA_TABLE_COLUMN_WIDTHS.recordId,
      },
      identifierColumn({
        fieldDefByKey,
        accessor: (tank) => customTextValue(tank, "name"),
      }),
      {
        id: "quantity",
        fieldKey: "quantity",
        header: fieldDefByKey.get("quantity")?.display_name ?? "Quantity",
        accessor: (tank) => customNumberValue(tank, "quantity"),
        defaultWidth: 100,
        className: "numeric-cell",
      },
      {
        id: HOT_WATER_TANK_TYPE_COLUMN_ID,
        fieldKey: HOT_WATER_TANK_TYPE_KEY,
        header: fieldDefByKey.get(HOT_WATER_TANK_TYPE_KEY)?.display_name ?? "Type",
        accessor: (tank) => tank.tank_type,
        defaultWidth: 170,
      },
      {
        id: HOT_WATER_TANK_INSIDE_OUTSIDE_KEY,
        fieldKey: HOT_WATER_TANK_INSIDE_OUTSIDE_KEY,
        header:
          fieldDefByKey.get(HOT_WATER_TANK_INSIDE_OUTSIDE_KEY)?.display_name ?? "Inside / Outside",
        accessor: (tank) => tank.inside_outside,
        defaultWidth: 150,
      },
      {
        id: "manufacturer",
        fieldKey: "manufacturer",
        header: fieldDefByKey.get("manufacturer")?.display_name ?? "Manufacturer",
        accessor: (tank) => customTextValue(tank, "manufacturer"),
        defaultWidth: 160,
      },
      {
        id: "model",
        fieldKey: "model",
        header: fieldDefByKey.get("model")?.display_name ?? "Model",
        accessor: (tank) => customTextValue(tank, "model"),
        defaultWidth: 160,
      },
      {
        id: "size_l",
        fieldKey: "size_l",
        header: fieldDefByKey.get("size_l")?.display_name ?? "Size",
        accessor: (tank) => customNumberValue(tank, "size_l"),
        defaultWidth: 120,
        className: "numeric-cell",
      },
      {
        id: "heat_loss_rate_w_k",
        fieldKey: "heat_loss_rate_w_k",
        header: fieldDefByKey.get("heat_loss_rate_w_k")?.display_name ?? "Heat Loss Rate",
        accessor: (tank) => customNumberValue(tank, "heat_loss_rate_w_k"),
        defaultWidth: 150,
        className: "numeric-cell",
      },
      attachmentColumn({
        id: HOT_WATER_TANK_DATASHEET_FIELD_KEY,
        fieldKey: HOT_WATER_TANK_DATASHEET_FIELD_KEY,
        header: fieldDefByKey.get(HOT_WATER_TANK_DATASHEET_FIELD_KEY)?.display_name ?? "Datasheet",
        projectId,
        isEditor,
        assetUrlById: datasheetUrlById,
        config: DATASHEET_ATTACHMENT_CONFIG,
        AttachmentCell,
        getAssetIds: (tank) => tank.datasheet_asset_ids,
        getRowId: (tank) => tank.id,
        onWrite,
      }),
      linkColumn({
        id: "url",
        header: fieldDefByKey.get("url")?.display_name ?? "URL",
        getValue: (tank) => tank.url,
      }),
      {
        id: "notes",
        fieldKey: "notes",
        header: fieldDefByKey.get("notes")?.display_name ?? "Notes",
        accessor: (tank) => tank.notes,
        defaultWidth: DATA_TABLE_COLUMN_WIDTHS.notes,
      },
      ...customColumns,
    ],
    [customColumns, datasheetUrlById, fieldDefByKey, isEditor, onWrite, projectId],
  );

  return (
    <DataTable
      tableName="Hot Water Tanks"
      rows={sortedRows}
      columnDefs={columns}
      fieldDefs={fieldDefs}
      getRowId={(tank) => tank.id}
      emptyMessage={
        isEditor ? "No hot water tanks yet." : "No hot water tanks are published in this version."
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
