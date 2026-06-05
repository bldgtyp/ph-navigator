import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { emptyViewState } from "../../../shared/ui/data-table";
import type {
  CellWrite,
  DataTableColumnDef,
  FieldDef,
  ViewState,
  WriteOp,
} from "../../../shared/ui/data-table";
import { useLocalTableViewState } from "../../table_views/useLocalTableViewState";
import { createFrameType, deactivateFrameType, duplicateFrameType, updateFrameType } from "../api";
import { catalogQueryKeys } from "../query-keys";
import type {
  CatalogFrameType,
  CatalogFrameTypeCreatePayload,
  CatalogFrameTypeUpdatePayload,
} from "../types";
import { FRAME_TYPES_BUILT_IN_FIELD_DEFS, FRAME_TYPES_TABLE_KEY } from "./fieldDefs";

export type FrameTypeRow = CatalogFrameType;

const FRAME_BUILT_IN_KEYS = new Set(
  FRAME_TYPES_BUILT_IN_FIELD_DEFS.map((fieldDef) => fieldDef.field_key),
);

export function toFrameTypeRow(record: CatalogFrameType): FrameTypeRow {
  return record;
}

type WriteOptions = {
  invalidate: () => Promise<void>;
};

function groupCellWritesByRow(writes: CellWrite[]): Map<string, Record<string, unknown>> {
  const grouped = new Map<string, Record<string, unknown>>();
  for (const write of writes) {
    if (!FRAME_BUILT_IN_KEYS.has(write.fieldKey)) continue;
    const existing = grouped.get(write.rowId) ?? {};
    existing[write.fieldKey] = write.value;
    grouped.set(write.rowId, existing);
  }
  return grouped;
}

async function applyCellWrites(writes: CellWrite[], opts: WriteOptions): Promise<void> {
  const grouped = groupCellWritesByRow(writes);
  if (grouped.size === 0) return;
  await Promise.all(
    Array.from(grouped.entries()).map(([rowId, body]) =>
      updateFrameType(rowId, body as CatalogFrameTypeUpdatePayload),
    ),
  );
  await opts.invalidate();
}

// Shift-Enter row insert with empty defaults POSTs with a safe name
// placeholder so the user can edit in place rather than block on a modal.
const DEFAULT_NEW_FRAME_NAME = "New frame type";

function buildCreatePayload(fieldDefaults: Record<string, unknown>): CatalogFrameTypeCreatePayload {
  const nameRaw = fieldDefaults.name;
  const name =
    typeof nameRaw === "string" && nameRaw.trim().length > 0
      ? nameRaw.trim()
      : DEFAULT_NEW_FRAME_NAME;
  const extras: Record<string, unknown> = {};
  for (const fieldDef of FRAME_TYPES_BUILT_IN_FIELD_DEFS) {
    if (fieldDef.field_key === "name") continue;
    const value = fieldDefaults[fieldDef.field_key];
    if (value === undefined) continue;
    extras[fieldDef.field_key] = value;
  }
  return { name, ...extras };
}

export type FrameTypesCatalogController = {
  view: ViewState;
  onViewChange: (next: ViewState) => void;
  onResetView: () => void;
  onWrite: (op: WriteOp) => Promise<void>;
};

export type FrameTypesCatalogControllerArgs = {
  userId: string;
  columns: DataTableColumnDef<FrameTypeRow>[];
  fieldDefs: FieldDef[];
  schemaFingerprint: string;
};

export function useFrameTypesCatalogController({
  userId,
  columns,
  fieldDefs,
  schemaFingerprint,
}: FrameTypesCatalogControllerArgs): FrameTypesCatalogController {
  const defaults = useMemo(() => emptyViewState(), []);
  const {
    view,
    onViewChange,
    reset: onResetView,
  } = useLocalTableViewState({
    userId,
    tableKey: FRAME_TYPES_TABLE_KEY,
    defaults,
    enabled: true,
    // `DataTableColumnDef<TRow>` is invariant in TRow; cast to the
    // hook's row-agnostic signature. Sanitize only reads `column.id` /
    // `column.fieldKey`.
    columns: columns as DataTableColumnDef<unknown>[],
    fieldDefs,
    schemaFingerprint,
  });
  const queryClient = useQueryClient();
  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: catalogQueryKeys.frameTypes() }),
    [queryClient],
  );

  const onWrite = useCallback<FrameTypesCatalogController["onWrite"]>(
    async (op) => {
      switch (op.kind) {
        case "cell":
        case "fill":
        case "paste":
          await applyCellWrites(op.writes, { invalidate });
          return;
        case "rowInsert": {
          if (op.rows.length === 0) return;
          await Promise.all(
            op.rows.map((row) => createFrameType(buildCreatePayload(row.fieldDefaults))),
          );
          await invalidate();
          return;
        }
        case "rowDelete": {
          await Promise.all(op.rows.map((row) => deactivateFrameType(row.rowId)));
          await invalidate();
          return;
        }
        case "rowDuplicate": {
          if (op.rows.length === 0) return;
          await Promise.all(op.rows.map((row) => duplicateFrameType(row.sourceRowId)));
          await invalidate();
          return;
        }
        case "schemaMutation":
          throw new Error(
            "Custom fields are not supported on the frame-types catalog (PRD §non-goals).",
          );
      }
    },
    [invalidate],
  );

  return { view, onViewChange, onResetView, onWrite };
}
