export type ExtractionStatus = "pending" | "success" | "failed";

export type HbjsonFile = {
  id: string;
  project_id: string;
  asset_id: string;
  display_name: string;
  notes: string | null;
  uploaded_by: string;
  uploaded_by_display_name: string;
  uploaded_at: string;
  size_bytes: number;
  original_filename: string;
  extraction_status: ExtractionStatus;
  extraction_error: string | null;
};

export type HbjsonFileListResponse = {
  items: HbjsonFile[];
};

export type HbjsonFileCreatePayload = {
  asset_id: string;
  display_name?: string;
  notes?: string;
};

export type HbjsonFileUpdatePayload = {
  display_name?: string;
  notes?: string | null;
};

/** Result of the full upload orchestration (hash → intent → PUT → link). */
export type HbjsonUploadOutcome =
  | { kind: "created"; file: HbjsonFile }
  | { kind: "duplicate"; existingFileId: string; existingDisplayName: string };
