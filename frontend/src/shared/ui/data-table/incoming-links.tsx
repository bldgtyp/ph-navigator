import { LinkedRecordCell } from "./fields/linkedRecord/LinkedRecordCell";
import {
  LinkedRecordPicker,
  type LinkedRecordPickerCandidate,
  type LinkedRecordPickerMode,
} from "./fields/linkedRecord/Picker";
import { ALL_FIELD_LOCKS } from "./lib/locks";
import type { CellWrite, DataTableColumnDef, FieldDef } from "./types";

export type IncomingLinkFieldDefArgs = {
  fieldKey: string;
  displayName: string;
  targetTablePath: readonly string[];
};

// Incoming/inverse-link columns are system-provided reverse-link
// projections, not user-authorable fields. `built_in` gives their
// header the same locked-schema border as other built-ins, and the
// full lock set keeps the header menu from offering edit / delete /
// duplicate. They stay out of the formula registry via
// `isFormulaReferenceableField` (which excludes read-only linked-record
// projections despite `built_in`).
export function incomingLinkFieldDef({
  fieldKey,
  displayName,
  targetTablePath,
}: IncomingLinkFieldDefArgs): FieldDef {
  return {
    field_key: fieldKey,
    field_type: "linked_record",
    display_name: displayName,
    read_only: true,
    built_in: true,
    locked: [...ALL_FIELD_LOCKS],
    linked_record_config: {
      target_table_path: [...targetTablePath],
      max_links: null,
    },
  };
}

export type IncomingLinkColumnArgs<TRow> = {
  id: string;
  fieldKey?: string;
  header: string;
  getIncomingIds: (row: TRow) => readonly string[];
  resolveLabel: (rowId: string) => string | null;
  onPillClick?: (rowId: string) => void;
  edit: IncomingLinkColumnEdit<TRow> | null;
  className?: string;
  defaultWidth?: number;
  accessorValue?: "displayText" | "ids";
};

export type IncomingLinkColumnEdit<TRow> = {
  onActivate: (row: TRow) => void;
};

export type IncomingLinkSourceRow = {
  id: string;
  custom_links?: Record<string, string[]>;
};

export type IncomingLinkSelectionWriteArgs<TRow extends IncomingLinkSourceRow> = {
  sourceRows: readonly TRow[];
  sourceFieldKey: string;
  targetRowId: string;
  selectedSourceRowIds: readonly string[];
  maxLinks: number | null;
};

export type IncomingLinkPickerState<TRow> = {
  row: TRow;
  selectedIds: readonly string[];
  candidates: readonly LinkedRecordPickerCandidate[];
  title: string;
  mode?: LinkedRecordPickerMode;
  isLoading?: boolean;
};

export type IncomingLinkPickerProps<TRow> = {
  state: IncomingLinkPickerState<TRow> | null;
  onCancel: () => void;
  onConfirm: (row: TRow, ids: readonly string[]) => void | Promise<void>;
};

export function incomingLinkColumn<TRow>({
  id,
  fieldKey = id,
  header,
  getIncomingIds,
  resolveLabel,
  onPillClick,
  edit,
  className,
  defaultWidth = 180,
  accessorValue = "displayText",
}: IncomingLinkColumnArgs<TRow>): DataTableColumnDef<TRow> {
  const labelFor = (rowId: string) => resolveLabel(rowId) ?? rowId;
  const displayText = (row: TRow) => getIncomingIds(row).map(labelFor).join(", ");
  const onActivateEdit = edit?.onActivate;
  return {
    id,
    fieldKey,
    header,
    accessor: (row) => (accessorValue === "ids" ? getIncomingIds(row) : displayText(row)),
    onActivateEdit,
    className,
    linkedRecordCell: {
      getIds: getIncomingIds,
      resolve: (rowId) => ({ recordId: resolveLabel(rowId) }),
      onPillClick: onPillClick ? (rowId) => onPillClick(rowId) : undefined,
      onActivateEdit,
    },
    render: (row, { isActive }) => (
      <LinkedRecordCell
        ids={getIncomingIds(row)}
        resolve={(rowId) => ({ recordId: resolveLabel(rowId) })}
        onPillClick={onPillClick}
        onActivateEdit={onActivateEdit ? () => onActivateEdit(row) : undefined}
        isActive={isActive}
      />
    ),
    measureText: displayText,
    defaultWidth,
  };
}

export function IncomingLinkPicker<TRow>({
  state,
  onCancel,
  onConfirm,
}: IncomingLinkPickerProps<TRow>) {
  if (!state) return null;
  return (
    <LinkedRecordPicker
      open
      mode={state.mode ?? "multi"}
      selectedIds={state.selectedIds}
      candidates={state.candidates}
      title={state.title}
      isLoading={state.isLoading}
      onCancel={onCancel}
      onConfirm={(ids) => void onConfirm(state.row, ids)}
    />
  );
}

export function incomingIdsForSourceKey(
  inverseLinks: Record<string, Record<string, string[]>> | undefined,
  targetRowId: string,
  sourceKey: string,
): readonly string[] {
  return inverseLinks?.[targetRowId]?.[sourceKey] ?? [];
}

export function linkedRecordMaxLinksFromFieldDefs(
  fieldDefs: readonly { field_key: string; config?: Record<string, unknown> }[],
  fieldKey: string,
): number | null {
  const maxLinks = fieldDefs.find((field) => field.field_key === fieldKey)?.config?.max_links;
  return typeof maxLinks === "number" ? maxLinks : null;
}

export function incomingLinkSelectionWrites<TRow extends IncomingLinkSourceRow>({
  sourceRows,
  sourceFieldKey,
  targetRowId,
  selectedSourceRowIds,
  maxLinks,
}: IncomingLinkSelectionWriteArgs<TRow>): CellWrite[] {
  const selected = new Set(selectedSourceRowIds);
  return sourceRows.flatMap((sourceRow) => {
    const currentIds = sourceRow.custom_links?.[sourceFieldKey] ?? [];
    const nextIds = nextLinkedIds(currentIds, targetRowId, selected.has(sourceRow.id), maxLinks);
    return sameStringList(currentIds, nextIds)
      ? []
      : [{ rowId: sourceRow.id, fieldKey: sourceFieldKey, value: nextIds }];
  });
}

function nextLinkedIds(
  currentIds: readonly string[],
  targetId: string,
  shouldLink: boolean,
  maxLinks: number | null,
): string[] {
  if (shouldLink) {
    if (currentIds.includes(targetId)) return [...currentIds];
    if (maxLinks === 1) return [targetId];
    return [...currentIds, targetId];
  }
  return currentIds.filter((id) => id !== targetId);
}

function sameStringList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
