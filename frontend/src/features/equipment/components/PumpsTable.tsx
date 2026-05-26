import { useMemo, type CSSProperties } from "react";
import {
  DataTable,
  type DataTableColumnDef,
  type DataTableProps,
  type FieldDef,
  type TableSchema,
  type ViewState,
} from "../../../shared/ui/data-table";
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { useAssetUrls } from "../../assets/hooks";
import { DATASHEET_ATTACHMENT_CONFIG, sameAttachmentAssetIds } from "../../assets/lib";
import { singleSelectOption } from "../../../shared/ui/data-table/lib";
import { sortedPumps } from "../lib";
import {
  PUMP_DATASHEET_FIELD_KEY,
  PUMP_DEVICE_TYPE_COLUMN_ID,
  PUMP_DEVICE_TYPE_KEY,
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
}) {
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
  const { fieldDefs } = tableSchema;
  const fieldDefByKey = useMemo(
    () => new Map(fieldDefs.map((fieldDef) => [fieldDef.field_key, fieldDef])),
    [fieldDefs],
  );
  const columns = useMemo<DataTableColumnDef<PumpRow>[]>(
    () => [
      {
        id: "tag",
        fieldKey: "tag",
        header: "Tag",
        accessor: (pump) => pump.tag,
        defaultWidth: 100,
      },
      {
        id: PUMP_DEVICE_TYPE_COLUMN_ID,
        fieldKey: PUMP_DEVICE_TYPE_KEY,
        header: "Device Type",
        accessor: (pump) => pump.device_type,
        render: (pump) => optionPill(pump.device_type, fieldDefByKey.get(PUMP_DEVICE_TYPE_KEY)),
        defaultWidth: 150,
      },
      {
        id: "use",
        fieldKey: "use",
        header: "Use",
        accessor: (pump) => pump.use,
        defaultWidth: 180,
      },
      {
        id: "manufacturer",
        fieldKey: "manufacturer",
        header: "Manufacturer",
        accessor: (pump) => pump.manufacturer,
        defaultWidth: 160,
      },
      {
        id: "model",
        fieldKey: "model",
        header: "Model",
        accessor: (pump) => pump.model,
        defaultWidth: 140,
      },
      {
        id: "volts",
        fieldKey: "volts",
        header: "Volts",
        accessor: (pump) => pump.volts,
        defaultWidth: 80,
        className: "numeric-cell",
      },
      {
        id: "phase",
        fieldKey: "phase",
        header: "Phase",
        accessor: (pump) => pump.phase,
        defaultWidth: 80,
        className: "numeric-cell",
      },
      {
        id: "horse_power",
        fieldKey: "horse_power",
        header: "Horse Power",
        accessor: (pump) => pump.horse_power,
        defaultWidth: 120,
        className: "numeric-cell",
      },
      {
        id: "wattage",
        fieldKey: "wattage",
        header: "Wattage",
        accessor: (pump) => pump.wattage,
        defaultWidth: 110,
        className: "numeric-cell",
      },
      {
        id: "flow_gpm",
        fieldKey: "flow_gpm",
        header: "Flow - GPM",
        accessor: (pump) => pump.flow_gpm,
        defaultWidth: 120,
        className: "numeric-cell",
      },
      {
        id: "runtime_khr_yr",
        fieldKey: "runtime_khr_yr",
        header: "Runtime - kHR/YEAR",
        accessor: (pump) => pump.runtime_khr_yr,
        defaultWidth: 160,
        className: "numeric-cell",
      },
      {
        id: "notes",
        fieldKey: "notes",
        header: "Notes",
        accessor: (pump) => pump.notes,
        defaultWidth: 280,
      },
      {
        id: "link",
        fieldKey: "link",
        header: "Link",
        accessor: (pump) => pump.link,
        render: (pump) =>
          pump.link ? (
            <a
              href={pump.link}
              target="_blank"
              rel="noopener noreferrer"
              className="data-table-link-cell"
            >
              {shortenUrl(pump.link)}
            </a>
          ) : null,
        measureText: (pump) => pump.link ?? "",
        defaultWidth: 180,
      },
      {
        id: PUMP_DATASHEET_FIELD_KEY,
        fieldKey: PUMP_DATASHEET_FIELD_KEY,
        header: "Datasheet",
        accessor: (pump) => pump.datasheet_asset_ids.join(","),
        render: (pump) => (
          <AttachmentCell
            projectId={projectId}
            value={pump.datasheet_asset_ids}
            config={DATASHEET_ATTACHMENT_CONFIG}
            readOnly={!isEditor}
            assetUrlById={datasheetUrlById}
            onChange={(next) => {
              if (sameAttachmentAssetIds(pump.datasheet_asset_ids, next)) return;
              return onWrite({
                kind: "cell",
                writes: [
                  {
                    rowId: pump.id,
                    fieldKey: PUMP_DATASHEET_FIELD_KEY,
                    value: next,
                  },
                ],
              });
            }}
          />
        ),
        measureText: (pump) => `${pump.datasheet_asset_ids.length} attachments`,
        defaultWidth: 260,
      },
    ],
    [datasheetUrlById, fieldDefByKey, isEditor, onWrite, projectId],
  );

  return (
    <DataTable
      rows={sortedRows}
      columnDefs={columns}
      fieldDefs={fieldDefs}
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
