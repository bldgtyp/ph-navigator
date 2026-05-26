import { useCallback, useMemo } from "react";
import {
  ALL_FIELD_LOCKS,
  DataTable,
  DEFAULT_BUILT_IN_LOCKS,
  emptyViewState,
  type DataTableColumnDef,
  type FieldDef,
  type ViewState,
  type WriteOp,
} from "../../../shared/ui/data-table";
import { AttachmentCell } from "./AttachmentCell";
import { assetDownloadPath, startBulkDownload } from "../api";
import { readAttachmentAssetIds } from "../lib";
import type { AttachmentFieldConfig, AttachmentRow, AttachmentRowsSlice } from "../types";

export function AttachmentRowsTable({
  projectId,
  slice,
  tableName,
  readOnly,
  fieldKey,
  fieldLabel,
  config,
  onReplaceRows,
}: {
  projectId: string;
  slice: AttachmentRowsSlice;
  tableName: string;
  readOnly: boolean;
  fieldKey: string;
  fieldLabel: string;
  config: AttachmentFieldConfig;
  onReplaceRows: (rows: AttachmentRow[]) => Promise<void>;
}) {
  const rows = useMemo(() => (Array.isArray(slice.rows) ? slice.rows : []), [slice.rows]);

  const replaceCell = useCallback(
    async (rowId: string, key: string, value: string[]) => {
      const nextRows = rows.map((row) => (row.id === rowId ? { ...row, [key]: value } : row));
      await onReplaceRows(nextRows);
    },
    [onReplaceRows, rows],
  );

  const fieldDefs = useMemo<FieldDef[]>(
    () => [
      {
        field_key: "name",
        field_type: "text",
        display_name: "Name",
        read_only: true,
        built_in: true,
        locked: DEFAULT_BUILT_IN_LOCKS,
      },
      {
        field_key: fieldKey,
        field_type: "attachment",
        display_name: fieldLabel,
        read_only: readOnly,
        built_in: true,
        locked: ALL_FIELD_LOCKS,
      },
    ],
    [fieldKey, fieldLabel, readOnly],
  );
  const columns = useMemo<DataTableColumnDef<AttachmentRow>[]>(
    () => [
      {
        id: "name",
        fieldKey: "name",
        header: "Name",
        accessor: (row) => row.name ?? row.id,
        defaultWidth: 240,
      },
      {
        id: fieldKey,
        fieldKey,
        header: fieldLabel,
        accessor: (row) => readAttachmentAssetIds(row[fieldKey]).join(","),
        render: (row) => (
          <AttachmentCell
            projectId={projectId}
            value={readAttachmentAssetIds(row[fieldKey])}
            config={config}
            readOnly={readOnly}
            onChange={(next) => replaceCell(row.id, fieldKey, next)}
          />
        ),
        defaultWidth: 260,
      },
    ],
    [config, fieldKey, fieldLabel, projectId, readOnly, replaceCell],
  );

  const onWrite = async (op: WriteOp) => {
    if (readOnly) return;
    if (op.kind !== "cell" && op.kind !== "paste" && op.kind !== "fill") return;
    const nextRows = rows.map((row) => ({ ...row }));
    for (const write of op.writes) {
      const row = nextRows.find((candidate) => candidate.id === write.rowId);
      if (row) row[write.fieldKey] = write.value;
    }
    await onReplaceRows(nextRows);
  };

  const downloadAll = async () => {
    const job = await startBulkDownload({
      projectId,
      tableKey: tableName,
      columnKey: fieldKey,
      kind: config.assetKind,
    });
    if (job.result_asset_id) {
      window.location.href = assetDownloadPath(projectId, job.result_asset_id);
    }
  };

  return (
    <DataTable
      rows={rows}
      getRowId={(row) => row.id}
      fieldDefs={fieldDefs}
      columnDefs={columns}
      view={emptyViewState() as ViewState}
      onViewChange={() => undefined}
      onWrite={readOnly ? undefined : onWrite}
      readOnly={readOnly}
      emptyMessage="No rows are available for this attachment field."
      overflowMenuActions={
        <button type="button" onClick={() => void downloadAll()}>
          Download all
        </button>
      }
    />
  );
}
