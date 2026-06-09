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
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { useAssetUrls } from "../../assets/hooks";
import { DATASHEET_ATTACHMENT_CONFIG, sameAttachmentAssetIds } from "../../assets/lib";
import { LinkedRecordCell } from "../../../shared/ui/data-table/fields/linkedRecord/LinkedRecordCell";
import { singleSelectOption } from "../../../shared/ui/data-table/lib";
import { sortedPumps } from "../lib";
import { customNumberValue, customTextValue } from "../lib/customValueReaders";
import {
  PUMP_DATASHEET_FIELD_KEY,
  PUMP_DEVICE_TYPE_COLUMN_ID,
  PUMP_DEVICE_TYPE_KEY,
  type InverseLinkField,
  type PumpRow,
  type PumpsSlice,
} from "../types";

const EMPTY_INVERSE_IDS: readonly string[] = [];

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
  const inverseLinkFields = pumpsSlice.inverse_link_fields;
  const inverseLinks = pumpsSlice.inverse_links;
  const inverseFieldDefs = useMemo<FieldDef[]>(
    () =>
      (inverseLinkFields ?? []).map((field) => ({
        field_key: inverseFieldKey(field),
        field_type: "text",
        display_name: inverseColumnHeader(field),
        read_only: true,
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
  const columns = useMemo<DataTableColumnDef<PumpRow>[]>(() => {
    const baseColumns: DataTableColumnDef<PumpRow>[] = [
      {
        id: RECORD_ID_FIELD_KEY,
        fieldKey: RECORD_ID_FIELD_KEY,
        header: fieldDefByKey.get(RECORD_ID_FIELD_KEY)?.display_name ?? "Tag",
        accessor: (pump) => customTextValue(pump, RECORD_ID_FIELD_KEY),
        defaultWidth: 100,
      },
      {
        id: PUMP_DEVICE_TYPE_COLUMN_ID,
        fieldKey: PUMP_DEVICE_TYPE_KEY,
        header: fieldDefByKey.get(PUMP_DEVICE_TYPE_KEY)?.display_name ?? "Device Type",
        accessor: (pump) => pump.device_type,
        render: (pump) => optionPill(pump.device_type, fieldDefByKey.get(PUMP_DEVICE_TYPE_KEY)),
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
        defaultWidth: 80,
        className: "numeric-cell",
      },
      {
        id: "phase",
        fieldKey: "phase",
        header: fieldDefByKey.get("phase")?.display_name ?? "Phase",
        accessor: (pump) => pump.phase,
        defaultWidth: 80,
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
        header: fieldDefByKey.get("flow_gpm")?.display_name ?? "Flow - GPM",
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
        id: "notes",
        fieldKey: "notes",
        header: fieldDefByKey.get("notes")?.display_name ?? "Notes",
        accessor: (pump) => pump.notes,
        defaultWidth: 280,
      },
      {
        id: "link",
        fieldKey: "link",
        header: fieldDefByKey.get("link")?.display_name ?? "Link",
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
    ];
    const inverseColumns: DataTableColumnDef<PumpRow>[] = (inverseLinkFields ?? []).map(
      (field) => ({
        id: inverseFieldKey(field),
        fieldKey: inverseFieldKey(field),
        header: inverseColumnHeader(field),
        accessor: (pump) => inverseIdsForPump(inverseLinks, pump.id, field).join(", "),
        render: (pump) => (
          <LinkedRecordCell
            ids={inverseIdsForPump(inverseLinks, pump.id, field)}
            resolve={() => ({ recordId: null })}
            onPillClick={(rowId) => onInversePillClick?.(field, rowId)}
          />
        ),
        measureText: (pump) => inverseIdsForPump(inverseLinks, pump.id, field).join(","),
        defaultWidth: 180,
        className: "data-table-inverse-link-cell",
      }),
    );
    return [...baseColumns, ...inverseColumns];
  }, [
    datasheetUrlById,
    fieldDefByKey,
    isEditor,
    onInversePillClick,
    onWrite,
    projectId,
    inverseLinkFields,
    inverseLinks,
  ]);

  return (
    <DataTable
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
    />
  );
}

function inverseFieldKey(field: InverseLinkField): string {
  return `inverse:${field.source_key}`;
}

function inverseColumnHeader(field: InverseLinkField): string {
  return `${field.source_table_display} ← ${field.source_field_display_name}`;
}

function inverseIdsForPump(
  inverseLinks: PumpsSlice["inverse_links"],
  pumpId: string,
  field: InverseLinkField,
): readonly string[] {
  return inverseLinks?.[pumpId]?.[field.source_key] ?? EMPTY_INVERSE_IDS;
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
