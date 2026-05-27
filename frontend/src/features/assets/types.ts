export type AssetKind =
  | "datasheet"
  | "site_photo"
  | "hbjson"
  | "simulation_file"
  | "export_bundle"
  | "other";

export type AssetMetadata = {
  thumbnail_object_key?: string | null;
  thumbnail_status?: "ready" | "pending" | "failed" | "na" | null;
  thumbnail_failure_reason?: string | null;
  page_count?: number | null;
  image_dimensions?: [number, number] | null;
};

export type ProjectAsset = {
  id: string;
  project_id: string;
  asset_kind: AssetKind;
  object_key: string;
  original_filename: string;
  display_name: string;
  content_type: string;
  size_bytes: number;
  content_hash_sha256: string;
  upload_status: "pending" | "uploaded" | "failed";
  metadata: AssetMetadata;
};

export type UploadIntentResponse = {
  asset: ProjectAsset;
  upload_url: string | null;
  expires_at: string | null;
  duplicate_of: string | null;
};

export type AssetUrls = {
  asset_id: string;
  preview_url: string;
  preview_expires_at: string;
  download_url: string;
  download_expires_at: string;
  thumbnail_url: string | null;
  thumbnail_status: string | null;
  thumbnail_expires_at: string | null;
  content_type: string;
  original_filename: string;
  display_name: string;
  size_bytes: number;
};

export type AttachmentFieldConfig = {
  assetKind: AssetKind;
  allowedTypes: string[];
  maxCount: number;
  maxFileSizeMb: number;
};

export type AttachmentRow = {
  id: string;
  name?: string | null;
  [key: string]: unknown;
};

export type AttachmentRowsSlice = {
  project_id: string;
  version_id: string;
  source: "version" | "draft";
  version_etag: string;
  draft_etag: string | null;
  rows: AttachmentRow[];
};

export type AttachmentRowsPayload = {
  rows: AttachmentRow[];
};

export type JobResponse = {
  id: string;
  project_id: string;
  job_type: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  result_asset_id: string | null;
  error_code: string | null;
  status_url: string | null;
};

export type AttachmentMutationRequest = {
  version_id: string;
  table_key: string;
  row_id: string;
  field_key: string;
  index?: number | null;
  if_match?: string | null;
  if_match_version?: string | null;
  op_group_id?: string | null;
};

export type AttachmentMutationResponse = {
  version_etag: string;
  draft_etag: string;
  source: "version" | "draft";
  asset_ids: string[];
};
