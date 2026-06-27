import { getCustomLink, getCustomValue } from "../lib/customFieldAccessor";
import { ComputedCell } from "../components/ComputedCell";
import type { TableFieldDef } from "../hooks/useTableSchema";
import { isComputedErrorValue } from "../lib/formula";
import type { DataTableColumnDef, DataTableProps, FieldDef } from "../types";
import type { SliceTableController } from "./types";

export type CustomFieldRow = {
  id: string;
  custom_values?: Record<string, unknown> | null | undefined;
  custom_links?: Record<string, string[]> | null | undefined;
};

// Controller-derived DataTable props that every slice table forwards via
// `{...customFieldActions}`: the custom-field edit handlers (present only when
// editable) plus `canDownloadCsv` (the CP-7 export gate, always present).
export type CustomFieldTableActions<TRow> = Pick<
  DataTableProps<TRow>,
  | "onDeleteCustomField"
  | "onAddCustomField"
  | "onDuplicateCustomField"
  | "onEditCustomFieldBundle"
  | "canDownloadCsv"
>;

export function customFieldActionsForController<TSlice>(
  controller: Pick<
    SliceTableController<TSlice>,
    | "canEdit"
    | "isEditor"
    | "handleDeleteCustomField"
    | "handleAddCustomField"
    | "handleDuplicateCustomField"
    | "handleEditCustomFieldBundle"
  >,
) {
  // CSV download is a bulk export → editor/certifier-only (CP-7). Gate on the
  // access principal (`isEditor`), NOT `canEdit`, so an editor browsing a
  // locked version still keeps export. Custom-field edit handlers stay
  // `canEdit`-gated (they mutate). This is the single seam through which every
  // slice table inherits both rules.
  const exportGate = { canDownloadCsv: controller.isEditor };
  if (!controller.canEdit) return exportGate;
  return {
    ...exportGate,
    onDeleteCustomField: controller.handleDeleteCustomField,
    onAddCustomField: controller.handleAddCustomField,
    onDuplicateCustomField: controller.handleDuplicateCustomField,
    onEditCustomFieldBundle: controller.handleEditCustomFieldBundle,
  };
}

export function customFieldColumnDefs<TRow extends CustomFieldRow>({
  customFields,
  fieldDefByKey,
  rowsComputed,
}: {
  customFields: TableFieldDef[];
  fieldDefByKey: ReadonlyMap<string, FieldDef>;
  rowsComputed?: Record<string, Record<string, unknown>>;
}): DataTableColumnDef<TRow>[] {
  return customFields.map((custom) => {
    const fieldDef = fieldDefByKey.get(custom.field_key);
    if (custom.field_type === "formula") {
      return computedFieldColumnDef({
        fieldKey: custom.field_key,
        header: custom.display_name,
        computedType: fieldDef?.computed_type ?? "text",
        rowsComputed,
      });
    }
    if (custom.field_type === "linked_record") {
      return {
        id: custom.field_key,
        fieldKey: custom.field_key,
        header: custom.display_name,
        accessor: (row) => getCustomLink(row, custom.field_key),
      };
    }
    return {
      id: custom.field_key,
      fieldKey: custom.field_key,
      header: custom.display_name,
      accessor: (row) => (fieldDef ? (getCustomValue(row, fieldDef) ?? null) : null),
    };
  });
}

function readComputedRaw(
  overlay: Record<string, Record<string, unknown>> | undefined,
  rowId: string,
  fieldId: string,
): unknown {
  return overlay?.[rowId]?.[fieldId] ?? null;
}

function readComputedScalar(
  overlay: Record<string, Record<string, unknown>> | undefined,
  rowId: string,
  fieldId: string,
): unknown {
  const raw = readComputedRaw(overlay, rowId, fieldId);
  return isComputedErrorValue(raw) ? null : raw;
}

export function computedFieldColumnDef<TRow extends CustomFieldRow>({
  fieldKey,
  header,
  computedType,
  rowsComputed,
  defaultWidth,
  isIdentifier,
}: {
  fieldKey: string;
  header: string;
  computedType: "text" | "number";
  rowsComputed: Record<string, Record<string, unknown>> | undefined;
  defaultWidth?: number;
  // Set on the one computed column that is the table's Display Name
  // identifier — Rooms' {Number} — {Name} formula. See DataTableColumnDef.
  isIdentifier?: boolean;
}): DataTableColumnDef<TRow> {
  return {
    id: fieldKey,
    fieldKey,
    header,
    accessor: (row) => readComputedScalar(rowsComputed, row.id, fieldKey),
    render: (row) => (
      <ComputedCell
        value={readComputedRaw(rowsComputed, row.id, fieldKey)}
        computedType={computedType}
      />
    ),
    measureText: (row) => String(readComputedScalar(rowsComputed, row.id, fieldKey) ?? ""),
    ...(defaultWidth !== undefined ? { defaultWidth } : {}),
    ...(isIdentifier ? { isIdentifier: true } : {}),
  };
}
