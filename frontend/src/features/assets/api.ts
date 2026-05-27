import { fetchJson, getApiBaseUrl } from "../../shared/api/client";
import type {
  AssetKind,
  AssetUrls,
  AttachmentMutationRequest,
  AttachmentMutationResponse,
  AttachmentRowsPayload,
  AttachmentRowsSlice,
  JobResponse,
  UploadIntentResponse,
} from "./types";

export async function fetchAttachmentRows(
  projectId: string,
  versionId: string,
  tableName: string,
  accessMode: "editor" | "viewer",
  signal?: AbortSignal,
): Promise<AttachmentRowsSlice> {
  const part = accessMode === "editor" ? "draft" : "document";
  return fetchJson<AttachmentRowsSlice>(
    `/api/v1/projects/${projectId}/versions/${versionId}/${part}/tables/${tableName}`,
    { signal },
  );
}

export async function replaceAttachmentRows(
  projectId: string,
  versionId: string,
  current: AttachmentRowsSlice,
  tableName: string,
  payload: AttachmentRowsPayload,
): Promise<AttachmentRowsSlice> {
  const headers = new Headers();
  if (current.draft_etag) headers.set("If-Match", current.draft_etag);
  else headers.set("If-Match-Version", current.version_etag);
  return fetchJson<AttachmentRowsSlice>(
    `/api/v1/projects/${projectId}/versions/${versionId}/draft/tables/${tableName}`,
    { method: "PUT", headers, body: JSON.stringify(payload) },
  );
}

export async function createUploadIntent(args: {
  projectId: string;
  assetKind: AssetKind;
  file: File;
  contentHashSha256: string;
}): Promise<UploadIntentResponse> {
  return fetchJson<UploadIntentResponse>(
    `/api/v1/projects/${args.projectId}/assets/upload-intent`,
    {
      method: "POST",
      body: JSON.stringify({
        asset_kind: args.assetKind,
        original_filename: args.file.name,
        display_name: args.file.name,
        content_type: args.file.type || "application/octet-stream",
        size_bytes: args.file.size,
        content_hash_sha256: args.contentHashSha256,
      }),
    },
  );
}

export async function putToSignedUrl(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!response.ok) throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
}

export async function completeUpload(projectId: string, assetId: string): Promise<void> {
  await fetchJson(`/api/v1/projects/${projectId}/assets/${assetId}/complete-upload`, {
    method: "POST",
  });
}

export async function attachAssetToDocument(
  projectId: string,
  assetId: string,
  payload: AttachmentMutationRequest,
): Promise<AttachmentMutationResponse> {
  return fetchJson<AttachmentMutationResponse>(
    `/api/v1/projects/${projectId}/assets/${assetId}/attach`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function detachAssetFromDocument(
  projectId: string,
  assetId: string,
  payload: AttachmentMutationRequest,
): Promise<AttachmentMutationResponse> {
  return fetchJson<AttachmentMutationResponse>(
    `/api/v1/projects/${projectId}/assets/${assetId}/detach`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function fetchAssetUrls(projectId: string, assetIds: string[]): Promise<AssetUrls[]> {
  if (assetIds.length === 0) return [];
  const response = await fetchJson<{ items: AssetUrls[] }>(
    `/api/v1/projects/${projectId}/assets/bulk-urls?ids=${encodeURIComponent(assetIds.join(","))}`,
  );
  return response.items;
}

export async function startBulkDownload(args: {
  projectId: string;
  tableKey?: string;
  columnKey?: string;
  kind?: AssetKind;
}): Promise<JobResponse> {
  return fetchJson<JobResponse>(`/api/v1/projects/${args.projectId}/assets/bulk-download`, {
    method: "POST",
    body: JSON.stringify({
      filter: { table_key: args.tableKey, column_key: args.columnKey, kind: args.kind },
      include_manifest_csv: true,
    }),
  });
}

export function assetDownloadPath(projectId: string, assetId: string): string {
  return `${getApiBaseUrl()}/api/v1/projects/${projectId}/assets/${assetId}/download`;
}
