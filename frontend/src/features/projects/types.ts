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
};

export type SaveDraftResponse = {
  project_id: string;
  version: ProjectVersion;
  version_etag: string;
};

export type SaveAsPayload = {
  name: string;
  kind: ProjectVersion["kind"];
  locked: boolean;
};

export type DiffSummary = {
  project_id: string;
  from_version_id: string;
  to_version_id: string;
  tables: Array<{
    table: string;
    change_count: number;
    changed_paths: string[];
  }>;
};

export type ProjectListResponse = {
  projects: ProjectSummary[];
};

export type CreateProjectPayload = {
  name: string;
  bt_number: string;
  client: string | null;
  cert_programs: CertificationProgram[];
  phius_number: string | null;
  phius_dropbox_url: string | null;
};

export type BtNumberAvailability = {
  available: boolean;
  conflict: { id: string; name: string } | null;
};
