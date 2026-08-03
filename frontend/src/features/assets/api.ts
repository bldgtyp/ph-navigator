import { ApiRequestError, fetchJson } from "../../shared/api/client";
import { downloadUrl } from "../../shared/lib/downloadBlob";
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

/** PUT to the signed URL via XHR so callers can render real upload progress. */
export function putToSignedUrlWithProgress(
  uploadUrl: string,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(`Upload failed: ${request.status} ${request.statusText}`));
    };
    request.onerror = () => reject(new Error("Upload failed: network error"));
    request.send(file);
  });
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

export function bulkDownloadAssetId(job: JobResponse): string {
  if (job.status === "failed" || !job.result_asset_id) {
    throw new Error("Could not prepare this download. Try again.");
  }
  return job.result_asset_id;
}

const DOWNLOAD_ERROR_MESSAGES: Record<string, string> = {
  asset_not_referenced:
    "This file isn't part of the shared view. Ask the project owner to attach it.",
  asset_not_found: "This file is no longer available.",
  asset_upload_incomplete: "This file is still uploading — try again in a moment.",
  project_deleted: "This project has been deleted.",
  not_authenticated: "Your session expired. Sign in again to download.",
};

export function assetDownloadMessage(
  errorCode: string | null,
  requestId: string | null = null,
): string {
  const mapped = errorCode ? DOWNLOAD_ERROR_MESSAGES[errorCode] : undefined;
  const fallback = "Could not download this file. Try again or contact support.";
  return mapped ?? `${fallback}${requestId ? ` (Request ID: ${requestId})` : ""}`;
}

export class AssetDownloadError extends Error {
  errorCode: string | null;
  requestId: string | null;

  constructor(message: string, errorCode: string | null, requestId: string | null) {
    super(message);
    this.name = "AssetDownloadError";
    this.errorCode = errorCode;
    this.requestId = requestId;
  }
}

export async function downloadAsset(projectId: string, assetId: string): Promise<void> {
  try {
    const urls = await fetchJson<AssetUrls>(`/api/v1/projects/${projectId}/assets/${assetId}/url`);
    // A signed storage response may still fail after the API preflight. Keep
    // that response out of PH-Navigator's browsing context.
    downloadUrl(urls.download_url, "", "_blank");
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw new AssetDownloadError(
        assetDownloadMessage(error.errorCode, error.requestId),
        error.errorCode,
        error.requestId,
      );
    }
    throw new AssetDownloadError("Could not download this file. Try again.", null, null);
  }
}
