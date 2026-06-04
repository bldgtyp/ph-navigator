import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiRequestError } from "../../../../shared/api/client";
import { catalogQueryKeys } from "../../query-keys";
import { commitCatalogImport, previewCatalogImportRaw } from "./api";
import type { CommitResponse, PreviewResponse } from "./types";

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
      queryClient.invalidateQueries({ queryKey: catalogQueryKeys.glazingTypes() });
    },
  });
}
