import { generatedId } from "../../../shared/lib/ids";
import { AddEquipmentButton } from "../components/EquipmentPlaceholders";

export function addRowButton(label: string, canEdit: boolean, onAdd: () => void) {
  return <AddEquipmentButton label={label} canEdit={canEdit} onAdd={onAdd} />;
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
