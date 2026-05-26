import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  completeUpload,
  createUploadIntent,
  fetchAssetUrls,
  fetchAttachmentRows,
  putToSignedUrl,
  replaceAttachmentRows,
} from "./api";
import { assetQueryKeys } from "./query-keys";
import type { AssetKind, AttachmentRowsPayload, AttachmentRowsSlice } from "./types";

export function useAssetUrls(projectId: string, assetIds: string[]) {
  return useQuery({
    queryKey: assetQueryKeys.urls(projectId, assetIds),
    queryFn: () => fetchAssetUrls(projectId, assetIds),
    enabled: assetIds.length > 0,
    staleTime: 10 * 60 * 1000,
  });
}

export function useAttachmentRows(
  projectId: string,
  versionId: string | null,
  tableName: string,
  accessMode: "editor" | "viewer",
) {
  return useQuery({
    queryKey: ["attachment-rows", projectId, versionId, tableName, accessMode],
    queryFn: ({ signal }) =>
      fetchAttachmentRows(projectId, versionId ?? "", tableName, accessMode, signal),
    enabled: Boolean(versionId),
  });
}

export function useReplaceAttachmentRows(
  projectId: string,
  versionId: string | null,
  tableName: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      current,
      payload,
    }: {
      current: AttachmentRowsSlice;
      payload: AttachmentRowsPayload;
    }) => {
      if (!versionId) throw new Error("No active version.");
      return replaceAttachmentRows(projectId, versionId, current, tableName, payload);
    },
    onSuccess: (slice) => {
      queryClient.setQueryData(
        ["attachment-rows", projectId, slice.version_id, tableName, "editor"],
        slice,
      );
    },
  });
}

export async function uploadAsset(
  projectId: string,
  assetKind: AssetKind,
  file: File,
): Promise<string> {
  const contentHashSha256 = await fileSha256(file);
  const intent = await createUploadIntent({ projectId, assetKind, file, contentHashSha256 });
  if (intent.upload_url) {
    await putToSignedUrl(intent.upload_url, file);
    await completeUpload(projectId, intent.asset.id);
  }
  return intent.asset.id;
}

async function fileSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
