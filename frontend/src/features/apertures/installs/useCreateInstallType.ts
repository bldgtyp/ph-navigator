// Create-one-install-type write path, shared by the Installs modal's
// inline form (and any future quick-create surface). Reuses the
// phase-03 payload builders + replace mutation so validation never
// forks from the table page, and refreshes the apertures slice so the
// `InstallTypesProvider` summaries pick the new row up (sibling-slice
// invalidation is registered with `refetchType: "none"`, so an explicit
// refetch is required).
import { useQueryClient } from "@tanstack/react-query";
import { apertureQueryKeys } from "../query-keys";
import type { ProjectDetail } from "../../projects/types";
import { useInstallTypesSliceQuery, useReplaceInstallTypesSliceMutation } from "./api";
import {
  installTypesPayloadFromRowInsert,
  makeBuildEmptyInstallTypeRow,
  validateInstallTypesPayload,
} from "./payloads";
import { INSTALL_TYPE_ID_PREFIX } from "./constants";
import { generatedId } from "../../../shared/lib/ids";

const buildEmptyRow = makeBuildEmptyInstallTypeRow();

export function useCreateInstallType(project: ProjectDetail): {
  ready: boolean;
  isPending: boolean;
  create: (name: string, psiWmk: number | null) => Promise<string | null>;
} {
  const queryClient = useQueryClient();
  const sliceQuery = useInstallTypesSliceQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
  );
  const replaceMutation = useReplaceInstallTypesSliceMutation(
    project.id,
    project.active_version_id,
  );

  const create = async (name: string, psiWmk: number | null): Promise<string | null> => {
    const slice = sliceQuery.data;
    if (!slice) return "Install types are still loading.";
    const payload = installTypesPayloadFromRowInsert(
      slice,
      [
        {
          rowId: generatedId(INSTALL_TYPE_ID_PREFIX),
          anchorRowId: null,
          fieldDefaults: { name, psi_w_mk: psiWmk },
        },
      ],
      buildEmptyRow,
    );
    const invalid = validateInstallTypesPayload(payload);
    if (invalid) return invalid;
    try {
      await replaceMutation.mutateAsync({ current: slice, payload });
    } catch (error) {
      return error instanceof Error ? error.message : "Could not create install type.";
    }
    await queryClient.invalidateQueries({
      queryKey: apertureQueryKeys.slice(
        project.id,
        project.active_version_id ?? "",
        project.access_mode === "viewer" ? "viewer" : "editor",
      ),
    });
    return null;
  };

  return { ready: sliceQuery.data !== undefined, isPending: replaceMutation.isPending, create };
}
