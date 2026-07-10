import { useReplaceVentilatorsSliceMutation } from "../../hooks";
import { ventilatorsSliceFeature } from "../../api";
import { ventilatorsPayloadFromModalRow } from "../../lib/ventilatorModalPayload";
import type { VentilatorRow, VentilatorsSlice } from "../../types";
import { VentilatorRowModal } from "../../components/VentilatorRowModal";
import { useDraftWriteCoordinator } from "../../../project_document/useDraftWriteCoordinator";
import { resolveCachedSliceForWrite } from "../../../project_document/table-slice";

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
  const queryClient = useQueryClient();
  const { coordinator } = useDraftWriteCoordinator(projectId, versionId);
  const replaceVentilator = async (next: VentilatorRow) => {
    if (!ventilatorsSlice || !coordinator) return;
    const handle = coordinator.schedule({
      label: "ventilators:linkedModalSave",
      run: async () => {
        const queryKey = ventilatorsSliceFeature.queryKeys.slice(projectId, versionId, "editor");
        const current = await resolveCachedSliceForWrite(
          queryClient,
          queryKey,
          ventilatorsSlice,
          () => ventilatorsSliceFeature.fetchSlice(projectId, versionId, "editor"),
        );
        const payload = ventilatorsPayloadFromModalRow(current, next);
        return replaceMutation.mutateAsync({ current, payload });
      },
    });
    await handle.accepted;
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
import { useQueryClient } from "@tanstack/react-query";
