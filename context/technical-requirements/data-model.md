---
DATE: 2026-05-12
STATUS: CANONICAL TECHNICAL REQUIREMENTS — extracted from context/PRD.md to keep startup context small.
RELATED: context/PRD.md §6–§7, context/TECH_STACK.md, context/GLOSSARY.md
---

# PH-Navigator V2 — Data Model Requirements

This file preserves implementation-level requirements that were formerly
embedded in `context/PRD.md`. Load it on demand when touching this surface;
do not make it part of default startup context.

## 6. Data model

### 6.1 Relational layer (thin)

```sql
users (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email              TEXT NOT NULL,
                       -- unique lower(email), enforced by
                       -- `uq_users_email_lower`
    display_name       TEXT NOT NULL,
    password_hash      TEXT NOT NULL,
                       -- Argon2id hash. TB-01 settings:
                       -- time_cost=3, memory_cost=65536,
                       -- parallelism=4.
    is_active          BOOLEAN NOT NULL DEFAULT true,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
)

-- Server-side sessions. Required for single-active-session-per-user
-- semantics (§13). HTTP-only cookie carries the session id; server
-- looks up the row on every authenticated request.
sessions (
    id              UUID PRIMARY KEY,
                    -- cryptographically random UUIDv4 referenced by
                    -- the session cookie
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
                    -- updated on every authenticated request; expiry
                    -- is computed as last_seen_at + 60 min
    expires_at      TIMESTAMPTZ NOT NULL,
    invalidated_at  TIMESTAMPTZ,
                    -- NULL = active. Set when the session ends:
                    -- explicit sign-out, idle timeout, or
                    -- superseded_by_new_login.
    invalidation_reason  TEXT,
                    -- 'sign_out' | 'idle_timeout' |
                    -- 'superseded_by_new_login' | 'admin_revoked'
    ip_address      TEXT,
    user_agent      TEXT
)
CREATE UNIQUE INDEX uq_sessions_one_active_per_user
    ON sessions (user_id) WHERE invalidated_at IS NULL;

projects (
    id                 UUID PRIMARY KEY,
    name               TEXT NOT NULL,
    bt_number          TEXT NOT NULL UNIQUE,
                       -- 4-digit BLDGTYP project number (TEXT for forward
                       -- flexibility); UNIQUE without partial filter, so
                       -- soft-deleted projects retain their numbers and
                       -- numbers are never reused.
    client             TEXT,
    cert_programs      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
                       -- zero or more target certification programs:
                       -- 'phi' and/or 'phius'. A building may pursue both.
                       -- Empty means no program selected yet or
                       -- design-analysis-only; cert-specific templates
                       -- remain deferred in v1.
    phius_number       TEXT,
    phius_dropbox_url  TEXT,
    owner_id           UUID NOT NULL REFERENCES users(id),
                       -- dashboard-organization concept, not ACL.
                       -- Transferable post-MVP.
    active_version_id  UUID REFERENCES project_versions(id),
                       -- "the version the editor opens by default"
    last_saved_at      TIMESTAMPTZ,
                       -- denormalized: max(project_versions.updated_at)
                       -- across saved versions; updated only by the
                       -- version-save service on Save / Save As.
                       -- Draft patch does not update this field.
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ
)
ALTER TABLE projects ADD CONSTRAINT projects_cert_programs_allowed
    CHECK (cert_programs <@ ARRAY['phi','phius']::TEXT[]);

-- MCP/API bearer tokens for LLM clients. Required in V2 v1 because
-- MCP is read/write capable from day 1. Tokens are issued by an
-- authenticated editor, shown once, stored only as a hash, and
-- revocable from Project Settings. Public project readability does
-- NOT imply anonymous MCP access.
mcp_tokens (
    id              UUID PRIMARY KEY,
    issued_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    -- editor who issued the token; actions performed
                    -- with the token are attributed to this user
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    -- v1 tokens are project-scoped. All-project /
                    -- workspace-scoped tokens defer until there is a
                    -- concrete agent workflow that needs them.
    label           TEXT NOT NULL,
                    -- user-facing label, e.g. "Claude Desktop - Foo"
    token_prefix    TEXT NOT NULL,
                    -- first 16 chars for UI identification only
    token_hash      TEXT NOT NULL UNIQUE,
                    -- hash of the full token; plaintext is never
                    -- stored after initial issue
    scopes          TEXT[] NOT NULL DEFAULT ARRAY['project:read'],
                    -- allowed values in v1:
                    -- 'project:read' | 'project:write' | 'asset:read' |
                    -- 'asset:write'. Catalog writes are not included.
                    -- `project:write` extends `project:read`; write-only
                    -- project tokens are rejected.
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
                    -- nullable in v1; UI should encourage expiry but
                    -- not require it for local Claude workflows
    revoked_at      TIMESTAMPTZ
)
CREATE INDEX ON mcp_tokens (project_id, created_at) WHERE revoked_at IS NULL;

-- Project-level lifecycle / certification milestone tracker.
-- Lives outside the project document body intentionally: status is
-- "where is this project in its lifecycle," not a versioned property
-- of the energy model. See US-Status for full spec.
project_status_items (
    id              UUID PRIMARY KEY,
    project_id      UUID NOT NULL REFERENCES projects(id),
    order_index     DOUBLE PRECISION NOT NULL,
                    -- fractional indexing for cheap reorder
    title           TEXT NOT NULL,
    state           TEXT NOT NULL,
                    -- 'todo' | 'done' | 'na'
                    -- ('in_progress' deferred per Q-STATUS-3 — the
                    -- "current step" is computed as the first
                    -- non-done item in order)
    completion_date DATE,
    description     TEXT,
                    -- markdown allowed; in-app anchor links v1.1+
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID REFERENCES users(id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      UUID REFERENCES users(id),
    deleted_at      TIMESTAMPTZ
)
CREATE INDEX ON project_status_items (project_id, order_index)
    WHERE deleted_at IS NULL;

-- Per-user dashboard preferences. Pinning and ordering are personal,
-- so they live here rather than on `projects`.
user_project_preferences (
    user_id     UUID NOT NULL REFERENCES users(id),
    project_id  UUID NOT NULL REFERENCES projects(id),
    pinned      BOOLEAN NOT NULL DEFAULT FALSE,
    pin_order   INTEGER,
                -- ordinal within the user's pinned set; NULL when
                -- pinned = FALSE
    PRIMARY KEY (user_id, project_id)
)

-- Per-user audit / action log. Required for support troubleshooting
-- per US-C1. Append-only; queryable by SQL in v1 (no UI surface).
user_action_log (
    id           BIGSERIAL PRIMARY KEY,
    action       TEXT NOT NULL,
                 -- 'login', 'login_failed',
                 -- 'session_invalidated_by_new_login', 'sign_out'.
                 -- Project/version/catalog actions will extend this
                 -- table or its `details` JSONB as those slices land.
    user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
                 -- nullable for failed logins before user lookup
    email        TEXT,
    session_id   UUID,
    ip_address   TEXT,
    user_agent   TEXT,
    details      JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
)
CREATE INDEX ix_user_action_log_created_at
    ON user_action_log (created_at);

project_versions (
    id                UUID PRIMARY KEY,
    project_id        UUID NOT NULL REFERENCES projects(id),
    parent_version_id UUID REFERENCES project_versions(id),
                      -- linear history; NULL for the project's first version
    name              TEXT NOT NULL,
                      -- user-supplied label, e.g. "Working", "Round 1 Submit"
    kind              TEXT NOT NULL DEFAULT 'working',
                      -- 'working' | 'submitted' | 'closed' | 'snapshot'
    locked            BOOLEAN NOT NULL DEFAULT FALSE,
                      -- TRUE = saves cannot overwrite this version
    body              JSONB NOT NULL,
                      -- the project document; see §6.2
    schema_version    INTEGER NOT NULL,
    body_size_bytes   INTEGER NOT NULL,
                      -- denormalized for ops visibility; computed by
                      -- the version-save service when the body is
                      -- inserted or overwritten
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by        UUID REFERENCES users(id),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by        UUID REFERENCES users(id),
    UNIQUE (project_id, name)
)
CREATE INDEX ON project_versions (project_id, created_at);

-- project_view_links table REMOVED 2026-05-10.
-- Per the updated §4 access model: project URLs are public-readable;
-- no per-share-token mechanism is needed. The frontend gates edit
-- affordances by auth state; the backend gates writes behind editor
-- session tokens. No per-share token table exists.
```

