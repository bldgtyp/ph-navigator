import type { StatusAxisCounts } from "../project_document/specification-status";

export type DocumentationSpecStatus = "needed" | "question" | "complete" | "na" | "unknown";
export type DocumentationEvidenceStatus = "needed" | "complete" | "na";

/** Owned by the shared status vocabulary — the Overview rollup uses it too. */
export type DocumentationAxisCounts = StatusAxisCounts;

export type DocumentationRecord = {
  record_id: string;
  table_key: string;
  field_table_key: string;
  display_name: string;
  sub_label: string | null;
  spec_status: DocumentationSpecStatus;
  datasheet_status: DocumentationEvidenceStatus;
  photo_status: DocumentationEvidenceStatus;
  datasheet_asset_ids: string[];
  photo_asset_ids: string[];
  datasheet_not_required: boolean;
  photo_not_required: boolean;
  table_path: string;
  segment_ids: string[];
  material_id: string | null;
};

export type DocumentationGroup = {
  key: string;
  title: string;
  anchor: string;
  counts: DocumentationAxisCounts;
  records: DocumentationRecord[];
};

export type DocumentationSection = {
  key: string;
  title: string;
  anchor: string;
  counts: DocumentationAxisCounts;
  groups: DocumentationGroup[];
  records: DocumentationRecord[];
};

export type ProjectDocumentationSummary = {
  project_id: string;
  version_id: string;
  source: "version" | "draft";
  version_etag: string;
  draft_etag: string | null;
  counts: DocumentationAxisCounts;
  sections: DocumentationSection[];
};

export type DocumentationRollupGroup = Omit<DocumentationGroup, "records">;
export type DocumentationRollupSection = Omit<DocumentationSection, "groups" | "records"> & {
  groups: DocumentationRollupGroup[];
};
export type ProjectDocumentationRollup = Omit<ProjectDocumentationSummary, "sections"> & {
  sections: DocumentationRollupSection[];
};
