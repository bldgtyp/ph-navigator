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
import { sortedHotWaterHeaters } from "../lib";
import { customNumberValue, customTextValue } from "../lib/customValueReaders";
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
        defaultWidth: 100,
      },
      {
        id: "name",
        fieldKey: "name",
        header: fieldDefByKey.get("name")?.display_name ?? "Display Name",
        accessor: (heater) => customTextValue(heater, "name"),
        defaultWidth: 180,
        isIdentifier: true,
      },
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
        render: (heater) =>
          optionPill(heater.heater_type, fieldDefByKey.get(HOT_WATER_HEATER_TYPE_KEY)),
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
        header: fieldDefByKey.get("temperature_c")?.display_name ?? "Temperatur",
        accessor: (heater) => customNumberValue(heater, "temperature_c"),
        defaultWidth: 130,
        className: "numeric-cell",
      },
      {
        id: "amps",
        fieldKey: "amps",
        header: fieldDefByKey.get("amps")?.display_name ?? "Amps",
        accessor: (heater) => customNumberValue(heater, "amps"),
        defaultWidth: 90,
        className: "numeric-cell",
      },
      {
        id: "volts",
        fieldKey: "volts",
        header: fieldDefByKey.get("volts")?.display_name ?? "Volts",
        accessor: (heater) => customNumberValue(heater, "volts"),
        defaultWidth: 90,
        className: "numeric-cell",
      },
      {
        id: "phase",
        fieldKey: "phase",
        header: fieldDefByKey.get("phase")?.display_name ?? "Phase",
        accessor: (heater) => heater.phase,
        defaultWidth: 90,
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
        defaultWidth: 90,
        className: "numeric-cell",
      },
      {
        id: "url",
        fieldKey: "url",
        header: fieldDefByKey.get("url")?.display_name ?? "URL",
        accessor: (heater) => heater.url,
        render: (heater) =>
          heater.url ? (
            <a
              href={heater.url}
              target="_blank"
              rel="noopener noreferrer"
              className="data-table-link-cell"
            >
              {shortenUrl(heater.url)}
            </a>
          ) : null,
        measureText: (heater) => heater.url ?? "",
        defaultWidth: 180,
      },
      {
        id: "notes",
        fieldKey: "notes",
        header: fieldDefByKey.get("notes")?.display_name ?? "Notes",
        accessor: (heater) => heater.notes,
        defaultWidth: 280,
      },
      {
        id: HOT_WATER_HEATER_DATASHEET_FIELD_KEY,
        fieldKey: HOT_WATER_HEATER_DATASHEET_FIELD_KEY,
        header:
          fieldDefByKey.get(HOT_WATER_HEATER_DATASHEET_FIELD_KEY)?.display_name ?? "Datasheet",
        accessor: (heater) => heater.datasheet_asset_ids.join(","),
        render: (heater) => (
          <AttachmentCell
            projectId={projectId}
            value={heater.datasheet_asset_ids}
            config={DATASHEET_ATTACHMENT_CONFIG}
            readOnly={!isEditor}
            assetUrlById={datasheetUrlById}
            onChange={(next) => {
              if (sameAttachmentAssetIds(heater.datasheet_asset_ids, next)) return;
              return onWrite({
                kind: "cell",
                writes: [
                  { rowId: heater.id, fieldKey: HOT_WATER_HEATER_DATASHEET_FIELD_KEY, value: next },
                ],
              });
            }}
          />
        ),
        measureText: (heater) => `${heater.datasheet_asset_ids.length} attachments`,
        defaultWidth: 260,
      },
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
