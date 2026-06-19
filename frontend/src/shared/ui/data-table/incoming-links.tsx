import { LinkedRecordCell } from "./fields/linkedRecord/LinkedRecordCell";
import {
  LinkedRecordPicker,
  type LinkedRecordPickerCandidate,
  type LinkedRecordPickerMode,
} from "./fields/linkedRecord/Picker";
import type { DataTableColumnDef, FieldDef } from "./types";

export type IncomingLinkFieldDefArgs = {
  fieldKey: string;
  displayName: string;
  targetTablePath: readonly string[];
};

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
  onActivateEdit?: (row: TRow) => void;
  className?: string;
  defaultWidth?: number;
  accessorValue?: "displayText" | "ids";
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
  onActivateEdit,
  className,
  defaultWidth = 180,
  accessorValue = "displayText",
}: IncomingLinkColumnArgs<TRow>): DataTableColumnDef<TRow> {
  const labelFor = (rowId: string) => resolveLabel(rowId) ?? rowId;
  const displayText = (row: TRow) => getIncomingIds(row).map(labelFor).join(", ");
  return {
    id,
    fieldKey,
    header,
    accessor: (row) => (accessorValue === "ids" ? getIncomingIds(row) : displayText(row)),
    onActivateEdit,
    className,
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
