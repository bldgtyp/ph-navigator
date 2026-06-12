import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { errorMessage } from "../../shared/lib/errors";
import { deleteHbjsonFile, fetchHbjsonFiles, updateHbjsonFile } from "./api";
import { sortFilesNewestFirst, uploadHbjsonFile, validateHbjsonFile } from "./lib";
import { modelViewerQueryKeys } from "./query-keys";
import type { HbjsonFile, HbjsonFileListResponse, HbjsonFileUpdatePayload } from "./types";

export { modelViewerQueryKeys };

export function useHbjsonFilesQuery(projectId: string) {
  return useQuery({
    queryKey: modelViewerQueryKeys.files(projectId),
    queryFn: ({ signal }) => fetchHbjsonFiles(projectId, signal),
    select: (payload) => sortFilesNewestFirst(payload.items),
  });
}

export function useUploadHbjsonFileMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { file: File; onProgress?: (fraction: number) => void }) =>
      uploadHbjsonFile({ projectId, ...args }),
    onSuccess: (outcome) => {
      if (outcome.kind === "created") {
        queryClient.setQueryData<HbjsonFileListResponse>(
          modelViewerQueryKeys.files(projectId),
          (current) => upsertFile(current, outcome.file),
        );
      }
    },
  });
}

export function useUpdateHbjsonFileMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId, payload }: { fileId: string; payload: HbjsonFileUpdatePayload }) =>
      updateHbjsonFile(projectId, fileId, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData<HbjsonFileListResponse>(
        modelViewerQueryKeys.files(projectId),
        (current) => upsertFile(current, updated),
      );
    },
  });
}

export function useDeleteHbjsonFileMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) => deleteHbjsonFile(projectId, fileId),
    onSuccess: (_result, fileId) => {
      queryClient.setQueryData<HbjsonFileListResponse>(
        modelViewerQueryKeys.files(projectId),
        (current) =>
          current ? { items: current.items.filter((file) => file.id !== fileId) } : current,
      );
    },
  });
}

export function useRefetchHbjsonFiles(projectId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: modelViewerQueryKeys.files(projectId) });
}

export type UploadNotice =
  | { kind: "error"; message: string }
  | { kind: "duplicate"; message: string; existingFileId: string };

/**
 * Shared upload UI state for the drop zones (file popover + empty state):
 * local validation, progress fraction, and the inline notice surface —
 * there is no global toast system (D-06), so rejection/dedup messages
 * render next to the drop zone that triggered them.
 */
export function useHbjsonUploadFlow(projectId: string, onUploaded: (fileId: string) => void) {
  const uploadMutation = useUploadHbjsonFileMutation(projectId);
  const [progress, setProgress] = useState<number | null>(null);
  const [notice, setNotice] = useState<UploadNotice | null>(null);

  const handleFile = (file: File) => {
    const validationError = validateHbjsonFile(file);
    if (validationError) {
      setNotice({ kind: "error", message: validationError });
      return;
    }
    setNotice(null);
    setProgress(0);
    uploadMutation.mutate(
      { file, onProgress: setProgress },
      {
        onSuccess: (outcome) => {
          setProgress(null);
          if (outcome.kind === "duplicate") {
            setNotice({
              kind: "duplicate",
              message: `This file matches an existing upload (${outcome.existingDisplayName}). Switch to it instead?`,
              existingFileId: outcome.existingFileId,
            });
            return;
          }
          onUploaded(outcome.file.id);
        },
        onError: (error) => {
          setProgress(null);
          setNotice({ kind: "error", message: errorMessage(error, "Could not upload file.") });
        },
      },
    );
  };

  return {
    progress,
    notice,
    isUploading: uploadMutation.isPending,
    handleFile,
    clearNotice: () => setNotice(null),
  };
}

export type HbjsonUploadFlow = ReturnType<typeof useHbjsonUploadFlow>;

function upsertFile(
  current: HbjsonFileListResponse | undefined,
  file: HbjsonFile,
): HbjsonFileListResponse {
  const existing = current?.items ?? [];
  return { items: [file, ...existing.filter((candidate) => candidate.id !== file.id)] };
}
