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
import { sortedAppliances } from "../lib";
import { customNumberValue, customTextValue } from "../lib/customValueReaders";
import {
  APPLIANCE_DATASHEET_FIELD_KEY,
  APPLIANCE_ENERGY_STAR_COLUMN_ID,
  APPLIANCE_ENERGY_STAR_KEY,
  APPLIANCE_TYPE_COLUMN_ID,
  APPLIANCE_TYPE_KEY,
  type ApplianceRow,
  type AppliancesSlice,
} from "../types";

export function AppliancesTable({
  appliancesSlice,
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
  appliancesSlice: AppliancesSlice;
  tableSchema: TableSchema;
  isEditor: boolean;
  projectId: string;
  view: ViewState;
  onViewChange: (next: ViewState) => void;
  onWrite: NonNullable<DataTableProps<ApplianceRow>["onWrite"]>;
  buildEmptyRow?: DataTableProps<ApplianceRow>["buildEmptyRow"];
  generateRowId?: DataTableProps<ApplianceRow>["generateRowId"];
  sessionKey?: DataTableProps<ApplianceRow>["sessionKey"];
  overflowMenuActions?: DataTableProps<ApplianceRow>["overflowMenuActions"];
  footerAction?: DataTableProps<ApplianceRow>["footerAction"];
  onResetView?: DataTableProps<ApplianceRow>["onResetView"];
}) {
  const sortedRows = useMemo(
    () => sortedAppliances(appliancesSlice.appliances),
    [appliancesSlice.appliances],
  );
  const datasheetAssetIds = useMemo(
    () => Array.from(new Set(sortedRows.flatMap((appliance) => appliance.datasheet_asset_ids))),
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
  const columns = useMemo<DataTableColumnDef<ApplianceRow>[]>(
    () => [
      {
        id: RECORD_ID_FIELD_KEY,
        fieldKey: RECORD_ID_FIELD_KEY,
        header: fieldDefByKey.get(RECORD_ID_FIELD_KEY)?.display_name ?? "Tag",
        accessor: (appliance) => customTextValue(appliance, RECORD_ID_FIELD_KEY),
        defaultWidth: 100,
      },
      {
        id: APPLIANCE_TYPE_COLUMN_ID,
        fieldKey: APPLIANCE_TYPE_KEY,
        header: fieldDefByKey.get(APPLIANCE_TYPE_KEY)?.display_name ?? "Type",
        accessor: (appliance) => appliance.appliance_type,
        render: (appliance) =>
          optionPill(appliance.appliance_type, fieldDefByKey.get(APPLIANCE_TYPE_KEY)),
        defaultWidth: 180,
      },
      {
        id: "name",
        fieldKey: "name",
        header: fieldDefByKey.get("name")?.display_name ?? "Name",
        accessor: (appliance) => customTextValue(appliance, "name"),
        defaultWidth: 180,
      },
      {
        id: "quantity",
        fieldKey: "quantity",
        header: fieldDefByKey.get("quantity")?.display_name ?? "Quantity",
        accessor: (appliance) => customNumberValue(appliance, "quantity"),
        defaultWidth: 100,
        className: "numeric-cell",
      },
      {
        id: "model",
        fieldKey: "model",
        header: fieldDefByKey.get("model")?.display_name ?? "Model",
        accessor: (appliance) => customTextValue(appliance, "model"),
        defaultWidth: 140,
      },
      {
        id: "manufacturer",
        fieldKey: "manufacturer",
        header: fieldDefByKey.get("manufacturer")?.display_name ?? "Manufacturer",
        accessor: (appliance) => customTextValue(appliance, "manufacturer"),
        defaultWidth: 160,
      },
      {
        id: APPLIANCE_ENERGY_STAR_COLUMN_ID,
        fieldKey: APPLIANCE_ENERGY_STAR_KEY,
        header: fieldDefByKey.get(APPLIANCE_ENERGY_STAR_KEY)?.display_name ?? "EnergyStar",
        accessor: (appliance) => appliance.energy_star,
        render: (appliance) =>
          optionPill(appliance.energy_star, fieldDefByKey.get(APPLIANCE_ENERGY_STAR_KEY)),
        defaultWidth: 130,
      },
      {
        id: "capacity_m3",
        fieldKey: "capacity_m3",
        header: fieldDefByKey.get("capacity_m3")?.display_name ?? "Capacity",
        accessor: (appliance) => customNumberValue(appliance, "capacity_m3"),
        defaultWidth: 120,
        className: "numeric-cell",
      },
      {
        id: "cef",
        fieldKey: "cef",
        header: fieldDefByKey.get("cef")?.display_name ?? "CEF",
        accessor: (appliance) => customNumberValue(appliance, "cef"),
        defaultWidth: 90,
        className: "numeric-cell",
      },
      {
        id: "imef",
        fieldKey: "imef",
        header: fieldDefByKey.get("imef")?.display_name ?? "IMEF",
        accessor: (appliance) => customNumberValue(appliance, "imef"),
        defaultWidth: 90,
        className: "numeric-cell",
      },
      {
        id: "mef",
        fieldKey: "mef",
        header: fieldDefByKey.get("mef")?.display_name ?? "MEF",
        accessor: (appliance) => customNumberValue(appliance, "mef"),
        defaultWidth: 90,
        className: "numeric-cell",
      },
      {
        id: "annual_energy_kwh",
        fieldKey: "annual_energy_kwh",
        header: fieldDefByKey.get("annual_energy_kwh")?.display_name ?? "Annual Energy",
        accessor: (appliance) => customNumberValue(appliance, "annual_energy_kwh"),
        defaultWidth: 150,
        className: "numeric-cell",
      },
      {
        id: "url",
        fieldKey: "url",
        header: fieldDefByKey.get("url")?.display_name ?? "URL",
        accessor: (appliance) => appliance.url,
        render: (appliance) =>
          appliance.url ? (
            <a
              href={appliance.url}
              target="_blank"
              rel="noopener noreferrer"
              className="data-table-link-cell"
            >
              {shortenUrl(appliance.url)}
            </a>
          ) : null,
        measureText: (appliance) => appliance.url ?? "",
        defaultWidth: 180,
      },
      {
        id: APPLIANCE_DATASHEET_FIELD_KEY,
        fieldKey: APPLIANCE_DATASHEET_FIELD_KEY,
        header: fieldDefByKey.get(APPLIANCE_DATASHEET_FIELD_KEY)?.display_name ?? "Datasheet",
        accessor: (appliance) => appliance.datasheet_asset_ids.join(","),
        render: (appliance) => (
          <AttachmentCell
            projectId={projectId}
            value={appliance.datasheet_asset_ids}
            config={DATASHEET_ATTACHMENT_CONFIG}
            readOnly={!isEditor}
            assetUrlById={datasheetUrlById}
            onChange={(next) => {
              if (sameAttachmentAssetIds(appliance.datasheet_asset_ids, next)) return;
              return onWrite({
                kind: "cell",
                writes: [
                  { rowId: appliance.id, fieldKey: APPLIANCE_DATASHEET_FIELD_KEY, value: next },
                ],
              });
            }}
          />
        ),
        measureText: (appliance) => `${appliance.datasheet_asset_ids.length} attachments`,
        defaultWidth: 260,
      },
      {
        id: "notes",
        fieldKey: "notes",
        header: fieldDefByKey.get("notes")?.display_name ?? "Notes",
        accessor: (appliance) => appliance.notes,
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
      getRowId={(appliance) => appliance.id}
      emptyMessage={
        isEditor ? "No appliances yet." : "No appliances are published in this version."
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
