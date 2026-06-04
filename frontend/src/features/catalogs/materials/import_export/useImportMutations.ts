import { useMutation, useQueryClient } from "@tanstack/react-query";
import { catalogQueryKeys } from "../../query-keys";
import { commitCatalogImport, previewCatalogImportRaw } from "./api";
import type { CommitResponse, PreviewResponse } from "./types";

export function usePreviewImportMutation() {
  return useMutation<PreviewResponse, Error, unknown>({
    mutationFn: (body) => previewCatalogImportRaw(body),
  });
}

export function useCommitImportMutation() {
  const queryClient = useQueryClient();
  return useMutation<CommitResponse, Error, string>({
    mutationFn: (token) => commitCatalogImport(token),
    onSuccess: () => {
      // Refresh both filter variants so the "include inactive" toggle
      // reflects newly-imported rows immediately.
      queryClient.invalidateQueries({ queryKey: catalogQueryKeys.materials() });
    },
  });
}
