import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { emptyViewState } from "../../../shared/ui/data-table";
import type {
  CellWrite,
  DataTableColumnDef,
  EditCustomFieldBundleRequest,
  FieldDef,
  FieldOption,
  ViewState,
  WriteOp,
  WriteResult,
} from "../../../shared/ui/data-table";
import { useLocalTableViewState } from "../../table_views/useLocalTableViewState";
import {
  createFrameType,
  deactivateFrameType,
  duplicateFrameType,
  putFrameTypeOptions,
  updateFrameType,
} from "../api";
import { toInsertedRowIds } from "../lib";
import {
  buildCatalogLabelReplacements,
  buildCatalogOptionMutation,
  type CatalogLegacyOptionsMutation,
} from "../legacy-options";
import { catalogQueryKeys } from "../query-keys";
import type {
  CatalogFrameType,
  CatalogFrameTypeCreatePayload,
  CatalogFrameTypeUpdatePayload,
} from "../types";
import {
  FRAME_TYPES_BUILT_IN_FIELD_DEFS,
  FRAME_TYPES_SINGLE_SELECT_FIELDS,
  FRAME_TYPES_TABLE_KEY,
} from "./fieldDefs";

// The grid cell value for a single-select field is the option **id**; the
// backend stores the **label** (D-2). The controller maps id↔label at the REST
// boundary using the fetched option lists.
export type FrameTypeRow = CatalogFrameType;

const SINGLE_SELECT_FIELDS = new Set<string>(FRAME_TYPES_SINGLE_SELECT_FIELDS);

const FRAME_BUILT_IN_KEYS = new Set(
  FRAME_TYPES_BUILT_IN_FIELD_DEFS.map((fieldDef) => fieldDef.field_key),
);

export type FrameTypeOptionMaps = {
  // field_key → (option id → label) and the inverse.
  idToLabel: Record<string, Record<string, string>>;
  labelToId: Record<string, Record<string, string>>;
};

export function buildFrameTypeOptionMaps(
  optionsByField: Record<string, FieldOption[]>,
): FrameTypeOptionMaps {
  const idToLabel: Record<string, Record<string, string>> = {};
  const labelToId: Record<string, Record<string, string>> = {};
  for (const field of FRAME_TYPES_SINGLE_SELECT_FIELDS) {
    const options = optionsByField[field] ?? [];
    idToLabel[field] = {};
    labelToId[field] = {};
    for (const option of options) {
      idToLabel[field][option.id] = option.label;
      labelToId[field][option.label] = option.id;
    }
  }
  return { idToLabel, labelToId };
}

// Backend record (six fields hold labels) → grid row (six fields hold option
// ids) so the single-select cells render their pills.
export function toFrameTypeRow(record: CatalogFrameType, maps: FrameTypeOptionMaps): FrameTypeRow {
  const next: FrameTypeRow = { ...record };
  for (const field of FRAME_TYPES_SINGLE_SELECT_FIELDS) {
    const label = record[field];
    if (typeof label === "string" && label.length > 0) {
      // Fall back to the raw label if it has no option (shouldn't happen once
      // values are validated) so data is never silently dropped.
      next[field] = maps.labelToId[field]?.[label] ?? label;
    }
  }
  return next;
}

type WriteOptions = {
  invalidate: () => Promise<void>;
};

// Resolve a cell value for the catalog PATCH body. Single-selects map their
// option id → label; `name` is derived (server-owned) so it is dropped.
function valueForField(
  fieldKey: string,
  value: unknown,
  idToLabel: Record<string, Record<string, string>>,
): { include: boolean; value: unknown } {
  if (fieldKey === "name") return { include: false, value: undefined };
  if (SINGLE_SELECT_FIELDS.has(fieldKey)) {
    if (value === null || value === undefined) return { include: true, value: null };
    return { include: true, value: idToLabel[fieldKey]?.[String(value)] ?? null };
  }
  return { include: true, value };
}

