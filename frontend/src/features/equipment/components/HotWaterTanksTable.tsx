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
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { useAssetUrls } from "../../assets/hooks";
import { DATASHEET_ATTACHMENT_CONFIG, sameAttachmentAssetIds } from "../../assets/lib";
import { sortedHotWaterTanks } from "../lib";
import { customNumberValue, customTextValue } from "../lib/customValueReaders";
import {
  HOT_WATER_TANK_DATASHEET_FIELD_KEY,
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
}) {
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
  const { fieldDefs } = tableSchema;
  const fieldDefByKey = useMemo(
    () => new Map(fieldDefs.map((fieldDef) => [fieldDef.field_key, fieldDef])),
    [fieldDefs],
  );
  const columns = useMemo<DataTableColumnDef<HotWaterTankRow>[]>(
    () => [
      {
        id: RECORD_ID_FIELD_KEY,
        fieldKey: RECORD_ID_FIELD_KEY,
        header: fieldDefByKey.get(RECORD_ID_FIELD_KEY)?.display_name ?? "Tag",
        accessor: (tank) => customTextValue(tank, RECORD_ID_FIELD_KEY),
        defaultWidth: 100,
      },
      {
        id: "name",
        fieldKey: "name",
        header: fieldDefByKey.get("name")?.display_name ?? "Name",
        accessor: (tank) => customTextValue(tank, "name"),
        defaultWidth: 180,
      },
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
        render: (tank) => optionPill(tank.tank_type, fieldDefByKey.get(HOT_WATER_TANK_TYPE_KEY)),
        defaultWidth: 170,
      },
      {
        id: "inside_outside",
        fieldKey: "inside_outside",
        header: fieldDefByKey.get("inside_outside")?.display_name ?? "Inside / Outside",
        accessor: (tank) => customTextValue(tank, "inside_outside"),
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
      {
        id: HOT_WATER_TANK_DATASHEET_FIELD_KEY,
        fieldKey: HOT_WATER_TANK_DATASHEET_FIELD_KEY,
        header: fieldDefByKey.get(HOT_WATER_TANK_DATASHEET_FIELD_KEY)?.display_name ?? "Datasheet",
        accessor: (tank) => tank.datasheet_asset_ids.join(","),
        render: (tank) => (
          <AttachmentCell
            projectId={projectId}
            value={tank.datasheet_asset_ids}
            config={DATASHEET_ATTACHMENT_CONFIG}
            readOnly={!isEditor}
            assetUrlById={datasheetUrlById}
            onChange={(next) => {
              if (sameAttachmentAssetIds(tank.datasheet_asset_ids, next)) return;
              return onWrite({
                kind: "cell",
                writes: [
                  { rowId: tank.id, fieldKey: HOT_WATER_TANK_DATASHEET_FIELD_KEY, value: next },
                ],
              });
            }}
          />
        ),
        measureText: (tank) => `${tank.datasheet_asset_ids.length} attachments`,
        defaultWidth: 260,
      },
      {
        id: "url",
        fieldKey: "url",
        header: fieldDefByKey.get("url")?.display_name ?? "URL",
        accessor: (tank) => tank.url,
        render: (tank) =>
          tank.url ? (
            <a
              href={tank.url}
              target="_blank"
              rel="noopener noreferrer"
              className="data-table-link-cell"
            >
              {shortenUrl(tank.url)}
            </a>
          ) : null,
        measureText: (tank) => tank.url ?? "",
        defaultWidth: 180,
      },
      {
        id: "notes",
        fieldKey: "notes",
        header: fieldDefByKey.get("notes")?.display_name ?? "Notes",
        accessor: (tank) => tank.notes,
        defaultWidth: 280,
      },
    ],
    [datasheetUrlById, fieldDefByKey, isEditor, onWrite, projectId],
  );

  return (
    <DataTable
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
