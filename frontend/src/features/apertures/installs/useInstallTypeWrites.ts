// Quick create/edit write paths for install types, shared by the Installs
// modal's inline forms (and any future quick-edit surface). Reuses the
// phase-03 payload builders + replace mutation so validation never forks
// from the table page, and refreshes the apertures slice so the
// `InstallTypesProvider` summaries pick the change up (sibling-slice
// invalidation is registered with `refetchType: "none"`, so an explicit
// refetch is required). The same `refetchType: "none"` registration is
// why each write resolves the slice through `resolveCachedSliceForWrite`
// — see the comment on `writeSlice`.
import { useQueryClient } from "@tanstack/react-query";
import { apertureQueryKeys } from "../query-keys";
import type { ProjectDetail } from "../../projects/types";
import { refetchResultData, resolveCachedSliceForWrite } from "../../project_document/table-slice";
import {
  installTypesSliceFeature,
  useInstallTypesSliceQuery,
  useReplaceInstallTypesSliceMutation,
} from "./api";
import {
  installTypesPayloadFromCellWrites,
  installTypesPayloadFromRowInsert,
  makeBuildEmptyInstallTypeRow,
  validateInstallTypesPayload,
} from "./payloads";
import { INSTALL_TYPE_ID_PREFIX } from "./constants";
import type { InstallTypesReplacePayload, InstallTypesSlice } from "./types";
import { generatedId } from "../../../shared/lib/ids";

const buildEmptyRow = makeBuildEmptyInstallTypeRow();

/** A staged new row. The id is generated when the user fills the form, not at
 *  commit time, so the modal can paint edges with a type that does not exist
 *  in the document yet and still write a self-consistent set of commands. */
export type InstallTypeCreate = { id: string; name: string; psiWmk: number | null };

/** A staged edit. Omitting `psiWmk` leaves the stored Ψ untouched — the modal
 *  only sends it when the user actually edited the field, so a value left
 *  alone can never be quantized by its display rounding. */
export type InstallTypePatch = { id: string; name: string; psiWmk?: number | null };

/** Id for a row the user is about to create; stable across the modal session
 *  so staged edge assignments can reference it before it is written. */
export function newInstallTypeId(): string {
  return generatedId(INSTALL_TYPE_ID_PREFIX);
}

export function useInstallTypeWrites(project: ProjectDetail): {
  ready: boolean;
  isPending: boolean;
  /** Write staged creates then staged edits. Resolves to the first error
   *  message, or null when everything landed. */
  commit: (
    creates: readonly InstallTypeCreate[],
    patches: readonly InstallTypePatch[],
  ) => Promise<string | null>;
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

  /** Resolve the freshest slice, build a payload from it, write, then refresh
   *  the apertures slice. Resolves to an error message, or null on success. */
  const writeSlice = async (
    build: (slice: InstallTypesSlice) => InstallTypesReplacePayload,
  ): Promise<string | null> => {
    const cached = sliceQuery.data;
    if (!cached) return "Install types are still loading.";
    // Any sibling draft write — most often an edge paint dispatched from the
    // same Installs modal — bumps the document-wide draft etag and invalidates
    // this slice. Refetch before writing (the standard refetch-before-write
    // protocol) so a second write in one modal session doesn't `If-Match` a
    // superseded etag and 409 with "The draft changed before this table
    // update was applied."
    const slice = await resolveCachedSliceForWrite(
      queryClient,
      installTypesSliceFeature.queryKeys.slice(
        project.id,
        project.active_version_id ?? "",
        project.access_mode,
      ),
      cached,
      async () => refetchResultData<InstallTypesSlice>(await sliceQuery.refetch()),
    );
    const payload = build(slice);
    const invalid = validateInstallTypesPayload(payload);
    if (invalid) return invalid;
    try {
      await replaceMutation.mutateAsync({ current: slice, payload });
    } catch (error) {
      return error instanceof Error ? error.message : "Could not save the install type.";
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

  return {
    ready: sliceQuery.data !== undefined,
    isPending: replaceMutation.isPending,
    commit: async (creates, patches) => {
      if (creates.length === 0 && patches.length === 0) return null;
      // One replace per save, not one per kind: `replace_table` carries the
      // whole table anyway, so the inserts and the cell writes compose into a
      // single payload — and a single draft-etag bump.
      return writeSlice((slice) => {
        const withInserts =
          creates.length === 0
            ? slice
            : {
                ...slice,
                ...installTypesPayloadFromRowInsert(
                  slice,
                  creates.map((create) => ({
                    rowId: create.id,
                    anchorRowId: null,
                    fieldDefaults: { name: create.name, psi_w_mk: create.psiWmk },
                  })),
                  buildEmptyRow,
                ),
              };
        if (patches.length === 0) {
          return {
            aperture_install_types: withInserts.aperture_install_types,
            single_select_options: withInserts.single_select_options,
          };
        }
        // An edit of a still-staged create is folded into that insert by the
        // caller, so every patch targets a row present in `withInserts`.
        return installTypesPayloadFromCellWrites(
          withInserts,
          patches.flatMap((patch) => [
            { rowId: patch.id, fieldKey: "name", value: patch.name },
            ...(patch.psiWmk === undefined
              ? []
              : [{ rowId: patch.id, fieldKey: "psi_w_mk", value: patch.psiWmk }]),
          ]),
          {},
        );
      });
    },
  };
}
