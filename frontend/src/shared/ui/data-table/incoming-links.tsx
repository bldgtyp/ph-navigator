import { LinkedRecordCell } from "./fields/linkedRecord/LinkedRecordCell";
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
  defaultWidth?: number;
  accessorValue?: "displayText" | "ids";
};

export function incomingLinkColumn<TRow>({
  id,
  fieldKey = id,
  header,
  getIncomingIds,
  resolveLabel,
  onPillClick,
  onActivateEdit,
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
