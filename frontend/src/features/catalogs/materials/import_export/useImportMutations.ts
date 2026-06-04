import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiRequestError } from "../../../../shared/api/client";
import { catalogQueryKeys } from "../../query-keys";
import { commitCatalogImport, previewCatalogImportRaw } from "./api";
import type { CommitResponse, PreviewResponse } from "./types";

// Error generic is `ApiRequestError | Error` so callers reading
// `mutation.error` from the hook return keep the typed API surface
// (`.status`, `.errorCode`, `.details`) AND model the runtime
// reality: `fetchJson` rejects with `ApiRequestError` on any non-2xx,
// but a real network failure or aborted fetch propagates as a bare
// `TypeError` / `Error` from `fetch()` itself (no try/catch in
// `fetchApiResponse`). Consumers must runtime-check `instanceof
// ApiRequestError` before reading the typed fields.
type MutationError = ApiRequestError | Error;

export function usePreviewImportMutation() {
  return useMutation<PreviewResponse, MutationError, unknown>({
    mutationFn: (body) => previewCatalogImportRaw(body),
  });
}

export function useCommitImportMutation() {
  const queryClient = useQueryClient();
  return useMutation<CommitResponse, MutationError, string>({
    mutationFn: (token) => commitCatalogImport(token),
    onSuccess: () => {
      // Refresh both filter variants so the "include inactive" toggle
      // reflects newly-imported rows immediately.
      queryClient.invalidateQueries({ queryKey: catalogQueryKeys.materials() });
    },
  });
}