function groupCellWritesByRow(
  writes: CellWrite[],
  idToLabel: Record<string, Record<string, string>>,
): Map<string, Record<string, unknown>> {
  const grouped = new Map<string, Record<string, unknown>>();
  for (const write of writes) {
    if (!FRAME_BUILT_IN_KEYS.has(write.fieldKey)) continue;
    const resolved = valueForField(write.fieldKey, write.value, idToLabel);
    if (!resolved.include) continue;
    const existing = grouped.get(write.rowId) ?? {};
    existing[write.fieldKey] = resolved.value;
    grouped.set(write.rowId, existing);
  }
  return grouped;
}

// An inline "+ Add option" cell op carries the newly-minted option in
// `newOptions`. Persist it to the option store **before** the row write so the
// label is a known option by the time the PATCH lands (Phase 2 contract).
async function persistNewOptions(
  newOptions: Record<string, FieldOption[]> | undefined,
  optionsByField: Record<string, FieldOption[]>,
): Promise<void> {
  if (!newOptions) return;
  for (const [fieldKey, created] of Object.entries(newOptions)) {
    if (!SINGLE_SELECT_FIELDS.has(fieldKey) || created.length === 0) continue;
    const current = optionsByField[fieldKey] ?? [];
    await putFrameTypeOptions({
      field_key: fieldKey,
      options: [...current, ...created],
    });
  }
}

// id→label that also resolves freshly-created options (not yet in the fetched
// map) from the op's `newOptions`.
function idToLabelWithNew(
  idToLabel: Record<string, Record<string, string>>,
  newOptions: Record<string, FieldOption[]> | undefined,
): Record<string, Record<string, string>> {
  if (!newOptions) return idToLabel;
  const merged: Record<string, Record<string, string>> = { ...idToLabel };
  for (const [fieldKey, created] of Object.entries(newOptions)) {
    merged[fieldKey] = { ...(merged[fieldKey] ?? {}) };
    for (const option of created) merged[fieldKey][option.id] = option.label;
  }
  return merged;
}

async function applyCellWrites(
  op: Extract<WriteOp, { kind: "cell" | "fill" | "paste" }>,
  optionsByField: Record<string, FieldOption[]>,
  maps: FrameTypeOptionMaps,
  opts: WriteOptions,
): Promise<void> {
  const newOptions = "newOptions" in op ? op.newOptions : undefined;
  await persistNewOptions(newOptions, optionsByField);
  const idToLabel = idToLabelWithNew(maps.idToLabel, newOptions);
  const grouped = groupCellWritesByRow(op.writes, idToLabel);
  if (grouped.size === 0) {
    if (newOptions) await opts.invalidate();
    return;
  }
  await Promise.all(
    Array.from(grouped.entries()).map(([rowId, body]) =>
      updateFrameType(rowId, body as CatalogFrameTypeUpdatePayload),
    ),
  );
  await opts.invalidate();
}

// Shift-Enter row insert: `name` is server-derived (empty until parts are
// filled), so the create payload omits it; single-select defaults map id→label.
function buildCreatePayload(
  fieldDefaults: Record<string, unknown>,
  idToLabel: Record<string, Record<string, string>>,
): CatalogFrameTypeCreatePayload {
  const payload: Record<string, unknown> = {};
  for (const fieldDef of FRAME_TYPES_BUILT_IN_FIELD_DEFS) {
    if (fieldDef.field_key === "name") continue;
    const value = fieldDefaults[fieldDef.field_key];
    if (value === undefined) continue;
    const resolved = valueForField(fieldDef.field_key, value, idToLabel);
    if (resolved.include) payload[fieldDef.field_key] = resolved.value;
  }
  return payload as CatalogFrameTypeCreatePayload;
}

