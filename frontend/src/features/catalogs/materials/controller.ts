import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { CellWrite, ViewState, WriteOp } from "../../../shared/ui/data-table";
import { createMaterial, deactivateMaterial, updateMaterial } from "../api";
import { catalogQueryKeys } from "../query-keys";
import type {
  CatalogMaterial,
  CatalogMaterialCreatePayload,
  CatalogMaterialUpdatePayload,
} from "../types";
import { MATERIALS_BUILT_IN_FIELD_DEFS, materialCategoryFromOptionId } from "./fieldDefs";

const EMPTY_VIEW: ViewState = {
  filter: [],
  sort: [],
  group: [],
  aggregations: {},
  columnOrder: [],
  columnWidths: {},
  hiddenColumns: [],
  expandedGroups: {},
};

// Row shape used by the grid. `category` holds the single_select option
// id (e.g. `opt_insulation`) so the DataTable cell can render the pill;
// the REST boundary unwraps the option id back to the registry id
// (`insulation`) before sending.
export type MaterialRow = Omit<CatalogMaterial, "category"> & {
  category: string | null;
};

const MATERIAL_BUILT_IN_KEYS = new Set(
  MATERIALS_BUILT_IN_FIELD_DEFS.map((fieldDef) => fieldDef.field_key),
);

export function toMaterialRow(material: CatalogMaterial): MaterialRow {
  return { ...material, category: `opt_${material.category}` };
}

export function fromMaterialRow(row: MaterialRow): CatalogMaterial | null {
  const category = materialCategoryFromOptionId(row.category);
  if (category === null) return null;
  return { ...row, category };
}

type WriteOptions = {
  invalidate: () => Promise<void>;
};

function valueForField(fieldKey: string, value: unknown): unknown {
  if (fieldKey === "category") {
    return materialCategoryFromOptionId(value === null ? null : String(value));
  }
  return value;
}

// Group a flat CellWrite list by rowId and resolve each field's value
// for the catalog PATCH body.
function groupCellWritesByRow(writes: CellWrite[]): Map<string, Record<string, unknown>> {
  const grouped = new Map<string, Record<string, unknown>>();
  for (const write of writes) {
    if (!MATERIAL_BUILT_IN_KEYS.has(write.fieldKey)) continue;
    const existing = grouped.get(write.rowId) ?? {};
    existing[write.fieldKey] = valueForField(write.fieldKey, write.value);
    grouped.set(write.rowId, existing);
  }
  return grouped;
}

async function applyCellWrites(writes: CellWrite[], opts: WriteOptions): Promise<void> {
  const grouped = groupCellWritesByRow(writes);
  if (grouped.size === 0) return;
  await Promise.all(
    Array.from(grouped.entries()).map(([rowId, body]) =>
      updateMaterial(rowId, body as CatalogMaterialUpdatePayload),
    ),
  );
  await opts.invalidate();
}

// Shift-Enter on the grid emits a rowInsert with empty `fieldDefaults`
// — the user fills the cells afterwards. The REST POST needs name +
// category up front, so we substitute safe placeholders the user can
// edit in place. Matches the AirTable-like UX where adding a row gives
// you a row to type into rather than blocking on a modal form.
const DEFAULT_NEW_MATERIAL_NAME = "New material";
const DEFAULT_NEW_MATERIAL_CATEGORY = "insulation";

function buildCreatePayload(fieldDefaults: Record<string, unknown>): CatalogMaterialCreatePayload {
  const nameRaw = fieldDefaults.name;
  const name =
    typeof nameRaw === "string" && nameRaw.trim().length > 0
      ? nameRaw.trim()
      : DEFAULT_NEW_MATERIAL_NAME;
  const categoryRaw = fieldDefaults.category;
  const category =
    materialCategoryFromOptionId(typeof categoryRaw === "string" ? categoryRaw : null) ??
    DEFAULT_NEW_MATERIAL_CATEGORY;
  const extras: Record<string, unknown> = {};
  for (const fieldDef of MATERIALS_BUILT_IN_FIELD_DEFS) {
    if (fieldDef.field_key === "name" || fieldDef.field_key === "category") continue;
    const value = fieldDefaults[fieldDef.field_key];
    if (value === undefined) continue;
    extras[fieldDef.field_key] = valueForField(fieldDef.field_key, value);
  }
  return { name, category, ...extras };
}

export type MaterialsCatalogController = {
  view: ViewState;
  onViewChange: (next: ViewState) => void;
  onResetView: () => void;
  onWrite: (op: WriteOp) => Promise<void>;
};

export function useMaterialsCatalogController(): MaterialsCatalogController {
  const [view, setView] = useState<ViewState>(EMPTY_VIEW);
  const queryClient = useQueryClient();
  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: catalogQueryKeys.materials() }),
    [queryClient],
  );
  const onResetView = useCallback(() => setView(EMPTY_VIEW), []);

  const onWrite = useCallback<MaterialsCatalogController["onWrite"]>(
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
            op.rows.map((row) => createMaterial(buildCreatePayload(row.fieldDefaults))),
          );
          await invalidate();
          return;
        }
        case "rowDelete": {
          await Promise.all(op.rows.map((row) => deactivateMaterial(row.rowId)));
          await invalidate();
          return;
        }
        case "schemaMutation":
          throw new Error(
            "Custom fields are not supported on the materials catalog (PRD §non-goals).",
          );
      }
    },
    [invalidate],
  );

  return { view, onViewChange: setView, onResetView, onWrite };
}