Catalog tables (full schema in §7):
```
catalog_materials, catalog_material_versions
catalog_frame_types, catalog_frame_type_versions
catalog_glazing_types, catalog_glazing_type_versions
catalog_audit_log
```

Object-storage pointers:
```
project_assets (id, project_id, asset_kind, object_key, content_hash_sha256,
                content_type, size_bytes, original_filename, display_name,
                upload_status, uploaded_by, uploaded_at, deleted_at, ...)
                -- canonical row for every R2-backed upload.
                -- Referenced from the project document by id.
project_hbjson_files (id, project_id, asset_id, label, notes,
                      project_version_id?, extraction_status, ...)
                -- HBJSON viewer/extraction metadata only; the file lives
                -- in project_assets. Independent of project_versions.
```

### 6.2 Project document — JSONB shape

The body of a `project_versions` row is a single Pydantic-validated
JSON document. Illustrative sketch (the canonical model is the
`ProjectDocumentV1` Pydantic class in code; this is for orientation):

```jsonc
{
  "schema_version": 1,
  "project": {
    "name": "PROJECT FOO",
    "bt_number": "2024-013",
    "cert_programs": ["phi", "phius"],
    "phius_number": "PHIUS-2024-0445",
    "phius_dropbox_url": "..."
  },
  "tables": {
    "assemblies": [
      {
        "id": "asm_01HXYZ...",                   // stable ULID
        "name": "WALL-C3",
        "type": "wall",                           // 'wall' | 'floor' | 'roof' | 'other' (Q-ENV-15.1)
        "orientation": "first_layer_outside",     // 'first_layer_outside' | 'last_layer_outside' (Q-ENV-1)
        "layers": [
          {
            "id": "lyr_...",
            "order": 0,
            "thickness_mm": 50.0,                 // (Q-ENV-1) — was missing from earlier sketch
            "segments": [
              {
                "id": "seg_...",
                "order": 0,
                "width_mm": 812.8,
                "is_continuous_insulation": false,
                "steel_stud_spacing_mm": null,    // (Q-ENV-1) — was missing
                "project_material_id": "pmat_...", // reference into tables.project_materials (Q-ENV-2)
                "photo_asset_ids": []             // per-installation-slot site photos (Q-ENV-2)
              }
            ]
          }
        ]
      }
    ],
    "project_materials": [                        // V2 NEW — per-project material list (Q-ENV-2)
      {
        "id": "pmat_...",
        "name": "XPS",
        "category": "Insulation",
        "conductivity_w_mk": 0.034,
        "density_kg_m3": 35.0,
        "specific_heat_j_kgk": 1500.0,
        "emissivity": 0.9,
        "argb_color": "(255,220,230,240)",
        "specification_status": "complete",       // 'complete' | 'pending' | 'na' — moved from segment (Q-ENV-2)
        "notes": null,                            // per-product notes — moved from segment (Q-ENV-2)
        "datasheet_asset_ids": ["asset_..."],     // QA submittal — project-only, never in catalog (Q-ENV-2.1)
        "catalog_origin": {
          "catalog_table": "materials",
          "catalog_record_id": "rec123abc",
          "catalog_version_id": "rec123abc_v3",
          "catalog_schema_version": 1,            // pinned at pick time (§7.5)
          "synced_at": "2026-05-09T14:00:00Z",
          "local_overrides": []                   // field keys intentionally kept different from catalog (§7.4)
        }
      }
    ],
    "window_types": [
      {
        "id": "win_...",
        "name": "Type A",
        "row_heights_mm": [1000.0],
        "column_widths_mm": [1000.0],
        "elements": [
          {
            "id": "winel_...",
            "row_span": [0, 0],
            "column_span": [0, 0],
            "frames": {
              "top":    { /* inlined frame; see ProjectDocumentV1 */ },
              "right":  { /* inlined frame; see ProjectDocumentV1 */ },
              "bottom": { /* inlined frame; see ProjectDocumentV1 */ },
              "left":   { /* inlined frame; see ProjectDocumentV1 */ }
            },
            "glazing": { /* inlined; see ProjectDocumentV1 for full shape */ }
          }
        ]
      }
    ],
    "rooms": [                               // see US-EQ-2
      {
        "id": "rm_...",
        "number": "101",
        "name": "LIVING ROOM",
        "floor_level": "opt_...",            // single-select option_id
        "building_zone": "opt_...",          // single-select option_id; nullable
        "num_people": 2,
        "num_bedrooms": 0,
        "icfa_factor": 1.0,                  // clamped [0.0, 1.0]
        "erv_unit_ids": ["erv_..."],         // N:M with tables.equipment.ervs
        "catalog_origin": null,
        "notes": null
      }
    ],
    "thermal_bridges": [                     // V2 NEW — see US-EQ-3 (linear-only in v1)
      {
        "id": "tb_...",
        "name": "Wall-to-Slab Junction",
        "category": "opt_...",               // single-select option_id; nullable
        "length_m": 4.85,
        "psi_value_w_mk": 0.04,
        "assembly_id": "asm_...",            // optional ref to tables.assemblies
        "simulation_method": "opt_...",      // single-select option_id; nullable
        "simulation_file_asset_ids": [],
        "datasheet_asset_ids": [],
        "notes": null,
        "catalog_origin": null
      }
    ],
    "equipment": {
      "fans":  [ /* see US-EQ-6 — name, manufacturer (single-select), model_number, fan_purpose (single-select), airflow_cfm, electrical_power_w, runtime_hours_per_day, datasheet_asset_ids, catalog_origin, notes */ ],
      "pumps": [ /* see US-EQ-5 — name, manufacturer (single-select), model_number, pump_type (single-select), electrical_power_w, runtime_hours_per_year, datasheet_asset_ids, catalog_origin, notes */ ],
      "ervs":  [ /* see US-EQ-4 — name, manufacturer (single-select), model_number, unit_type (single-select), nominal_airflow_cfm, sensible_recovery_efficiency, electrical_power_w, datasheet_asset_ids, catalog_origin, notes */ ]
    },
    "manufacturer_filters": [ ]
  },
  "single_select_options": {                 // V2 NEW — user-defined options for single-select columns (US-Builder-Tables criteria 16–17)
    // V2 v1 ships ALL single-select option lists empty by default
    // (Ed 2026-05-10: no seeded defaults — user controls vocabulary
    // per-project). Example shapes shown below; arrays are `[]` on
    // new-project create.
    "rooms.floor_level": [
      { "id": "opt_...", "label": "Basement", "color": "#6b7280", "order": 0 },
      { "id": "opt_...", "label": "Ground",   "color": "#3b82f6", "order": 1 },
      { "id": "opt_...", "label": "1st",      "color": "#10b981", "order": 2 }
      /* user-defined after first edit; empty on new-project create */
    ],
    "rooms.building_zone": [ /* user-defined; nullable cells allowed */ ],
    "equipment.ervs.unit_type": [ /* user-defined; typically [ERV, HRV] but user picks labels */ ],
    "equipment.ervs.manufacturer": [ /* user-defined */ ],
    "equipment.fans.fan_purpose": [ /* user-defined */ ],
    "equipment.fans.manufacturer": [ /* user-defined */ ]
    // thermal_bridges.* and equipment.pumps.* options are not provisioned
    // in V2 v1 — those sub-tabs are placeholder-only (US-EQ-3 / US-EQ-5).
  }
}
```

