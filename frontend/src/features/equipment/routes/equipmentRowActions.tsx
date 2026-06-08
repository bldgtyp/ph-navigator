import { generatedId } from "../../../shared/lib/ids";

export function addRowButton(label: string, canEdit: boolean, onAdd: () => void) {
  if (!canEdit) return null;
  return (
    <button
      type="button"
      className="data-table-add-row-button"
      aria-label={label}
      title={label}
      onClick={onAdd}
    >
      +
    </button>
  );
}

export function insertEquipmentRow(
  controller: {
    onWrite: (op: {
      kind: "rowInsert";
      rows: { rowId: string; fieldDefaults: Record<string, unknown>; anchorRowId: null }[];
    }) => unknown;
  },
  prefix: string,
) {
  void controller.onWrite({
    kind: "rowInsert",
    rows: [{ rowId: generatedId(prefix), fieldDefaults: {}, anchorRowId: null }],
  });
}
