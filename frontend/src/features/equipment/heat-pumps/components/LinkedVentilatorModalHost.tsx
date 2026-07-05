import { useReplaceVentilatorsSliceMutation } from "../../hooks";
import { ventilatorsPayloadFromModalRow } from "../../lib/ventilatorModalPayload";
import type { VentilatorRow, VentilatorsSlice } from "../../types";
import { VentilatorRowModal } from "../../components/VentilatorRowModal";

const EMPTY_VENTILATOR_OPTIONS: VentilatorsSlice["single_select_options"] = {
  "ventilators.frost_protection": [],
  "ventilators.inside_outside": [],
  "ventilators.status": [],
};

export function LinkedVentilatorModalHost({
  projectId,
  versionId,
  ventilatorsSlice,
  row,
  readOnly,
  onClose,
}: {
  projectId: string;
  versionId: string;
  ventilatorsSlice: VentilatorsSlice | null;
  row: VentilatorRow;
  readOnly: boolean;
  onClose: () => void;
}) {
  const replaceMutation = useReplaceVentilatorsSliceMutation(projectId, versionId);
  const replaceVentilator = async (next: VentilatorRow) => {
    if (!ventilatorsSlice) return;
    const payload = ventilatorsPayloadFromModalRow(ventilatorsSlice, next);
    await replaceMutation.mutateAsync({ current: ventilatorsSlice, payload });
    onClose();
  };

  return (
    <VentilatorRowModal
      row={row}
      options={ventilatorsSlice?.single_select_options ?? EMPTY_VENTILATOR_OPTIONS}
      readOnly={readOnly}
      onCancel={onClose}
      onSubmit={replaceVentilator}
    />
  );
}