Properties of the document shape:

- **Catalog values inlined; segments reference materials by ID.**
  - **Frames / glazings** (windows side) are still inlined per
    window-element. Frame/glazing reuse within a project is rare
    (each window-type's frames are typically unique to that type).
  - **Materials** (envelope side) live in `tables.project_materials[]`
    once per unique product per project. Segments reference them by
    `project_material_id`. Picking the same catalog material into
    multiple segments de-duplicates onto a single
    `project_materials` row (Q-ENV-2). This separation lets the
    same product carry one datasheet (the QA submittal) and one
    spec-status across many uses, while still letting each
    installation slot carry its own site photos.
- **`catalog_origin` is informational metadata** — used by the
  refresh-from-catalog UX (§7.4), not for live resolution. A pick
  is a copy; the project's values do not change when the catalog
  changes upstream.
- **Datasheets are never in the catalog** (Q-ENV-2.1). Catalog rows
  carry product specs only (conductivity, density, etc.); the
  per-project datasheet is a QA artifact submitted by the design
  / construction team on each project. See auto-memory
  `qa_principle_per_project_datasheets.md`.
- **Stable IDs.** Every entity has a ULID-style id (`asm_…`,
  `lyr_…`, `seg_…`, `pmat_…`, `win_…`, `winel_…`, `rm_…`,
  `tb_…`, `fan_…`, `pmp_…`, `erv_…`, `opt_…`).
  Browser-created document rows generate final ids in the frontend
  before optimistic display; the server validates prefix, shape, and
  table-local uniqueness, then preserves them. Server/admin import
  scripts may also generate ids. There is no `tmp-` id remapping phase
  for v1 document rows. Stable IDs are the unit of reference for
  JSON-Patch operations (§8.3). They also matter for single-select
  option references — rows hold `option_id` strings, never labels, so
  user-driven option renames are non-destructive.
- **Asset URLs by reference.** Datasheets, site photos, and
  thermal-bridge simulation files stay in object storage; the
  document holds asset ids that the API resolves to signed URLs
  at read time through the `project_assets` backbone (§6.5).
  Asset endpoints are designed to be LLM-callable from day 1 (§10).
- **Tables, not entity tree.** The top level is `tables.{
  assemblies, project_materials, window_types, rooms,
  thermal_bridges, equipment, manufacturer_filters, ... }`.
  New table types plug in by adding to `tables`. Per-table JSON
  download is a keyed slice of this shape, e.g. `{ "rooms": [...] }`.
- **Registered table contracts.** Generic saved/draft table routes are
  backed by `backend/features/project_document/tables/registry.py`.
  Each editable table adds one registered contract that owns payload
  validation, response serialization, document replacement, row
  extraction for downloads/MCP, diff extraction, and table-schema
  endpoint metadata. Unsupported table names fail through the registry
  with `document_table_not_found`; they are not handled by per-route
  branches.
- **User-defined column options live alongside data**
  (V2 NEW per US-Builder-Tables criteria 16–17). Single-select
  columns (e.g. `rooms.floor_level`, `rooms.building_zone`,
  `thermal_bridges.category`, equipment `manufacturer` /
  `unit_type` / `pump_type` / `fan_purpose`) draw their option
  list from a top-level `single_select_options` keyed by
  `<table_path>.<column_key>`. Each option carries a stable
  `id`, `label`, `color`, and `order`. **Sort follows
  `order`, not label** — reordering options reorders table data
  (AirTable parity, POC §4.3). Option lifecycle is explicit:
  rename and reorder are non-destructive; duplicate labels are
  rejected after trim + case-insensitive comparison; delete of a
  referenced option either clears nullable cells after confirmation or
  is blocked for required cells until the user reassigns or merges;
  merge rewrites source `option_id` references to the target option in
  one semantic write op; missing option ids render as a warning and
  block Save until cleared or reassigned.
- **Pydantic-validated.** `ProjectDocumentV1` defines the canonical
  shape and validation rules; the server rejects malformed bodies
  on write. The sketch above is illustrative — fields may be
  added by additive amendments without bumping `schema_version`.

> **History note (2026-05-10).** An earlier draft of this sketch
> inlined the material directly inside each segment with
> `specification_status` and `datasheet_asset_ids` at the segment
> level. That model lost the "one datasheet per product per
> project" QA invariant: a wall using XPS in five segments would
> require five datasheet uploads. Q-ENV-2 (resolved 2026-05-10)
> introduced `tables.project_materials[]` to fix this. Earlier
> drafts of this PRD that show the inlined shape are superseded.

### 6.3 Project-scoped non-catalog tables

Rooms, fans, pumps, ERVs, and similar live entirely inside the document.
No relational shadow. Schema and route behavior for each table are
defined under `backend/features/project_document/tables/` as a
registered Pydantic-backed contract. Adding a new table type is a code
change (table contract + frontend column config), not a schema
migration or a new route/service branch.

Implementation note for Phase 1: Rooms includes the future
`erv_unit_ids` field in the row shape, but non-empty ERV assignments
are rejected until the ERV table contract exists and can validate
references against `tables.equipment.ervs[*].id`.

For tables with a corresponding global catalog (fans, pumps, ERVs), the
"add row" UI offers two paths: pick from catalog (copies values in) or
hand-enter (no catalog_origin). Identical to how Material works for
Assembly Segments.

### 6.4 Query / index / reporting posture for MVP

Decision confirmed 2026-05-11: defer document-side query/index/reporting
infrastructure for MVP.

V2 v1 does **not** add generated columns, GIN indexes, sidecar search
tables, relational shadows of project document tables, cross-project
reporting, or precomputed catalog-drift indexes. The saved
`project_versions.body` JSONB document remains the project data source of
truth, and MVP reads are scoped to one project/version at a time.

MVP query behavior:

- Dashboard metadata, status state, action logs, HBJSON files, assets,
  users, tokens, and catalog records are normal relational tables because
  they are platform metadata or global data, not project-document table
  shadows.
- Project table screens read from the saved document or the active draft,
  then slice/filter/sort through Pydantic/application code for the current
  project/version.
- Diff summaries, catalog drift checks, asset usage/orphan detection, and
  downloads are computed on demand for the current project/version. They
  are not pre-indexed in MVP.
- Cross-project questions such as "which projects use Walltite ECO?" stay
  out of scope until a real workflow needs them.

Revisit after MVP if one of these happens: typical project JSON exceeds
~5 MB, table-slice or draft-save latency becomes noticeable in manual
testing, catalog drift checks feel slow on real projects, or a recurring
cross-project reporting workflow appears. At that point, add measured
fixture budgets before choosing generated columns, GIN indexes, or a
sidecar search table.

### 6.5 Asset backbone

Decision confirmed 2026-05-11: use one generic project asset backbone
for every uploaded file. Feature-specific file surfaces attach metadata
to that backbone; they do not invent separate upload/download paths.

Canonical storage table:

```sql
project_assets (
    id                    TEXT PRIMARY KEY,
                          -- server-generated asset_<ULID>
    project_id            UUID NOT NULL REFERENCES projects(id),
    asset_kind            TEXT NOT NULL,
                          -- v1: 'datasheet' | 'site_photo' | 'hbjson'
                          -- future: 'simulation_file' | 'export_bundle' |
                          -- 'other'
    object_key            TEXT NOT NULL UNIQUE,
                          -- R2 key, e.g.
                          -- projects/{project_id}/assets/{asset_id}/file.pdf
    original_filename     TEXT NOT NULL,
    display_name          TEXT NOT NULL,
    content_type          TEXT NOT NULL,
    size_bytes            BIGINT NOT NULL,
    content_hash_sha256   TEXT NOT NULL,
    r2_etag               TEXT,
    upload_status         TEXT NOT NULL DEFAULT 'pending',
                          -- 'pending' | 'uploaded' | 'failed'
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by            UUID NOT NULL REFERENCES users(id),
    uploaded_at           TIMESTAMPTZ,
    deleted_at            TIMESTAMPTZ,
    deleted_by            UUID REFERENCES users(id),
    metadata              JSONB NOT NULL DEFAULT '{}'::jsonb
)
CREATE INDEX ON project_assets (project_id, asset_kind)
  WHERE deleted_at IS NULL AND upload_status = 'uploaded';
CREATE INDEX ON project_assets (project_id, content_hash_sha256)
  WHERE deleted_at IS NULL;
```

Rules:

- Uploaded file bytes are immutable. New file content means a new
  `project_assets` row and a new R2 object.
- Project documents store only asset ids, e.g.
  `project_materials[].datasheet_asset_ids[]`,
  `assembly.segments[].photo_asset_ids[]`, and future
  `thermal_bridges[].simulation_file_asset_ids[]`.
- HBJSON files use the same `project_assets` row with
  `asset_kind = 'hbjson'`; `project_hbjson_files` is a subtype
  metadata table keyed to `asset_id` for viewer labels, notes, optional
  `project_version_id`, and cached geometry/extraction fields (§11.4.2).
- Uploads are direct-to-R2 through short-lived signed PUT URLs. The API
  creates a pending asset row, returns the signed upload URL, and marks
  the asset `uploaded` after the client/agent completes the upload.
- Downloads are short-lived signed GET URLs. APIs never expose R2
  credentials or durable public object URLs.
- Viewers may resolve signed download/view URLs for assets that
  are referenced by public project surfaces. They cannot create, rename,
  attach, detach, or delete assets.
- MCP tokens require `asset:read` to resolve signed download URLs and
  `asset:write` to create upload intents, complete uploads, or attach /
  detach assets through draft JSON-Patch operations.
- Content-hash dedup is advisory in MVP: if an uploaded file's
  `(project_id, asset_kind, content_hash_sha256)` already exists, the
  API returns the existing asset plus a `duplicate_of` warning instead
  of silently creating a second active asset.
- "Delete" in a material/photo UI first means **detach from the active
  draft** by removing the asset id from the relevant array. The asset
  row remains available to older saved versions and other references.
- Asset hard purge is a background GC concern. A file can be purged only
  when it is soft-deleted or failed/pending-expired **and** no saved
  version or active draft references its asset id. Default retention for
  purge candidates is 90 days.

## 7. Catalog (bookshelf model)

### 7.0 Catalog roster

V2 v1 ships **three catalogs**, all global and shared across projects:

- **Materials** (assembly layer materials)
- **Window-Frame Elements**
- **Window-Glazing**

Future catalogs (post-v1, code-and-deploy events; see US-2 for the
full roster):

| Catalog | Sub-types stored as `sub_category` column |
|---|---|
| ERV units | — |
| Pumps | — |
| Fans | extract-for-trash, kitchen, laundry, other |
| Appliances | fridge, dishwasher, etc. |
| Hot-Water Heaters | heat-pump, direct-elec, gas |
| Hot-Water Storage Tanks | — |
| Heat-Pumps (heating/cooling) | — |
| Direct-Elec Heaters | backup unit-heaters |
| Boilers | gas, oil, elec |

All catalogs follow the same data-model pattern (§7.2), the same
bookshelf semantics (§7.1), and the same per-project refresh UX
(§7.4). One UI component family covers them all.

### 7.1 Mental model

The catalog is a **curated starting library**. When a user picks a
catalog entry into a project, the values are **copied** into the project
document. The project from then on owns its copy. Catalog edits do not
propagate to projects automatically.

A `catalog_origin` block on each copied entry records where it came from
(table, record id, version id, synced_at, local_overrides) so the
**refresh-from-catalog** UX can show catalog drift, preserve intentional
project-specific edits, and offer per-entry refresh.

### 7.2 Catalog has versions, projects don't reference them live

Catalog entries are versioned for the **catalog's own organization** —
e.g. "Skyline Ridge frame, 2024 spec" and "Skyline Ridge frame, 2026
spec" coexist as two versions of the same identity row. The user can
pick either when adding to a project. Once picked, the values are copied
in and the project no longer cares which version was the source.

```sql
catalog_materials (
    id              TEXT PRIMARY KEY,         -- stable identity slug or rec id
    name            TEXT NOT NULL,
    category        TEXT NOT NULL,
    current_version_id  TEXT REFERENCES catalog_material_versions(id),
                    -- the default version offered to new picks
    deleted_at      TIMESTAMPTZ,              -- soft delete only
    created_at, created_by, updated_at, updated_by
)

catalog_material_versions (
    id              TEXT PRIMARY KEY,
    record_id       TEXT NOT NULL REFERENCES catalog_materials(id),
    version_label   TEXT NOT NULL,            -- e.g. "2024 spec"
    version_date    DATE NOT NULL,
    -- typed value columns (matching V1's Material today):
    conductivity_w_mk     FLOAT,
    density_kg_m3         FLOAT,
    specific_heat_j_kgk   FLOAT,
    emissivity            FLOAT,
    argb_color            TEXT,
    notes                 TEXT,
    source_provenance     TEXT,
    created_at, created_by
)
```

Frame types and glazing types follow the same identity-plus-versions
pattern. Catalog audit log records all edits.

### 7.3 Catalog UX

- **List / detail / edit views** for each catalog table.
- **New version** flow when a meaningful change occurs (manufacturer
  reformulation, new datasheet). Creates a new `catalog_*_versions` row;
  identity row's `current_version_id` updates if the user marks it
  current.
- **In-place edit** allowed on the current version for small corrections
  (typo, missing value). Audit-logged.
- **Soft delete** on identity rows. Versions are never hard-deleted.

### 7.4 Refresh from catalog

A project version's editor offers, per copied entry, a "refresh from
catalog" gesture:

- UI surfaces "the catalog now says X, your project says Y" diff.
- User chooses: keep mine, take catalog's, edit a third value.
- Refresh is per-entry; no bulk auto-refresh in v1.
- Field-level local overrides are tracked in
  `catalog_origin.local_overrides` as field keys. Inline edits to a
  copied catalog field add that field key to `local_overrides`.
- In the refresh dialog, fields in `local_overrides` are tagged
  "You edited this" and default to **Keep mine**. Other changed fields
  default to **Take catalog**.
- Saving the refresh dialog requires an explicit choice for every
  changed field. It writes chosen values into the draft, updates
  `catalog_origin.catalog_version_id` to the current catalog version,
  sets `synced_at = now()`, and recomputes `local_overrides` as the
  fields whose chosen project value still differs from the current
  catalog value.
- A copied entry is **drifted** when
  `catalog_origin.catalog_version_id != current_version_id`. A copied
  entry with `local_overrides.length > 0` but current
  `catalog_version_id` is **customized**, not stale.

A "show me everything that's drifted or customized from catalog" report
lives in the catalog manager view of a project. In v1, **Review all**
opens this report with per-entry actions; it does not auto-apply
multiple entries.

### 7.5 Catalog-schema migration — post-MVP goal

Decision revised 2026-05-11: defer catalog-schema migration tooling
from MVP. Keep it as a post-MVP architectural goal.

The intended future guarantee is still valid: when a catalog's row
schema evolves after launch (field added, removed, renamed, split,
merged, or re-typed), old project snapshots should continue to
refresh-from-catalog cleanly. That future subsystem will likely mirror
the project-document migration discipline in §10.5: forward-only shims,
golden fixtures, renamed-field metadata, and a corpus drill before a
catalog schema bump.

MVP does **not** ship:

- catalog-row shim chains;
- catalog-schema golden-file corpora;
- production-corpus refresh drills;
- renamed-field diff metadata;
- added/removed/re-typed-field migration UI.

MVP does preserve a cheap future hook:

- Catalog row APIs and copied `catalog_origin` payloads include
  `catalog_schema_version: 1`.
- Refresh-from-catalog compares only current MVP field names.
- Catalog schema changes before post-MVP migration tooling exists are
  treated as code/data migration events that require manual planning.

This keeps the MVP catalog scope proportional to three v1 catalogs
(Materials, Window-Frame Elements, Window-Glazing) while avoiding a
future backfill if catalog schemas later need formal migration support.