// Derive the backend label-keyed `replacements` from a field-config option edit.
// Only an option deleted from the list while still in use needs one: the
// DataTable cascades its rows to a single target (or null to clear), so map each
// deleted option's label → the cascade target's label. Renames / reorders /
// adds / unused-deletes carry no cascade and reconcile from the option list
// alone (the backend matches by id).
async function editFrameTypeOptions(
  mutation: CatalogLegacyOptionsMutation,
  opts: WriteOptions,
): Promise<void> {
  await putFrameTypeOptions({
    field_key: mutation.after.field_key,
    options: (mutation.after.options ?? []).map((o) => ({
      id: o.id,
      label: o.label,
      color: o.color,
      order: o.order,
    })),
    replacements: buildCatalogLabelReplacements(mutation),
  });
  await opts.invalidate();
}

export type FrameTypesCatalogController = {
  view: ViewState;
  onViewChange: (next: ViewState) => void;
  onResetView: () => void;
  onWrite: (op: WriteOp) => Promise<WriteResult>;
  onEditCustomFieldBundle: (request: EditCustomFieldBundleRequest) => Promise<void>;
};

export type FrameTypesCatalogControllerArgs = {
  userId: string;
  columns: DataTableColumnDef<FrameTypeRow>[];
  fieldDefs: FieldDef[];
  schemaFingerprint: string;
  optionsByField: Record<string, FieldOption[]>;
};

export function useFrameTypesCatalogController({
  userId,
  columns,
  fieldDefs,
  schemaFingerprint,
  optionsByField,
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
    columns: columns as DataTableColumnDef<unknown>[],
    fieldDefs,
    schemaFingerprint,
  });
  const queryClient = useQueryClient();
  const maps = useMemo(() => buildFrameTypeOptionMaps(optionsByField), [optionsByField]);
  const invalidate = useCallback(async () => {
    // Cell/option writes can change both the rows and the option store.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: catalogQueryKeys.frameTypes() }),
      queryClient.invalidateQueries({ queryKey: catalogQueryKeys.frameTypeOptions() }),
    ]);
  }, [queryClient]);

  const onWrite = useCallback<FrameTypesCatalogController["onWrite"]>(
    async (op) => {
      switch (op.kind) {
        case "cell":
        case "fill":
        case "paste":
          await applyCellWrites(op, optionsByField, maps, { invalidate });
          return;
        case "rowInsert": {
          if (op.rows.length === 0) return;
          const created = await Promise.all(
            op.rows.map((row) =>
              createFrameType(buildCreatePayload(row.fieldDefaults, maps.idToLabel)),
            ),
          );
          await invalidate();
          return toInsertedRowIds(op.rows, created);
        }
        case "rowDelete": {
          await Promise.all(op.rows.map((row) => deactivateFrameType(row.rowId)));
          await invalidate();
          return;
        }
        case "rowDuplicate": {
          if (op.rows.length === 0) return;
          const created = await Promise.all(
            op.rows.map((row) => duplicateFrameType(row.sourceRowId)),
          );
          await invalidate();
          return toInsertedRowIds(op.rows, created);
        }
        case "schemaMutation": {
          // The only schema change frame-types supports is option editing
          // (add/rename/reorder/merge) via the field-config modal — routed to
          // the catalog option store. Custom fields are a non-goal.
          if (op.variant !== "legacyOptions") {
            throw new Error("Custom fields are not supported on the frame-types catalog.");
          }
          if (!SINGLE_SELECT_FIELDS.has(op.after.field_key)) {
            throw new Error(`Cannot edit options for ${op.after.field_key}.`);
          }
          await editFrameTypeOptions(op, { invalidate });
          return;
        }
      }
    },
    [invalidate, maps, optionsByField],
  );

  const onEditCustomFieldBundle = useCallback(
    async (request: EditCustomFieldBundleRequest) => {
      await onWrite(buildCatalogOptionMutation(request, fieldDefs, SINGLE_SELECT_FIELDS));
    },
    [fieldDefs, onWrite],
  );

  return { view, onViewChange, onResetView, onWrite, onEditCustomFieldBundle };
}
