import {
  ALL_FIELD_LOCKS,
  DataTable,
  type DataTableColumnDef,
  DEFAULT_BUILT_IN_LOCKS,
  type FieldDef,
  type ViewState,
} from "../../../shared/ui/data-table";
import { PUMP_DATASHEET_FIELD_KEY } from "../types";

type PlaceholderEquipmentRow = {
  id: string;
  name: string;
  datasheet_asset_ids: string[];
};

const PLACEHOLDER_FIELD_DEFS: FieldDef[] = [
  {
    field_key: "name",
    field_type: "text",
    display_name: "Name",
    built_in: true,
    locked: DEFAULT_BUILT_IN_LOCKS,
  },
  {
    field_key: PUMP_DATASHEET_FIELD_KEY,
    field_type: "attachment",
    display_name: "Datasheet",
    built_in: true,
    locked: ALL_FIELD_LOCKS,
  },
];

const PLACEHOLDER_COLUMN_DEFS: DataTableColumnDef<PlaceholderEquipmentRow>[] = [
  {
    id: "name",
    fieldKey: "name",
    header: "Name",
    accessor: (row) => row.name,
    defaultWidth: 220,
  },
  {
    id: PUMP_DATASHEET_FIELD_KEY,
    fieldKey: PUMP_DATASHEET_FIELD_KEY,
    header: "Datasheet",
    accessor: (row) => row.datasheet_asset_ids.join(","),
    defaultWidth: 260,
  },
];

export function PlaceholderEquipmentTable({
  emptyMessage,
  view,
  onViewChange,
}: {
  emptyMessage: string;
  view: ViewState;
  onViewChange: (next: ViewState) => void;
}) {
  return (
    <DataTable<PlaceholderEquipmentRow>
      rows={[]}
      getRowId={(row) => row.id}
      fieldDefs={PLACEHOLDER_FIELD_DEFS}
      columnDefs={PLACEHOLDER_COLUMN_DEFS}
      view={view}
      onViewChange={onViewChange}
      readOnly
      emptyMessage={emptyMessage}
    />
  );
}

export function AddEquipmentButton({
  label,
  canEdit,
  onAdd,
}: {
  label: string;
  canEdit: boolean;
  onAdd: () => void;
}) {
  return (
    <button type="button" className="primary-button" disabled={!canEdit} onClick={onAdd}>
      {label}
    </button>
  );
}
