import { generatedId } from "../../../shared/lib/ids";

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
