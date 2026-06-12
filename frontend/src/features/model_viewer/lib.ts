import { ApiRequestError } from "../../shared/api/client";
import { sha256HexOfFile } from "../../shared/lib/sha256";
import { completeUpload, createUploadIntent, putToSignedUrlWithProgress } from "../assets/api";
import { createHbjsonFile } from "./api";
import type { HbjsonFile, HbjsonUploadOutcome } from "./types";

/** D-17: upload cap raised from 50 to 100 MB for real multifamily exports. */
export const HBJSON_MAX_FILE_SIZE_MB = 100;

const HBJSON_EXTENSIONS = [".hbjson", ".json"];

export const HBJSON_TYPE_REJECTION_MESSAGE =
  "Only .hbjson files are supported. Please drop a Honeybee Model JSON.";
export const HBJSON_SIZE_REJECTION_MESSAGE =
  `File is too large (max ${HBJSON_MAX_FILE_SIZE_MB} MB). ` +
  "Please contact support if you need to upload a larger model.";

/** Client-side mirror of the backend upload policy. Returns an error message or null. */
export function validateHbjsonFile(file: { name: string; size: number }): string | null {
  const lowered = file.name.toLowerCase();
  if (!HBJSON_EXTENSIONS.some((extension) => lowered.endsWith(extension))) {
    return HBJSON_TYPE_REJECTION_MESSAGE;
  }
  if (file.size > HBJSON_MAX_FILE_SIZE_MB * 1024 * 1024) {
    return HBJSON_SIZE_REJECTION_MESSAGE;
  }
  return null;
}

export function formatFileSizeMb(sizeBytes: number): string {
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function sortFilesNewestFirst(files: HbjsonFile[]): HbjsonFile[] {
  return [...files].sort((a, b) => {
    const byDate = Date.parse(b.uploaded_at) - Date.parse(a.uploaded_at);
    return byDate !== 0 ? byDate : b.id.localeCompare(a.id);
  });
}

/**
 * Full upload orchestration: hash → upload-intent → signed PUT →
 * complete-upload → hbjson-files link step.
 *
 * The asset layer dedups by content hash at intent time (`duplicate_of`
 * skips the PUT); the link step's 409 is still the dedup contract and is
 * surfaced as a `duplicate` outcome so the UI can offer "[Switch]".
 */
export async function uploadHbjsonFile(args: {
  projectId: string;
  file: File;
  onProgress?: (fraction: number) => void;
}): Promise<HbjsonUploadOutcome> {
  const contentHashSha256 = await sha256HexOfFile(args.file);
  const intent = await createUploadIntent({
    projectId: args.projectId,
    assetKind: "hbjson",
    file: args.file,
    contentHashSha256,
  });
  if (intent.duplicate_of === null) {
    if (!intent.upload_url) throw new Error("Upload intent did not return an upload URL.");
    await putToSignedUrlWithProgress(intent.upload_url, args.file, args.onProgress);
    await completeUpload(args.projectId, intent.asset.id);
  }
  try {
    const file = await createHbjsonFile(args.projectId, { asset_id: intent.asset.id });
    return { kind: "created", file };
  } catch (error) {
    if (error instanceof ApiRequestError && error.errorCode === "hbjson_duplicate_file") {
      return {
        kind: "duplicate",
        existingFileId: String(error.details.id ?? ""),
        existingDisplayName: String(error.details.display_name ?? "an existing file"),
      };
    }
    throw error;
  }
}
