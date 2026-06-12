export type CertificationProgram = "phi" | "phius";

export type ProjectVersion = {
  id: string;
  project_id: string;
  name: string;
  kind: "working" | "submitted" | "closed" | "snapshot";
  locked: boolean;
  schema_version: number;
  body_size_bytes: number;
  created_at: string;
  updated_at: string;
};

export type ProjectSummary = {
  id: string;
  name: string;
  bt_number: string;
  client: string | null;
  cert_programs: CertificationProgram[];
  phius_number: string | null;
  phius_dropbox_url: string | null;
  active_version_id: string | null;
  last_saved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectDetail = ProjectSummary & {
  versions: ProjectVersion[];
  active_version: ProjectVersion | null;
  access_mode: "editor" | "viewer";
  owner_display_name: string | null;
};

export type ProjectListResponse = {
  projects: ProjectSummary[];
};

export type ProjectDeleteCounts = {
  versions: number;
  drafts: number;
  status_items: number;
  assets: number;
  jobs: number;
  mcp_tokens: number;
  table_views: number;
};

export type ProjectDeletedSummary = ProjectSummary & {
  deleted_at: string;
  deleted_by: string | null;
  hard_delete_after: string | null;
  counts: ProjectDeleteCounts;
};

export type ProjectDeletedListResponse = {
  projects: ProjectDeletedSummary[];
};

export type ProjectBulkDeleteItem = {
  project_id: string;
  ok: boolean;
  deleted_at: string | null;
  hard_delete_after: string | null;
  already_deleted: boolean;
  counts: ProjectDeleteCounts | null;
  error_code: string | null;
  message: string | null;
};

export type ProjectBulkDeleteResponse = {
  mode: "soft";
  items: ProjectBulkDeleteItem[];
};

export type CreateProjectPayload = {
  name: string;
  bt_number: string;
  client: string | null;
  cert_programs: CertificationProgram[];
  phius_number: string | null;
  phius_dropbox_url: string | null;
};

export type UpdateProjectPayload = Partial<CreateProjectPayload>;

export type BtNumberAvailability = {
  available: boolean;
  conflict: { id: string; name: string } | null;
};

export type EpwParsedLocation = {
  latitude: number | null;
  longitude: number | null;
  elevation_m: number | null;
  time_zone: string | null;
  city: string | null;
  state: string | null;
};

export type EpwDescriptor = {
  id: string;
  filename: string | null;
  source_url: string | null;
  parsed_location: EpwParsedLocation | null;
};

export type ProjectLocationFields = {
  latitude: number | null;
  longitude: number | null;
  elevation_m: number | null;
  time_zone: string | null;
  true_north_deg: number | null;
  site_address: string | null;
  city: string | null;
  state: string | null;
  epw_asset_id: string | null;
  epw_source_url: string | null;
};

export type ProjectLocation = ProjectLocationFields & {
  is_set: boolean;
  updated_at: string | null;
  epw: EpwDescriptor | null;
};

export type UpdateProjectLocationPayload = Partial<ProjectLocationFields>;

export type ProjectLocationUpdateResponse = {
  location: ProjectLocation;
  warnings: string[];
};
