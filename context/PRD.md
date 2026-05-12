---
DATE: 2026-05-09
TIME: -
STATUS: CANONICAL PRD — current source of truth for PH-Navigator V2
        architecture and product direction. Supersedes the original
        project-side versioning draft and significantly reshapes the
        2026-05-06 native catalog-manager PRD. PH-Nav-V1 continues to
        run; V2 develops in parallel.
AUTHOR: Ed May (with Claude)
SCOPE: Foundational architecture for PH-Navigator V2 — a JSON-document /
       file-format-style rewrite of the project layer, with the catalog
       remaining a relational "starting library." Rebuild, not refactor.
RELATED: context/TECH_STACK.md, context/UI_UX.md, context/USER_STORIES.md,
         context/DATA_TABLE.md, context/GLOSSARY.md,
         docs/REMOVED.md (archived predecessor / removed-doc routing),
         research/poc-plans/2026-05-06-native-catalog-manager.md
         (catalog manager PRD — substantially reshaped by the bookshelf
         decision; superseded by this doc, kept as research record),
         research/poc-plans/poc-evaluation.md (catalog POC findings
         that informed the V2 direction)
---

# PH-Navigator V2 — Architecture PRD

## 1. Goal

Rebuild PH-Navigator's project layer around a **JSON-document data
model** with **versioned, immutable-by-discipline saves**. Move off
AirTable entirely; PHN owns all project data. Keep catalogs as a curated
**starting library** with explicit refresh semantics. Design every
surface (data model, API, docs, MCP) for both human and LLM use from
day one.

PH-Nav-V1 (the relational viewer-with-edits) continues to run unchanged
during V2 development. V2 is a parallel build, not a migration.

## 2. Why V2 (not V1.5)

V1's relational schema for project entities (assemblies, layers,
segments, apertures, frame/glazing types) is a legacy of its viewer
origins. The PHN-becomes-builder pivot demands:

- **Stable, immutable revisions** for certification submits and project
  close. The relational model has no native concept of this.
- **Catalog stability** for in-progress project models — vendor
  reformulations or library typo-fixes must not silently mutate
  project values.
- **A native file format** for future exchange with honeybee_ph, PHX,
  ph-dash, and Grasshopper. The relational model exports awkwardly;
  documents export trivially.
- **An LLM-amenable surface** so Ed can drive PHN from Claude (Code or
  Desktop) for bulk edits, queries, and reports. Documents + JSON
  Schema + MCP is the right substrate.

Adding versioning, document export, and an MCP layer on top of V1's
schema is achievable but accumulates duality (working tables vs. snapshot
payloads). V2 collapses the duality by making the document the source of
truth.

## 3. Non-goals (V2 v1)

- **Real-time multi-user editing** (CRDTs, presence cursors). Two-user
  team, sequential editing only. Optimistic concurrency with an "open
  elsewhere" advisory banner is sufficient.
- **Branching / merging** of project versions. Linear history.
- **Mobile / phone** optimization.
- **Public write API.** Editors are Ed and John; viewers are anyone with
  a link. No third-party write integrations in v1.
- **AirTable connectivity** at all. V2 has no AirTable surface. PH-Nav-V1
  remains for any continuing AirTable-backed workflow.
- **Cross-project queries** (e.g. "every project using Walltite ECO").
  Defer until needed; JSON documents make this a search-index problem
  later, not a JOIN problem.
- **Granular per-cell undo across sessions.** Frontend transient stack
  only. Versions are the cross-session recovery mechanism.
- **Live multi-tab editing** of the same version by the same user. A
  single tab is the editor; other tabs go read-only.
- **HBJSON authoring / editing** in PHN. The viewer is read-only. The
  3D modeling toolchain (Rhino + GH + honeybee_ph) stays external to
  PHN in V2. HBJSON upload is in scope (for the 3D viewer to render);
  HBJSON creation is not.
- **HBJSON-driven import into the builder tables.** Uploaded HBJSON
  files are **viewer-only** — they render in the Model tab (US-Viewer)
  but never write into `tables.assemblies`, `tables.project_materials`,
  `tables.rooms`, or any other builder table. PHN is the authoritative
  source for envelope / rooms / equipment data; the Rhino / Honeybee
  toolchain consumes PHN data downstream and produces HBJSON as
  output, not the other way around. Same logic for rooms (US-EQ-2)
  and assemblies (US-ENV-12). HBJSON construction *export* is in
  scope (US-ENV-12); HBJSON construction *import* is not.
- **Auto-derivation of HBJSON from builder data, or auto-derivation
  of builder data from HBJSON.** The two stay manually
  cross-referenced in V2 v1 (§11.4.6).
- **Equipment / appliance catalogs.** V2 v1 ships only the three
  envelope catalogs (Materials, Window-Frame Elements,
  Window-Glazing). The 9 deferred equipment catalogs (ERVs, Pumps,
  Fans, Appliances, Hot-Water Heaters, Hot-Water Tanks, Heat-Pumps,
  Direct-Elec Heaters, Boilers) are not in v1; full roster captured
  in §7.0 / US-2 for forward planning.

## 4. Users & access

**Access model (updated 2026-05-10):** project URLs are
**public-readable**. The same `/projects/{id}/...` routes resolve
for everyone — logged in or not. The project's UUID is effectively
the share token: share the URL with anyone (contractor, certifier,
client) and they can read the project. **No per-share tokens, no
`/v/{token}` routes, no revocation UI.** The frontend reads auth
state and gates edit affordances (toolbars, drag-drop zones, `⋯`
action menus, etc. hide when not logged in); the backend gates
writes behind the editor session token.

This matches V1's existing pattern (frontend/backend separation of
read vs write) and is much simpler than a per-share-token model.

**Decision confirmed 2026-05-11:** V2 v1 intentionally uses the
normal project URL as the public read route. There are no special
view-only URLs, no share-token rows, and no approval workflow for
viewing. Logged-in editor state only changes which controls and write
endpoints are available. This is an accepted product/security tradeoff:
project URLs should be treated as durable read-capability links, and
implementation must make write protection server-side, not merely a
frontend affordance.

- **Editors:** Ed May, John Mitchell. Authenticated users with edit
  rights on all projects. No per-project ACL in V2 v1 (two-person
  firm).
- **Project ownership** is a *dashboard-organization* concept, not an
  ACL. Each project has exactly one `owner_id` (Ed or John); the
  owner sees the project on their personal dashboard. Either editor
  can edit any project they can reach. Ownership is transferable
  (data model supports; transfer UI post-MVP).
- **Viewers:** anyone with a project URL. Read-only,
  no auth required. Can browse the project workspace (Status,
  Windows, Envelope, Equipment, Model tabs), browse versions,
  download project JSON, download table JSON, view uploaded
  HBJSON. **Cannot edit anything.** Edit affordances render hidden
  / disabled in the frontend; the backend rejects any write request
  without a valid editor session.
- **No anonymous editing.** Auth required for any write — REST,
  MCP, or otherwise.
- **No project-level permissions** beyond "editor / non-editor." A
  Viewer can reach every version of a project they
  have the URL for. Sensitive projects should not be created at all
  (or should be deleted) — there's no per-URL visibility gate.
- **Revocation model:** to "revoke access" to a project, the
  project must be soft-deleted (US-1.4). There's no per-share-link
  revocation because there are no per-share-links. This is a
  trust-based model appropriate for a two-person firm.

### 4.1 Forward-compatible access-check seam (architectural commitment)

Strict per-user ACL is **deferred** for V2 v1. To keep the future
retrofit cheap, V2 commits to the following from day 1:

- **Every project-scoped API route uses a single FastAPI dependency
  `require_project_access(project_id, mode='view'|'edit')`.** Today
  the dependency body has trivial behavior: `mode='view'` always
  passes (project URLs are public-readable per §4); `mode='edit'`
  requires a valid editor session token. It does not consult any
  per-project membership table.
- **The same dependency is used by REST routes and MCP tools.**
  Auth model stays uniform; there is one place where access policy
  lives.
- **Dashboard query is intentionally simple:**
  `WHERE owner_id = current_user.id AND deleted_at IS NULL`.
  Ownership is the dashboard filter, period.
- **Anti-patterns banned:** no inline
  `if user.id == project.owner_id` checks in routes; no project
  reads in handlers without going through the access seam.

If/when strict ACL ships:
- A `project_members` table is added (purely additive; no schema
  change to existing rows).
- The dependency body grows to consult `project_members` after the
  authentication check.
- The dashboard query grows a "shared with me" section.
- **Route signatures and call sites do not change.** The retrofit
  is one function and one query — not a sweep across every route.

This is a 10-line discipline that protects the architecture without
adding MVP cost. See US-1.5 for the user-facing framing.

## 5. Architecture overview

```
┌─────────────────────┐        ┌──────────────────────────────────┐
│  React frontend     │        │  FastAPI backend                  │
│  (TypeScript)       │ ──────▶│                                   │
│                     │        │  ┌────────────────────────────┐  │
│  - Editor UI        │        │  │ REST API                    │  │
│  - Catalog manager  │        │  │ + OpenAPI spec              │  │
│  - Version panel    │        │  │ + JSON Schemas              │  │
│  - Diff view        │        │  └────────────────────────────┘  │
│  - View-only mode   │        │                                   │
└─────────────────────┘        │  ┌────────────────────────────┐  │
                               │  │ MCP server (v1, read/write │  │
┌─────────────────────┐        │  │ project-scoped tokens)     │  │
│  LLM clients        │ ──────▶│  └────────────────────────────┘  │
│  (Claude Code/      │        └─────────────┬─────────────────────┘
│   Desktop, etc.)    │                      │
└─────────────────────┘                      │
                                ┌────────────┴──────────────────┐
                                │  Postgres (Render managed)     │
                                │  - thin relational metadata    │
                                │  - project_versions.body JSONB │
                                │  - catalog tables              │
                                └────────────────────────────────┘
                                              │
                                ┌─────────────┴──────────────────┐
                                │  Cloudflare R2 / object store  │
                                │  - photos, datasheets          │
                                │  - export downloads (cached)   │
                                └────────────────────────────────┘
```

Two storage classes:
- **Postgres** — all structured data. Project metadata is relational;
  project bodies are JSONB columns on `project_versions`. Catalog is
  fully relational.
- **Object storage (R2)** — photos, datasheets, future export artifacts.
  Referenced by URL from the project document.

Three API surfaces, all backed by the same FastAPI service:
- **REST API** for the frontend.
- **OpenAPI + JSON Schema** documents published at well-known endpoints.
- **MCP server** for LLM clients, wrapping the REST surface.

## 6. Data model

### 6.1 Relational layer (thin)

```sql
users (
    id                 INTEGER PRIMARY KEY,
    email              TEXT NOT NULL UNIQUE,
    name               TEXT NOT NULL,
    password_hash      TEXT NOT NULL,
                       -- Argon2id hash. Parameters are pinned in
                       -- backend Settings; bcrypt cost >= 12 is the
                       -- only allowed fallback if Argon2id creates
                       -- install friction during scaffold.
    units_preference   TEXT NOT NULL DEFAULT 'SI',
                       -- 'IP' | 'SI'; toggled from the project header,
                       -- applies wherever values render
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    deactivated_at     TIMESTAMPTZ
)

-- Server-side sessions. Required for single-active-session-per-user
-- semantics (§13). HTTP-only cookie carries the session id; server
-- looks up the row on every authenticated request.
sessions (
    id              UUID PRIMARY KEY,
                    -- cryptographically random UUIDv4 referenced by
                    -- the session cookie
    user_id         INTEGER NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
                    -- updated on every authenticated request; expiry
                    -- is computed as last_seen_at + 60 min
    invalidated_at  TIMESTAMPTZ,
                    -- NULL = active. Set when the session ends:
                    -- explicit sign-out, idle timeout, or
                    -- superseded_by_new_login.
    invalidated_reason  TEXT,
                    -- 'sign_out' | 'idle_timeout' |
                    -- 'superseded_by_new_login' | 'admin_revoked'
    ip_address      INET,
    user_agent      TEXT
)
CREATE UNIQUE INDEX sessions_one_active_per_user
    ON sessions (user_id) WHERE invalidated_at IS NULL;
CREATE INDEX ON sessions (last_seen_at) WHERE invalidated_at IS NULL;

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
    owner_id           INTEGER NOT NULL REFERENCES users(id),
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
    user_id         INTEGER NOT NULL REFERENCES users(id),
                    -- editor who issued the token; actions performed
                    -- with the token are attributed to this user
    project_id      UUID NOT NULL REFERENCES projects(id),
                    -- v1 tokens are project-scoped. All-project /
                    -- workspace-scoped tokens defer until there is a
                    -- concrete agent workflow that needs them.
    name            TEXT NOT NULL,
                    -- user-facing label, e.g. "Claude Desktop - Foo"
    token_prefix    TEXT NOT NULL,
                    -- first 8-12 chars for UI identification only
    token_hash      TEXT NOT NULL UNIQUE,
                    -- hash of the full token; plaintext is never
                    -- stored after initial issue
    scopes          TEXT[] NOT NULL DEFAULT ARRAY['project:read', 'project:write'],
                    -- allowed values in v1:
                    -- 'project:read' | 'project:write' | 'asset:read' |
                    -- 'asset:write'. Catalog writes are not included.
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
                    -- nullable in v1; UI should encourage expiry but
                    -- not require it for local Claude workflows
    revoked_at      TIMESTAMPTZ,
    revoked_by      INTEGER REFERENCES users(id)
)
CREATE INDEX ON mcp_tokens (project_id) WHERE revoked_at IS NULL;
CREATE INDEX ON mcp_tokens (user_id) WHERE revoked_at IS NULL;

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
    created_by      INTEGER REFERENCES users(id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      INTEGER REFERENCES users(id),
    deleted_at      TIMESTAMPTZ
)
CREATE INDEX ON project_status_items (project_id, order_index)
    WHERE deleted_at IS NULL;

-- Per-user dashboard preferences. Pinning and ordering are personal,
-- so they live here rather than on `projects`.
user_project_preferences (
    user_id     INTEGER NOT NULL REFERENCES users(id),
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
    user_id      INTEGER REFERENCES users(id),
                 -- nullable for failed logins before user lookup
    action       TEXT NOT NULL,
                 -- 'login', 'login_failed', 'project_create',
                 -- 'version_save', 'hbjson_upload', 'catalog_record_*',
                 -- ... (full enum in
                 -- `context/user-stories/50-settings-ops-llm.md` §C-1)
    project_id   UUID REFERENCES projects(id),
    target_type  TEXT,
    target_id    TEXT,
    metadata     JSONB,
    ip_address   INET,
    user_agent   TEXT,
    at           TIMESTAMPTZ NOT NULL DEFAULT now()
)
CREATE INDEX ON user_action_log (user_id, at DESC);
CREATE INDEX ON user_action_log (project_id, at DESC);
CREATE INDEX ON user_action_log (action, at DESC);

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
    created_by        INTEGER REFERENCES users(id),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by        INTEGER REFERENCES users(id),
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
  download is a slice of this shape.
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
No relational shadow. Schema for each table is defined in
`backend/features/project/document/tables/` as a Pydantic model. Adding
a new table type is a code change (Pydantic model + frontend column
config), not a schema migration.

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
    created_by            INTEGER NOT NULL REFERENCES users(id),
    uploaded_at           TIMESTAMPTZ,
    deleted_at            TIMESTAMPTZ,
    deleted_by            INTEGER REFERENCES users(id),
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

## 8. Save / version model

### 8.1 Mental model — explicit Save / Save As (file-app style)

A project has a list of named **versions**. The user opens one version
at a time. Edits flow into a **session draft** held by the frontend and
mirrored to a server-side draft buffer; they do **not** modify the
version body. To persist, the user explicitly clicks:

- **Save** — overwrite the active version's body with the draft.
- **Save As** — create a new version from the draft, switch active.

This is the Word / Photoshop / classic-desktop-app model. Autosave is a
**crash-recovery backup**, not a persistence step. Closing the browser
with unsaved changes triggers a `beforeunload` warning. On reopen, the
user is offered the recovered draft ("you had unsaved changes from
2026-05-09 14:23 — restore or discard?").

For high-stakes versions (cert submits), the user can **lock** a
version. Save against a locked version returns 409 with a prompt to
Save As. To edit a locked version, the user must Save As into a new
unlocked version.

### 8.2 Operations

| Operation | Effect |
|---|---|
| **Edit** | Mutates frontend in-memory document. Patch ops sync to server-side draft buffer (debounced, ~500ms). Version body untouched. |
| **Save** | Flush draft to active version body. Lock check: locked → 409 with Save-As suggestion. Clear draft. |
| **Save As** | Create new `project_versions` row from draft body; set as active version. User supplies name. Clear draft. |
| **Discard changes** | Drop draft, reload version body. Confirm dialog. |
| **Switch active version** | If draft is dirty, prompt: Save / Save As / Discard. Then switch. |
| **Lock / unlock** | Toggle `locked` on a version. Lock = save-protected. Unlock requires confirm. |
| **Submit / close** | Save As with `kind='submitted'`/`'closed'`, auto-locked. Lifecycle is metadata on the version. |
| **Delete version** | Soft-delete (`deleted_at`). Cannot delete the active version; switch first. |
| **Rename version** | Update `name`. Allowed even on locked versions (label-only). |

There is no single project-level "lifecycle state." The project's
status is "the kind of its most recent submitted/closed version, if
any." Versions are the unit of state.

### 8.2.1 Denormalized save metadata

Decision confirmed 2026-05-11: denormalized version metadata is owned
by the service layer, not database triggers.

The version-save service is the only code path allowed to insert or
overwrite `project_versions.body`. Repository modules should expose
specific Save / Save As helpers, not generic "update body" functions.

On **Save**, one transaction:

- validates draft body, lock state, and ETags;
- overwrites `project_versions.body`;
- sets `project_versions.schema_version`;
- computes and sets `project_versions.body_size_bytes`;
- sets `project_versions.updated_at` / `updated_by`;
- sets `projects.last_saved_at` to the same timestamp;
- deletes the server-side draft;
- appends the action-log event.

On **Save As**, one transaction:

- validates draft body and ETags;
- inserts the new `project_versions` row with computed
  `body_size_bytes`;
- sets the new row as `projects.active_version_id`;
- sets `projects.last_saved_at` to the same timestamp;
- deletes the source draft;
- appends the action-log event.

Draft patch, view-state changes, status edits, HBJSON uploads, asset
uploads, and catalog edits do not update `projects.last_saved_at`.
Tests must cover that Save / Save As update the denormalized fields and
draft patch does not.

### 8.3 Server-side draft buffer (crash-recovery, not persistence)

```sql
project_version_drafts (
    version_id          UUID NOT NULL REFERENCES project_versions(id),
    user_id             INTEGER NOT NULL REFERENCES users(id),
    body                JSONB NOT NULL,     -- WIP document
    schema_version      INTEGER NOT NULL,
    base_version_etag   TEXT NOT NULL,
                         -- saved version etag when the draft was created
    draft_etag          TEXT NOT NULL,
                         -- changes on every accepted draft mutation
    last_patched_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_via         TEXT NOT NULL DEFAULT 'browser',
                         -- 'browser' | 'mcp'
    PRIMARY KEY (version_id, user_id)
)
```

Properties:
- One draft per `(version_id, user_id)`. Different users editing the
  same version each have their own draft (rare in practice; single-user
  expectation per §4). Browser edits and MCP edits issued by the same
  editor token share the same draft for the same version.
- Frontend and MCP post JSON-Patch ops → backend applies to the draft
  body. Server is authoritative.
- Drafts are **not** versions: they don't appear in version lists or
  the diff `from`/`to` selectors.
- Save: server reads draft body → writes to version body in one
  transaction → deletes draft.
- Save As: server reads draft body → INSERTs new version → deletes
  draft.
- Discard: deletes draft.
- Stale-draft GC: drafts untouched for >30 days are deleted by a
  scheduled job. (User is warned on reopen if a draft is older than
  N days; configurable.)
- Frontend on load: GET draft for active version. If draft exists and
  differs from version body, show recovery prompt. User chooses
  restore (load draft) or discard (delete draft, load version body).
- Opening a project does not create a draft row. The first accepted
  mutation creates the draft lazily from the saved version body and
  records `base_version_etag`.
- Table/entity JSON-Patch operations must be guarded with stable-id
  `test` ops before mutating array positions. Unguarded array mutation
  is rejected with `unguarded_array_patch`. MCP helpers should prefer
  higher-level table/row tools that generate safe patches.

The draft/save state machine is consolidated here in §§8.3–8.6. The
former standalone decision note is archived in `docs/REMOVED.md`.

### 8.4 Diff

Two diff surfaces, both v1:

- **Version vs version** — pick two versions, see field-level changes
  across all tables.
- **Live vs last save** — while editing the active version, see what's
  changed since the parent version was forked. (Cheap to implement: the
  parent's body is the baseline.)

Diff is computed in the backend from the two JSONB bodies. UI displays
a per-table changed-row list with field-level deltas.

### 8.5 Concurrency

PHN is optimized for sequential editing by a tiny team, but the same
editor may legitimately have multiple browser tabs open against one
project. Example: Window-Frame Element catalog in one tab while the
project Windows builder is open in another, or Rooms in one project
workspace tab and Windows in another. V2 must support this without a
global "takeover" lock.

Implementation:

- **Draft writes:** patches send `If-Match: <draft_etag>` when a draft
  exists, and `If-Match-Version: <version_body_etag>` when creating a
  draft. Mismatch → 409. Client reloads the draft or discards local
  queued edits; v1 does not merge.
- **Save / Save As:** sends `If-Match: <version_body_etag>` taken at draft
  open. Mismatch (someone else saved over the version while this user
  was drafting) → 409 for Save. Save As remains allowed because it does
  not overwrite the source version. Conflict UI: keep my draft as Save
  As / discard my draft / show diff.
- **Same-editor browser tabs are allowed.** A second browser tab opening
  the same project/version loads the same server draft and remains
  editable. Tabs coordinate accepted browser patches and new
  `draft_etag` values through a browser-tab channel (BroadcastChannel or
  equivalent). If a received patch is outside the current tab's active
  UI scope, apply it in memory and continue. If it overlaps the active
  dirty scope, freeze that scope and show a reload/review banner; v1
  does not attempt field-level merge.
- **MCP/browser collision policy.** MCP mutating tools share the token
  issuer's draft, but MCP writes acquire a short draft edit lease. While
  the lease is active, open browser editors show an "MCP editing" visual
  indicator and freeze write controls. After the MCP write completes,
  the browser does not silently merge into an active editor: it shows a
  banner offering Review changes / Reload draft. Read-only navigation
  and viewing remain available during the lease.
- **MCP token revocation.** Revocation blocks the token's next request.
  A request that already passed auth may complete atomically; PHN does
  not promise to cancel an in-flight DB transaction. Any follow-up or
  commit step (for example `complete-upload`, `attach_asset`,
  `save_draft`) must re-check token state and return a structured auth
  error if revoked.
- **Lock while a draft is open.** Locking a version is authoritative
  immediately. Any open browser or MCP draft for that version is
  preserved, but further draft patch and Save requests return
  `409 version_locked`. Browser tabs downgrade to the locked-version
  banner on the next lock-status poll, broadcast, or rejected write.
  The user's exit paths are Save As into a new unlocked version,
  discard, or wait for an explicit unlock.
- **Version switch after dirty-draft Save.** When a user chooses Save in
  the dirty-draft prompt before opening another version, the frontend
  does not switch its current view until the target version body has
  been fetched successfully. If Save succeeds but the target fetch
  fails, the user remains on the saved source version in a clean state
  with a retryable "couldn't open target version" toast.
- **Whole-draft ETag for table replacement.** `replace_table` is not
  table-scoped concurrency in v1. It consumes and bumps the same
  `draft_etag` as JSON-Patch. If two clients replace unrelated tables
  from the same base ETag, the first wins and the second receives 409.
  The loser must refetch and retry intentionally.
- Locked versions reject draft patch and Save with `409 version_locked`.
  Save As from a locked version is allowed and creates a new unlocked
  copy unless the user explicitly chooses locked.

This is sufficient for two-person sequential workflow; no document
locks or merge UI needed in v1.

### 8.6 Draft / save acceptance tests

MVP backend tests must cover:

- first patch lazily creates a draft;
- draft ETag mismatch returns 409 and preserves the stored draft;
- Save deletes the draft and updates the version body;
- Save against a locked version returns 409;
- Save As from a locked version succeeds;
- stale Save returns 409 and preserves the draft;
- unguarded array patch returns 400;
- guarded stale-index patch fails closed;
- same-editor browser tabs can edit disjoint UI scopes against one draft;
- same-scope browser-tab conflicts freeze the stale tab and preserve its
  local edits until reload/review;
- MCP edit lease freezes browser write controls and surfaces a visual
  indicator;
- MCP token revocation blocks the next token request and blocks any
  post-upload/commit step after revocation;
- locking a version with open drafts rejects subsequent draft patch and
  Save requests while preserving the drafts for Save As / discard;
- dirty-draft Save before version switch does not switch the visible
  version until the target body fetch succeeds;
- stale `replace_table` returns 409 even when the prior accepted write
  touched a different table;
- MCP token patch uses the issuer's `(version_id, user_id)` draft;
- session-cookie and MCP writers conflict through the same ETag rules.

## 9. API surface

REST, OpenAPI-documented, served by FastAPI. JSON throughout.

### 9.1 API versioning policy (day 1)

All endpoints live under a versioned prefix: `/api/v1/...`. Hard rules:

- **No unversioned routes.** `/api/foo` does not exist; only `/api/v1/foo`.
- **Breaking changes ship as `/api/v2/...`.** v1 stays live alongside
  for a deprecation window (minimum: until all known clients are
  migrated; for V2 v1, "all known clients" is the V2 frontend and the
  MCP server, both controlled by us).
- **Additive changes (new fields, new endpoints) stay in `/api/v1`.**
  Removing or renaming a field is breaking; adding one is not.
- **OpenAPI per version.** `/api/v1/openapi.json`, `/api/v2/openapi.json`.
- **Document body schema versioning is independent** from API
  versioning. `/api/v1` may serve project documents at
  `schema_version: 1` *or* `schema_version: 2`; clients that don't
  know v2 must check and refuse, or upgrade. See §10.5.
- **Deprecation marking.** Endpoints scheduled for removal carry a
  `Deprecation: true` response header and an entry in
  `/api/v1/deprecations`.

This costs ~zero on day 1 (just a router prefix) and saves real pain
later.

### 9.2 Projects

```
GET    /api/v1/projects                         list (filtered by ownership)
POST   /api/v1/projects                         create (creates "Working" v0)
GET    /api/v1/projects/{id}                    metadata + version list
PATCH  /api/v1/projects/{id}                    rename, edit metadata,
                                                transfer ownership
DELETE /api/v1/projects/{id}                    soft delete
GET    /api/v1/projects/check-bt-number?value=X is this BT number available?
                                                returns {available: bool,
                                                         conflict?: {id, name}}
```

The list endpoint applies the dashboard filter (`owner_id = me`) by
default; query param `?scope=all` returns all projects the user can
access (today: same as default for editors). `check-bt-number` is
debounced from the new-project form (US-1.3) for live availability
feedback.

### 9.3 Versions

```
GET    /api/v1/projects/{pid}/versions                         list
POST   /api/v1/projects/{pid}/versions                         save-as-new (clone)
GET    /api/v1/projects/{pid}/versions/{vid}                   metadata
PATCH  /api/v1/projects/{pid}/versions/{vid}                   rename, lock, set-active
DELETE /api/v1/projects/{pid}/versions/{vid}                   soft delete
```

### 9.4 Document body (the editing surface)

```
GET    /api/v1/projects/{pid}/versions/{vid}/document                full JSON
                                                                     (current saved body)
GET    /api/v1/projects/{pid}/versions/{vid}/document/tables/{name}  one table slice
```

Saved document endpoints are read-only in the normal editor/API
surface. User and MCP writes go through the draft endpoints below; the
saved version body changes only via `draft/save` or `draft/save-as`.
Import/admin scripts may call internal service functions, but there is
no public whole-body `PUT /document` Save in v1.

### 9.5 Drafts (autosave / crash recovery)

```
GET    /api/v1/projects/{pid}/versions/{vid}/draft                   current user's draft
                                                                     body (404 if none)
PATCH  /api/v1/projects/{pid}/versions/{vid}/draft                   apply JSON-Patch ops
                                                                     to draft body
PUT    /api/v1/projects/{pid}/versions/{vid}/draft/tables/{name}      replace one table
                                                                     in the draft
DELETE /api/v1/projects/{pid}/versions/{vid}/draft                   discard draft
POST   /api/v1/projects/{pid}/versions/{vid}/draft/save              flush draft → version
                                                                     body (the "Save" gesture)
POST   /api/v1/projects/{pid}/versions/{vid}/draft/save-as           flush draft → new
                                                                     version (the "Save As"
                                                                     gesture); body = name,
                                                                     kind, locked
```

All mutating REST writes accept `Idempotency-Key`. Replay semantics:

- scope = `(user_id, route, key)`;
- TTL = 24 hours from first completed response;
- replay after completion returns the cached response body and status;
- same key with a different body on the same route returns
  `409 idempotency_key_reuse`;
- in-progress duplicate requests return `409 idempotency_in_progress`.

Draft writes additionally use `If-Match` / `If-Match-Version` ETags as
defined in §8.5 and the state-machine note.

### 9.6 Diff

```
GET /api/v1/projects/{pid}/diff?from=<vid>&to=<vid>          version vs version
GET /api/v1/projects/{pid}/diff?from=<vid>&to=draft          version vs current user draft
```

Returns structured per-table delta.

### 9.7 Downloads

```
GET /api/v1/projects/{pid}/versions/{vid}/download                          project JSON
GET /api/v1/projects/{pid}/versions/{vid}/download/tables/{table_name}      table JSON
```

Returns `application/json` with `Content-Disposition: attachment`.

### 9.8 Catalog

```
GET    /api/v1/catalog/{table}                              list records
POST   /api/v1/catalog/{table}                              create record
GET    /api/v1/catalog/{table}/{rid}                        record + version list
POST   /api/v1/catalog/{table}/{rid}/versions               create new version
PATCH  /api/v1/catalog/{table}/{rid}/versions/{vid}         in-place edit (current only)
DELETE /api/v1/catalog/{table}/{rid}                        soft delete record
```

### 9.9 Public links

**Removed 2026-05-10.** Per the updated §4 access model, there are
no per-share tokens, no `/v/{token}` routes, and no public link
create / revoke endpoints. Project URLs (`/projects/{id}/...`) are
public-readable for all visitors; the backend gates writes behind
the editor session token, and the frontend gates edit affordances
by auth state. There is nothing to manage at the public link level
because public links don't exist as a separate concept.

### 9.10 Assets

Generic asset endpoints are the only upload/download backbone. Domain
routes may wrap them, but they do not store independent object keys.

```
GET    /api/v1/projects/{pid}/assets?kind=<asset_kind>          list metadata
POST   /api/v1/projects/{pid}/assets/upload-intent              create pending
                                                                  asset row and
                                                                  signed PUT URL
POST   /api/v1/projects/{pid}/assets/{aid}/complete-upload      verify object,
                                                                  mark uploaded
GET    /api/v1/projects/{pid}/assets/{aid}                      metadata
PATCH  /api/v1/projects/{pid}/assets/{aid}                      rename/edit
                                                                  display metadata
DELETE /api/v1/projects/{pid}/assets/{aid}                      soft delete if
                                                                  not actively
                                                                  referenced
GET    /api/v1/projects/{pid}/assets/{aid}/download             stable PHN route;
                                                                  redirects to
                                                                  signed R2 URL
GET    /api/v1/projects/{pid}/assets/{aid}/url                  signed GET URL +
                                                                  expires_at
POST   /api/v1/projects/{pid}/assets/{aid}/attach               JSON-Patch attach
                                                                  into current
                                                                  user's draft
POST   /api/v1/projects/{pid}/assets/{aid}/detach               JSON-Patch detach
                                                                  from current
                                                                  user's draft
```

`upload-intent` body includes `asset_kind`, `original_filename`,
`content_type`, `size_bytes`, `content_hash_sha256`, and optional
`display_name` / feature metadata. The backend validates kind-specific
size and MIME rules before signing. The signed URL is short-lived
(minutes, not hours) and scoped to the exact R2 object key.

`complete-upload` confirms the object exists in R2, records `r2_etag`,
sets `upload_status = 'uploaded'`, and writes an action-log event. Failed
or abandoned pending rows are GC candidates.

`download` is the stable link to place in rendered Markdown or UI anchors;
it performs access checks, then redirects to a short-lived signed R2 URL.
`url` is for clients that need the signed URL JSON envelope directly
(viewer fetches, MCP tools, and batch download flows).

`attach` and `detach` are convenience wrappers around the draft JSON-Patch
API. They require `project:write` plus `asset:write`, obey the same ETag
rules as other draft writes, and only mutate asset-id arrays in the
project document. They do not mutate saved versions directly.

### 9.11 HBJSON files

```
GET    /api/v1/projects/{pid}/hbjson-files                   list (metadata only)
POST   /api/v1/projects/{pid}/hbjson-files                   create HBJSON metadata
                                                             from uploaded asset_id
                                                             + label/notes +
                                                             optional
                                                             project_version_id
GET    /api/v1/projects/{pid}/hbjson-files/{fid}             metadata
PATCH  /api/v1/projects/{pid}/hbjson-files/{fid}             rename, edit notes,
                                                             link/unlink project_version_id
DELETE /api/v1/projects/{pid}/hbjson-files/{fid}             soft delete
GET    /api/v1/projects/{pid}/hbjson-files/{fid}/download    redirect to signed R2 URL
                                                             (Content-Disposition:
                                                             attachment)
GET    /api/v1/projects/{pid}/hbjson-files/{fid}/url         JSON: signed R2 URL +
                                                             expires_at (for the viewer
                                                             to fetch directly)
```

HBJSON bytes are uploaded through the generic asset endpoints with
`asset_kind = 'hbjson'`. The `POST /hbjson-files` route links an
uploaded asset to the viewer metadata row and starts HBJSON summary
extraction. Max file size cap is 50 MB by default (open question
§17 #15). HBJSON schema version, if discoverable from the file, is
stored in the metadata row.

### 9.12 Schemas

```
GET /api/v1/schemas/project-document/v1.json
GET /api/v1/schemas/material/v1.json
GET /api/v1/schemas/window-type/v1.json
GET /api/v1/schemas/room/v1.json
GET /api/v1/openapi.json
```

All schemas are auto-generated from Pydantic models. The `v1.json`
suffix is the *document schema* version, independent of the API
version (see §10.5).

## 10. LLM-friendliness — designed in from day 1

### 10.1 Why this matters

Ed already drives bulk operations on PHN data via Claude (Code, Desktop)
and will increasingly want to: "in Project Foo, update every Material in
the Wall A assembly to use Walltite ECO version 2026"; "list every room
in Project Bar with occupancy > 4"; "diff the cert submit between
rounds 1 and 2 and summarize what changed for the certifier response."
Building this in retroactively is expensive; building it in from the
start is cheap.

### 10.2 What makes V2 LLM-friendly

| Property | Implementation |
|---|---|
| **Whole-document fetch** | One GET returns the full project. LLM has full context. |
| **Stable IDs** | Every entity has a ULID; LLM can reference precisely across edits. |
| **JSON Schema published** | LLM can validate edits before submitting; server rejects invalid. |
| **JSON-Patch writes** | LLM expresses edits as a list of ops; surgical, idempotent with key. |
| **OpenAPI spec** | LLM tools can introspect the API. |
| **Structured errors** | Validation errors include JSON Pointer paths and machine-readable codes. |
| **Idempotency keys** | LLM retries don't double-apply. |
| **Hand-written context docs** | `context/` folder targeted at LLMs (see §10.4). |
| **MCP server** | First-class tool surface for Claude clients. |

### 10.3 MCP server

Ships in v1 and is **read/write capable from day 1**. Lives at
`backend/features/mcp/`. Thin wrapper around the REST API; it uses the
same service layer and `require_project_access(project_id,
mode='view'|'edit')` dependency as REST routes.

MCP auth is **not anonymous**, even though normal project URLs are
public-readable in the browser. MCP clients authenticate with
project-scoped bearer tokens from `mcp_tokens` (§6.1). Tokens are issued
by logged-in editors, shown once, stored hashed, revocable, and
audit-logged. A token with `project:write` scope can mutate only its
own `project_id`; a token with read-only scopes cannot call mutating
tools. All tool calls are attributed to the issuing editor. Mutating
tools obey the MCP/browser edit-lease rules in §8.5.

Tool surface (initial):

```
list_projects()                      → token-visible projects
                                        (v1 project-scoped token returns one)
get_project(project_id)              → metadata + version list
list_versions(project_id)            → [{id, name, kind, locked, ...}]
get_document(project_id, version_id) → full project JSON + version_body_etag
                                       + current draft_etag if present
update_document(project_id, version_id, json_patch, draft_etag | base_version_etag)
                                     → applies JSON-Patch to current draft,
                                       returns new draft etag
replace_table(project_id, version_id, table_name, rows, draft_etag | base_version_etag)
                                     → replace one table in the draft;
                                       stale etag returns 409
query_table(project_id, version_id, table_name, query)
                                     → filtered subset of one table using
                                       a typed query object, not expression text
diff_versions(project_id, from_version_id, to_version_id)
                                     → structured diff
list_catalog(table)                  → catalog browse
get_catalog_record(table, record_id) → record + version list
create_version(project_id, source_version_id, name, kind?)
                                     → save-as-new
save_draft(project_id, version_id)   → flush token owner's draft to version
discard_draft(project_id, version_id)
                                     → discard token owner's draft
update_project(project_id, patch)    → edit relational project metadata
download_project_json(project_id, version_id)
                                     → project JSON (via signed URL or inline)
download_table_json(project_id, version_id, table_name)
                                     → table JSON
list_hbjson_files(project_id)        → metadata only (file list)
get_hbjson_file_url(project_id, hbjson_file_id)
                                     → signed R2 URL + expires_at
                                       (LLM can fetch the body itself if needed)
create_asset_upload_intent(project_id, asset_kind, filename, content_type,
                           size_bytes, content_hash)
                                     → asset id + signed PUT URL + expires_at
complete_asset_upload(project_id, asset_id)
                                     → uploaded asset metadata
get_asset_url(project_id, asset_id)  → signed GET URL + expires_at
attach_asset(project_id, version_id, asset_id, target_path)
                                     → JSON-Patch attach into token owner's draft
detach_asset(project_id, version_id, asset_id, target_path)
                                     → JSON-Patch detach from token owner's draft
```

Tools return Pydantic-validated structured results.

MCP and REST share one structured-error baseline, but V2 planning does
not predefine an exhaustive error taxonomy. Before the first MCP write
tool ships, the backend must have a common error envelope with at least
`code`, `message`, `request_id`, and a coarse `recoverability` value.
Route/tool-specific `details`, `next_action` hints, and final code names
are defined as the implementation lands. MCP tools should return
recoverable domain failures in this structured shape where the protocol
allows; reserve hard protocol/runtime failures for malformed tool calls,
unhandled server errors, or infrastructure failure.

Browser behavior for MCP failures follows the same minimal rule set:
release any MCP edit lease, preserve local browser edits, keep the
browser from silently applying failed/partial MCP state, and surface a
concise banner or toast with the request id when the open project/draft
was affected.

`query_table` uses a constrained Pydantic query model. It does **not**
accept SQL-like text, JSONPath, Python expressions, or any other
string language that could be evaluated. The query shape is intentionally
small and LLM-friendly:

```
{
  "query": "optional substring / fuzzy text search",
  "where": {
    "and": [
      {"field": "frame_type_id", "op": "is_empty"},
      {"field": "orientation", "op": "in", "value": ["north", "east"]}
    ]
  },
  "sort": [{"field": "area_m2", "dir": "desc"}],
  "limit": 50,
  "offset": 0
}
```

Supported `where` nodes are `and`, `or`, and simple field comparisons.
Initial operators are `eq`, `neq`, `lt`, `lte`, `gt`, `gte`, `in`,
`contains`, `is_empty`, and `is_not_empty`. Fields are validated against
the table schema / field registry before execution; operators are
validated against the resolved field type; `limit` has a server-side
default and hard maximum. Results return compact row summaries plus
stable row targets for follow-up calls:

```
{
  "matches": [
    {
      "row_id": "win_...",
      "row_target": {
        "type": "table_row",
        "table_name": "windows",
        "row_id": "win_..."
      },
      "summary": {"name": "W-101", "area_m2": 2.4}
    }
  ]
}
```

This follows the same broad pattern observed in the Ladybug Tools MCP:
domain-specific search tools expose explicit typed parameters, simple
substring search, compact reusable targets, and strict input validation
instead of arbitrary query-language strings.

Not included in v1 (defer): catalog writes via MCP. Catalog browsing is
read-only through MCP; catalog edits stay in the web UI/admin surface
until there is a concrete agent workflow and review policy for changing
the global library. All project-document writes, project metadata
writes, and project asset attach flows are MCP-callable in v1.

### 10.4 Documentation `context/` (LLM-targeted)

`context/` is the stable reference layer. It should stay tight:
canonical product/architecture docs live here; dated working plans and
implementation phasing stay under `docs/plans/`.

Current hand-written docs:

```
context/
├── README.md                       reading order and doc routing
├── ENVIRONMENT.md                  local environment / command card
├── PRD.md                          this canonical PRD
├── TECH_STACK.md                   stack and persistence decisions
├── DATA_TABLE.md                   shared <DataTable> component contract
├── UI_UX.md                        UI narrative companion
├── USER_STORIES.md                 story routing + vertical-slice phasing map
├── user-stories/                   split canonical story bodies
├── GLOSSARY.md                     canonical PHN-V2 terms
└── schemas/
    ├── project-document-v1.json    JSON Schema (auto-generated)
    ├── material-v1.json
    ├── window-type-v1.json
    └── ...
```

Planned generated / implementation-adjacent docs, added only when the
corresponding code exists: `api.md`, `mcp.md`, `operations.md`,
`error-codes.md`, `llm-cookbook.md`, and schema files under
`context/schemas/`.

These docs are deliverables in the same way as code. CI should verify
generated schemas are in sync with Pydantic models once schema
generation exists.

### 10.5 Schema versioning — open-old-projects safety

**The hard guarantee:** a project version that was openable when it was
saved must remain openable forever. No release of PHN-V2 ships if it
breaks reads of any prior document `schema_version`.

Mechanisms — all in place from day 1, even when there is only one
schema version:

1. **`schema_version` integer in every document body.** Set at save
   time. Frozen on the row from then on.
2. **Forward-only upgrade shims.** Pure functions, one per version
   step: `upgrade_v1_to_v2.py`, `upgrade_v2_to_v3.py`, ... On read, if
   `body.schema_version < CURRENT`, apply shims in sequence and return
   the upgraded view. **The original row is not mutated.** Lazy
   migration — only when the user explicitly Saves does the new body
   land at `CURRENT`.
3. **Read-safe-mode fallback.** If a shim raises during read, the API
   still returns a response: `{ schema_version: N,
   schema_version_unsupported: true, body: <raw> }`. The frontend
   renders a read-only "this project version is from an older format
   we couldn't fully migrate — please contact admin" view that **still
   permits JSON download**. Users never lose access to their data
   because of a code bug.
4. **Golden-file corpus.** `tests/document_schema/fixtures/v1/*.json`,
   `v2/*.json`, etc. CI runs every fixture through every applicable
   shim chain on every PR. New shims must produce identical results
   to the previous CI run on the same corpus, and round-trip through
   Pydantic validation.
5. **Production-corpus drill before bumping schema_version.** Before
   merging a new `CURRENT`, a CI job runs the new shim against every
   live project body in a staging snapshot. Any failure blocks the
   merge.
6. **Deprecation marker on schema_version, never removal.** A version
   N's shims are kept indefinitely. We do not "drop support for old
   schema versions" — there's no upside, only risk.
7. **Pydantic models per schema version.** `ProjectDocumentV1`,
   `ProjectDocumentV2`, ..., living side-by-side. Code that reads
   "current" pins to the latest; code that handles raw old bodies
   uses the matching version model.

This is the **only** migration path for project-side schema. No
ALTER TABLE for project entities. All evolution flows through the
shim chain.

## 11. Frontend

TypeScript / React. Restricted to display + UI/UX.

### 11.1 Top-level surfaces

- **Project list** (editor home, `/dashboard`) — owned-by-current-user
  projects, with pinning + per-user ordering; "Catalogs ▾" dropdown
  in the global header.
- **Project workspace** (`/projects/{id}/{tab}`) — five tabs:
  - **Status** (default landing) — project lifecycle / cert
    milestones (US-Status).
  - **Windows** — window types (US-Builder-Windows).
  - **Envelope** — assemblies (US-Builder-Envelope).
  - **Equipment** — rooms + future MEP equipment tables.
  - **Model** — 3D HBJSON viewer (§11.4).
  - **Project header bar** above the tabs:
    project name + bt_number + client (left); version dropdown
    (US-3.1, *not* a tab — always-visible chrome) + save status +
    Save / Save-As / `⋯` menu + IP/SI units toggle (right).
- **Catalog manager** (`/catalog/{slug}`) — separate top-level area;
  CRUD on catalog tables. Reached via the global header's
  "Catalogs ▾" dropdown.
- **Diff view** — modal; pick two versions or version-vs-draft.
- **Viewers** access the **same** project workspace
  URL (`/projects/{id}/...`) — there is no separate viewer URL
  shape. Frontend hides edit affordances when not authenticated;
  backend rejects writes without a session token. Non-logged-in
  viewers see Status / Windows / Envelope / Equipment / Model
  tabs read-only, can browse versions, and can download project
  JSON / table JSON / HBJSON.

There is **no top-level "Versions" tab** — versions live in the
header dropdown to keep "current version" always visible and
gate switches behind an explicit Open gesture (US-3.1).
There is **no top-level "Settings" tab** — project settings
(rename, transfer ownership, delete) live behind the project
header `⋯` overflow menu (US-Settings).

### 11.2 Editor state model — three layers

| Layer | What it is | Persistence |
|---|---|---|
| **Document body** | The saved version body, fetched on Open. | Postgres `project_versions.body`. Authoritative. |
| **Server-side draft** | The user's WIP, mirrored from the frontend. | Postgres `project_version_drafts.body`. Crash-recovery only. |
| **In-memory document** | Frontend React state — the live editing target. | Browser memory. Lost on close (unless mirrored to draft). |

Editing flow:
1. User opens a version → frontend GETs document body and any existing
   draft. If draft exists and differs from body, prompt restore /
   discard.
2. Each edit appends a guarded JSON-Patch op to a frontend queue.
3. Queue flushes on debounce (~500ms) as a batched PATCH against
   `/api/v1/.../draft`. Backend applies to draft.
4. **No autosave to the version body.** Save / Save As are explicit
   gestures (§8.2).
5. `beforeunload` fires a warning if the draft is dirty (unsaved patch
   ops in the queue or draft differs from version body).

If a write receives 401 because the session expired, the frontend
freezes the local patch queue and re-authenticates in place. After
re-auth it refetches version/draft ETags. Queued patches are retried
only if both ETags still match; otherwise the user chooses reload
draft / keep local edits as a new draft attempt / discard. V1 never
blindly replays stale queued patches.

For BLDGTYP scale (50–500 KB documents), patch-based draft sync is
sub-100ms latency.

### 11.3 Per-table display

Each table type has a column-config that drives rendering. The catalog
POC's `phase_5` shadcn-table component (toolbar with sort/filter/group,
multi-select, copy) is the right base. Per-table columns are declared
in TS (not user-configurable) — schema flexibility lives in code, not
runtime.

### 11.4 3D viewer — React Three Fiber

V2 ships an HBJSON viewer (read-only; **not** an editor) as a project
surface. The viewer's source is **HBJSON files uploaded to the project**
— not the project document. The builder / table data and the 3D model
are deliberately disconnected in V2 v1; see §11.4.6 for rationale.

#### 11.4.1 Workflow context

```
┌──────────────────┐     ┌────────────────┐     ┌──────────────────┐
│ PHN builder /    │     │ Rhino +        │     │ PHN HBJSON       │
│ table editors    │ ──▶ │ Grasshopper +  │ ──▶ │ viewer           │
│ (project doc)    │     │ honeybee_ph    │     │ (uploaded files) │
└──────────────────┘     └────────────────┘     └──────────────────┘
  source-of-truth         3D modeling             read-only display
  for design data         platform                of generated model
```

User flow:
1. Edit assemblies / window_types / rooms / equipment in the PHN
   builder.
2. Reference that data while building the 3D model in Rhino.
3. Run honeybee_ph in Grasshopper to export HBJSON.
4. Upload the HBJSON to the project's viewer area in PHN.
5. View it alongside earlier uploaded HBJSONs.

The builder-to-Rhino flow is by hand / by reference, not by API. PHN
is not the geometry-authoring tool.

#### 11.4.2 HBJSON file storage and data model

HBJSON files are 5–20 MB each, with multiple revisions per project
expected over a project's life. They go in object storage, not
Postgres JSONB:

- **Storage:** Cloudflare R2 through the generic `project_assets`
  backbone (§6.5), with `asset_kind = 'hbjson'`.
- **DB records:** `project_assets` owns object metadata and signed URL
  generation; `project_hbjson_files` owns viewer-specific metadata and
  cached geometry/extraction fields.

```sql
project_hbjson_files (
    id                  UUID PRIMARY KEY,
    project_id          UUID NOT NULL REFERENCES projects(id),
    asset_id            TEXT NOT NULL UNIQUE REFERENCES project_assets(id),
    label               TEXT NOT NULL,
                        -- e.g. "Initial massing", "Round 1 Submit Model"
    notes               TEXT,
    hbjson_schema_version  TEXT,          -- if discoverable from the file
    -- Optional, hand-entered: which project version was this generated
    -- against? Informational; no enforced relationship.
    project_version_id  UUID REFERENCES project_versions(id),
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    uploaded_by         INTEGER NOT NULL REFERENCES users(id),
    deleted_at          TIMESTAMPTZ
)
CREATE INDEX ON project_hbjson_files (project_id, uploaded_at DESC);
```

Properties:
- HBJSON files are **independent of project_versions.** A project
  version does not own HBJSON files; an HBJSON file optionally records
  which project version it was sourced against (hand-entered metadata).
- HBJSON files are **immutable after upload.** They arrive complete
  from the modeling tool. New revision = new `project_assets` row and
  separate `project_hbjson_files` row.
- Not included in project document JSON downloads. The "download
  project JSON" endpoint returns the builder/table data only. HBJSON
  files have their own download endpoints (§9.11) and a
  `Content-Disposition: attachment` direct link via signed R2 URL.
- Soft-delete only. Deleting a project soft-deletes all its HBJSON
  rows and related assets; R2 objects are GC'd by a periodic sweep once
  retention and reference checks pass (§6.5).

#### 11.4.3 Tech stack

- **`three`** — geometry kernel, materials, lights, post-processing
  primitives. Same library V1 uses (no engine swap).
- **`@react-three/fiber` (R3F)** — declarative React renderer over
  Three.js. Replaces V1's imperative `SceneSetup` + manual animation
  loop.
- **`@react-three/drei`** — ready-made `OrbitControls`, `Bounds`,
  `Edges`, `Outlines`, `GizmoHelper`, performance helpers.
- **`@react-three/postprocessing`** — declarative effect composer
  (replaces V1's hand-rolled `world.composer.render()`).
- **HBJSON loaders** — port V1's `load_faces`, `load_spaces`,
  `load_erv_ducting`, `load_hot_water_piping`, `load_sun_path`,
  `load_shades`, `load_space_floors` as plain TS functions taking a
  parsed HBJSON object and returning `BufferGeometry` / `Object3D`.
  R3F hosts the result via `<primitive>` or by mapping to declarative
  `<mesh>` / `<lineSegments>` / `<group>` JSX. **The loaders read
  HBJSON, not the project document.**
- **Viewer state** — Zustand store. Replaces V1's six nested context
  providers (`SelectedModelContext`, `AppVizState`, `AppToolState`,
  `ColorBy`, `SelectedObject`, `HoverObject`).

#### 11.4.4 Why R3F (grounded in V1 review)

V1's `model_viewer/` works but carries scaffolding cost that R3F
removes:

| V1 pattern | Why it exists | R3F equivalent |
|---|---|---|
| 6 nested `<...ContextProvider>` in `Viewer.tsx` (l.34–55) | Each tool / viz state needs its own React state | One Zustand store; subscribers select slices |
| Custom `addToolStateEventHandler` / `addVizStateMountHandler` registries with manual `mount`/`dismount` lists | React lifecycle wasn't reachable from imperative scene code | Standard React `useEffect` per scene component; mount = render, dismount = cleanup |
| Empty-deps animation `useEffect` with side-effect manual `requestAnimationFrame` (l.334–354) | Scene was outside React | R3F runs the loop; `useFrame` hooks into it cleanly |
| `mountRef.current?.appendChild(world.current.renderer.domElement)` | Imperative DOM mount | `<Canvas>` component |
| `world.current.scene.add(dimensionLinesRef.current)` during render in `Viewer.tsx` (l.30) | No declarative way to add a group | `<group ref={...}>` in JSX |
| `useCallback` with `eslint-disable-next-line react-hooks/exhaustive-deps` in 6+ places (l.83–127) | Stale-closure dance against the imperative scene | Subscribe to Zustand → no stale deps |
| Hand-rolled outline / wireframe / vertex visibility juggling per viz state | Three has no React-aware lifecycle | Conditional JSX: `{vizState === 'showSpaces' && <SpaceMeshes />}` |

The HBJSON viewer is a near-perfect R3F use case: static or
infrequently-updated geometry, view modes (color-by, sun-path, ERV
ducting), pick / hover interactions, no transform gizmos, no per-vertex
editing. R3F's strengths line up exactly.

#### 11.4.5 What we keep from V1

- HBJSON parsing logic in the loaders.
- Color-by attribute mappings and legend logic.
- Tool / viz state enums and handlers (rewritten as Zustand slices).
- The visual design and UX of the viewer (menubars, info panel,
  legend).

The work is a **port**, not a rewrite from scratch. Rough scope: ~2
weeks of focused frontend work assuming the loaders and color-by logic
are mostly portable.

Compatibility: R3F is a renderer for React; same React, same Vite,
same TS, same component library as the rest of V2. Zero stack
incompatibility. R3F adds ~30 KB gzipped; drei is tree-shakable.
Rendering performance is comparable to vanilla Three for our scene
complexity (<100k triangles per project; well under R3F's practical
ceiling).

#### 11.4.6 The deliberate disconnect from builder data

V2 v1 explicitly does **not** connect builder/table data (project
document) to the viewer. The two live side-by-side in the same project
without a code-enforced relationship. Rationale:

- **Rhino + Grasshopper + honeybee_ph remain the canonical 3D modeling
  toolchain at BLDGTYP.** Replicating their geometry capability in a
  web app is a large effort and not the V2 goal.
- **Builder/table data is the source-of-truth for design decisions**
  (assemblies, equipment, rooms). It flows *into* Rhino by reference
  (Ed reads PHN, types into GH), not as a programmatic export.
- **HBJSON is the canonical exchange format** between Rhino and
  downstream tools (PHX → WUFI / PHPP). Treating it as an upload
  artifact in PHN preserves that role.
- A future phase may bridge the two (validate that an uploaded
  HBJSON's apertures match the project document's `window_types`,
  generate Rhino-ready exports from the project document, or
  eventually fold geometry authoring into PHN). Out of scope for V2
  v1; this PRD does not commit to a direction.

This disconnect is acknowledged-not-loved. The constraint is honest
about current workflow; the design leaves room for a later bridge
without forcing one prematurely.

### 11.5 Units architecture — backend is SI, frontend converts

**Hard rule:** all physical quantities in PHN-V2 are stored,
transmitted, and computed in SI canonical units. **Conversion
between SI and IP (Imperial) is exclusively a frontend concern.**

This mirrors V1's model and keeps the data layer free of unit
ambiguity.

#### 11.5.1 Where SI-only applies

- **Project document body (JSONB)** — every numeric field uses SI
  canonical units. Field names embed the unit
  (`width_mm`, `conductivity_w_mk`, `density_kg_m3`,
  `specific_heat_j_kgk`, `airflow_m3h`, `pressure_pa`, etc.) so
  the unit is self-documenting.
- **REST API request and response bodies** — values in, values out:
  SI. Backend rejects (or coerces with a warning) any value that
  arrives in non-SI units.
- **JSON-Patch `op.value` fields** — SI.
- **Catalog tables (Postgres columns)** — SI typed columns.
- **MCP tool inputs and outputs** — SI. LLMs always work in SI;
  zero unit ambiguity for prompt-driven edits.
- **JSON downloads (project + per-table)** — SI. External
  consumers (future GH / PHX integration) get the canonical form.
- **Internal calculations** (when calculations land in V2) — SI
  throughout.

#### 11.5.2 Where conversion happens

- **Frontend display layer.** A units module reads
  `users.units_preference` ('IP' or 'SI', default SI) and:
  - On render: converts SI from server to display units, formats
    with the appropriate suffix ("0.034 W/(m·K)" vs "R-7.6/in").
  - On input: parses user input in display units, converts to SI,
    sends SI to the API.
  - Round-trips must preserve precision (no double-conversion
    drift across edits).
- **Frontend tests must cover the round-trip** for each quantity:
  user types value in IP → frontend converts to SI → backend
  stores SI → frontend reads SI → frontend converts to IP →
  display matches user's original input within rounding tolerance.

#### 11.5.3 Implementation notes

- **TS units strategy — resolved 2026-05-11.** V2 follows the V1
  frontend pattern but formalizes it into quantity-specific helpers.
  Do not port the whole Python `PH_units` package and do not add a
  generic units dependency for MVP. Create focused helpers under
  `frontend/src/lib/units/` by quantity family (`length`, `thermal`,
  `airflow`, `pressure`, `power`, etc. as needed). APIs should be
  explicit, e.g. `parseLengthToMm`, `formatLengthFromMm`,
  `formatUValueFromSI`, not "convert any unit to any unit."
- **V1 precedent / templates.** Use these V1 files as research
  references, not import paths:
  - `../ph-navigator/frontend/src/formatters/Unit.Converter.ts`
  - `../ph-navigator/frontend/src/formatters/Unit.ConversionFactors.ts`
  - `../ph-navigator/frontend/src/features/project_view/_hooks/useUnitConversion.tsx`
  - `../ph-navigator/frontend/src/features/project_view/_contexts/UnitSystemContext.tsx`
  - `../ph-navigator/frontend/src/features/project_view/_components/UnitSystemToggle.tsx`
  - `../ph-navigator/frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/displayUnitConverter.ts`
  - `../ph-navigator/frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/parseInput.ts`
  - `../ph-navigator/frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/parseFeetInches.ts`
  - `../ph-navigator/frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/formatFeetInches.ts`
  - `../ph-navigator/frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/__tests__/`
- **V1 conversion-factor caveat.** Reuse the V1 shape and test corpus,
  not the V1 constants blindly. Thermal factors and reciprocal
  quantities must be verified against fixtures before landing in V2.
- **Schema migrations preserve units.** A field rename or shape
  change must not silently swap units. The golden-file corpus
  (§10.5) tests the round-trip; new shims are tested for unit
  preservation.
- **Toggle UX.** The IP/SI toggle in the project header (§11.1)
  edits `users.units_preference`. Toggling re-renders all numeric
  values in the active tab; no API roundtrip needed (display-layer
  only).

#### 11.5.4 Anti-patterns banned

- Don't accept "12 in" or "0.305 m" as ambiguous strings; the API
  takes a number whose unit is implied by the field name.
- Don't store "IP-flavored" SI values (e.g. "this column is in mm
  unless the user is in IP mode"). Field semantics are fixed.
- Don't convert units server-side based on a request header or
  user preference. Backend has no notion of user preference for
  numeric values.

## 12. Stack & deployment

| Layer | Choice |
|---|---|
| Backend language | Python 3.11+ |
| Backend framework | FastAPI |
| DB access | Raw parameterized SQL via `psycopg` v3 repositories; no ORM entity layer |
| DB / migrations | Postgres 16 + Alembic manual migrations |
| Validation | Pydantic v2 |
| Object storage | Cloudflare R2 |
| Frontend build | **Vite** (V1's CRA / `react-scripts` is dead-end) |
| Frontend framework | TypeScript, React 19 |
| Frontend UI kit | **shadcn/ui + Tailwind** (catalog POC outcome — drop V1's MUI) |
| Frontend table | TanStack Table + shadcn-table |
| Frontend state | **Zustand** for client/UI state (drop nested-context pattern) |
| Frontend data | TanStack Query for server state |
| 3D viewer | **`three` + `@react-three/fiber` + `@react-three/drei` + `@react-three/postprocessing`** |
| JSON-Patch | `fast-json-patch` (frontend) + `jsonpatch` (backend) |
| Units conversion (frontend only) | Quantity-specific TS helpers under `frontend/src/lib/units/`; V1 unit/dimension files are research templates (§11.5.3) |
| Auth | Session auth (cookies) for editors; public read access on normal project URLs |
| Hosting | Render.com (backend service, managed Postgres, frontend static site) |
| Local dev | Docker Compose (Postgres + backend + frontend dev server) |
| MCP transport | stdio + HTTP/SSE (FastAPI route) |
| Testing | pytest (backend), Playwright (E2E), Vitest (frontend unit) |

### 12.1 Persistence pattern — raw SQL + Pydantic

**Decision confirmed 2026-05-11:** V2 uses a Raw+DC-inspired
persistence pattern adapted to PHN's Pydantic-heavy backend:
repository modules issue raw parameterized SQL through `psycopg` v3,
then map rows into Pydantic models or simple scalars at the data-access
boundary. There is no SQLAlchemy ORM entity layer and no SQLAlchemy
Core query-composition layer in application code.

Why this fits PHN-V2:
- The authoritative project model is already a Pydantic-validated JSON
  document, not a graph of mutable ORM entities.
- Raw SQL keeps JSONB, locking, ETag, and migration boundaries explicit.
- Pydantic remains the typed contract for API payloads, project
  documents, table slices, catalog rows, repository returns, and MCP
  results.
- Plain SQL is easier for LLM-assisted maintenance than a specialized
  ORM abstraction, provided every query is parameterized and tested.

Hard rules:
- Repository functions own SQL strings and accept primitive IDs or typed
  request objects.
- All SQL with user input is parameterized. No f-string or concatenated
  SQL with user-controlled values.
- Repository functions return Pydantic models, typed row DTOs, or
  scalars. Raw driver rows do not leak into services/routes.
- Services own workflow invariants and transaction boundaries for
  multi-step operations such as draft patch, Save, Save As, catalog
  refresh, and asset attach.
- Alembic remains the schema-migration tool, but migrations are manual.
  There is no ORM metadata target and no autogenerate from models.

V2 explicitly drops from V1's stack: CRA / `react-scripts`, MUI / MUI-X
DataGrid, AG Grid, react-flip-toolkit, html2canvas / html2pdf / jspdf
(replaced by server-side PDF if/when needed). These were V1
accumulations; standardizing the V2 stack keeps the surface coherent.

### 12.2 Folder / repo layout

V2 lives in a brand-new sibling folder to V1 — fresh start, no shared
code:

```
00_PH_Tools/
├── ph-navigator/             ← V1 (existing, unchanged, kept running)
└── ph-navigator-v2/          ← V2 (new) — this PRD's scope
    ├── backend/
    │   ├── features/
    │   │   ├── project/
    │   │   │   ├── document/      Pydantic models per schema_version
    │   │   │   │   ├── v1.py
    │   │   │   │   └── migrations/
    │   │   │   ├── routes.py
    │   │   │   ├── service.py
    │   │   │   ├── draft.py
    │   │   │   └── diff.py
    │   │   ├── catalog/
    │   │   ├── mcp/
    │   │   └── auth/
    │   ├── alembic/
    │   ├── tests/
    │   │   └── document_schema/fixtures/    golden-file corpus (§10.5)
    │   └── pyproject.toml
    ├── frontend/
    │   ├── src/
    │   │   ├── features/
    │   │   │   ├── project_workspace/
    │   │   │   ├── catalog_manager/
    │   │   │   ├── viewer_3d/                 R3F viewer
    │   │   │   └── public_view/
    │   │   ├── components/                    shadcn primitives
    │   │   ├── stores/                        Zustand
    │   │   └── lib/
    │   ├── package.json
    │   └── vite.config.ts
    ├── context/                                LLM-targeted docs (§10.4)
    ├── docs/
    │   ├── features/
    │   └── plans/
    ├── docker-compose.yml
    ├── README.md
    └── CLAUDE.md
```

**Repo question:** separate Git repo (`bldgtyp/ph-navigator-v2`) or
sibling folder under one repo? Lean: **separate Git repo.** Reasons:
clean commit history, independent CI, independent deploy pipeline,
clean cutover (archive V1 repo when sunset), no risk of V1 changes
contaminating V2 history. Cost: two repos during the parallel period;
minor.

V2 develops in isolation. Cutover happens project-by-project as Ed
manually imports each (§14). V1 stays running until the last
AirTable-bound project is migrated.

## 13. Auth

- **Editor login** — email + password. Server-side sessions stored in
  Postgres (`sessions` table, §6.1). HTTP-only, Secure, SameSite=Lax
  cookies referencing the session row.
- **Password hashing** — Argon2id is the planned default, with memory,
  time, and parallelism parameters exposed in backend Settings and
  tested in the auth scaffold. If Argon2id causes installation friction
  during Phase 0, bcrypt with cost >= 12 is the only accepted fallback.
- **Browser request protection** — all mutating browser requests require
  an allowed `Origin` header. Allowed origins are the exact production
  frontend origin plus local dev origins; no wildcard credentialed CORS.
  SameSite=Lax cookies are defense-in-depth, not the whole CSRF policy.
- **CORS** — deny by default. Credentialed requests are allowed only
  from configured frontend origins. Public read endpoints are still
  ordinary API routes; CORS does not use `*` with credentials.
- **Session lifetime** — 60-minute sliding expiration. Every
  authenticated request resets the expiry. Idle 60 min → session
  invalidated; client receives 401 on next request. Dirty editor tabs may
  send a lightweight keepalive while unsaved local state exists.
- **Single active session per user.** Signing in creates a new
  session and invalidates any existing sessions for the same user
  (most-recent-wins). The superseded session's row is marked
  `invalidated_at` and tagged with reason
  `superseded_by_new_login`. A partial unique index on
  `sessions(user_id) WHERE invalidated_at IS NULL` enforces the rule in
  the database. The displaced device sees 401 on next request.
- **Mid-edit session expiry** — frontend retains the in-memory
  document, opens a sign-in-again modal in place, retries the
  failed request on success. Server-side draft (§8.3) holds
  everything synced before idle, so data loss is bounded by the
  draft debounce window (~500ms).
- **Password reset** — admin-only via CLI / admin script; no
  self-serve forgot-password flow in v1. Two-person internal scope.
- **Account creation** — admin-only. No public sign-up.
- **Viewer access** — no token, no session required.
  Project URLs (`/projects/{id}/...`) resolve for any visitor; the
  backend's `require_project_access(mode='view')` dependency
  passes trivially. Writes return 401. See §4 for the full access
  model.
- **MCP auth** — project-scoped bearer tokens stored in
  `mcp_tokens` (§6.1). Issued by logged-in editors from Project
  Settings, shown once, stored hashed, revocable, and audit-logged.
  v1 tokens can carry `project:read`, `project:write`, `asset:read`,
  and `asset:write` scopes. Public browser read access does not create
  anonymous MCP access.

No anonymous editor auth. No per-table or per-version permissions
in v1.

### 13.1 Phase 0 security / ops baseline

The scaffold ships with the following from day 1:

- `/api/v1/health` for liveness and `/api/v1/version` for build/API
  metadata.
- A request-id middleware. `X-Request-ID` is accepted from the frontend
  when present, otherwise generated by the backend. Every response and
  structured error includes the request id.
- JSON application logs with `request_id`, `user_id`, `project_id`, and
  `version_id` when available.
- A single backend structured-error module shared by REST and MCP error
  wrappers, starting with the minimal §10.3 envelope.
- Idempotency-key middleware with the §9.5 scope, TTL, and replay
  semantics.
- Auth/session migrations covering Argon2id hashes, UUIDv4 sessions, and
  the single-active-session partial unique index.

## 14. Migration from V1

V2 has no AirTable connection and no automatic migration from V1.
Approach:

1. **V1 keeps running** in production for any project still actively
   using AirTable connectivity.
2. **Per-project manual migration:** for each V1 project Ed wants to
   move to V2, build a one-shot import script that reads the V1
   relational tree and writes a V2 project document. Run, verify, mark
   the V1 project archived.
3. **No compatibility layer** between V1 and V2 routes. They share auth
   (same `users` table) but nothing else.
4. **Eventual sunset of V1** once all live projects are on V2. Schedule
   TBD; not in scope for V2 v1.

### 14.1 Import script — sketch

`ph-navigator-v2/backend/scripts/import_from_v1.py <v1_project_id> [--dry-run]`:

- Read V1 `Project`, `Assembly`, `Layer`, `Segment`, `Material`,
  `Aperture`, `ApertureElement`, `Frame`, `Glazing`,
  `ProjectManufacturerFilter`.
- Construct a V2 `ProjectDocumentV1`. For each Material/Frame/Glazing
  reference, copy values into the document and stamp `catalog_origin`
  pointing at the V1-derived catalog (or new V2 catalog after Ed seeds
  it).
- Write a new V2 project + initial "Imported from V1" version.
- Photos and datasheets — keep V1 object-storage URLs as-is (R2 bucket
  shared between V1 and V2).
- **Steel-stud HBJSON delta (per Q-ENV-4 / §10.4 glossary).** Any
  V1 project that has steel-stud assemblies with HBJSON exports done
  under V1's exporter (`backend/features/assembly/services/
  to_hbe_material_steel_stud.py`, V1 ref §13.5) carries
  surface-film resistances (`R_SE=0.17, R_SI=0.68 hr·ft²·°F/BTU`)
  baked into the AISI S250-21 cavity-equivalent conductivity. V2's
  exporter drops those constants and uses `R_SE=0, R_SI=0` (matching
  V1's live R-value calc and Honeybee's convention) so films enter
  the calc **once**, at the construction boundary, when downstream
  consumers add them. **Expected delta after re-import:** V2 HBJSON
  exports of the same steel-stud assembly will have slightly
  different per-cavity equivalent conductivities than V1 exports.
  After re-export + downstream `u_factor` re-computation, the V2
  result is the correct one. The import script logs a one-line
  warning per steel-stud assembly migrated so the team can spot-check.

## 15. Risks

- **Single-document race conditions.** Mitigated by ETag concurrency
  (§8.5) and single-user expectation. Worth a stress test before v1.
- **Document size growth.** Ed's largest projects need profiling. If a
  project exceeds ~5 MB JSONB, draft-sync latency becomes noticeable.
  Mitigation: per-table draft replacement (§9.5), table-slice reads,
  and per-table draft scoping if needed in v1.1.
- **Schema migration discipline.** A bad `v1 → v2` shim corrupts every
  document on read. Mitigation: shims are pure functions, fully unit
  tested with golden files; CI fails if a shim's roundtrip is not
  idempotent on a corpus of real document fixtures.
- **LLM write safety.** MCP is intentionally read/write capable in v1,
  so token scope, audit logging, idempotency, and structured errors are
  part of the MVP, not hardening polish. Hold the tool surface to §10.3;
  add tools only when a concrete user task demands them.
- **Catalog drift confusion.** The bookshelf model is a deliberate UX
  choice, but it differs from architects' AirTable mental model
  ("change the catalog, every project sees it"). Refresh-from-catalog
  must be discoverable and the diff UI must be clear. Worth a UX pass
  with John before v1 ships.
- **Scope creep in v1 itself.** V2 has a large surface. Defer
  aggressively: catalog scope flags (project_scoped vs global),
  full diff UI polish, snapshot kind, MCP catalog writes — all
  v1.1 candidates if they look hairy.
- **No log surface in v1.** `user_action_log` lands in v1 (required
  for support troubleshooting per US-C1) but ships with no UI; Ed
  queries it by SQL. Risk: trivia like "did John make this change?"
  becomes a SQL task. Accept; v1.1 may add a per-project activity
  tab.

## 16. Success criteria (v1)

- Ed can create a new V2 project, add assemblies / window-types / rooms,
  pick materials / frames / glazings from the catalog, and save.
- Save (overwrite active version) and Save As (create new version)
  both work; old versions load identically to their save state and
  cannot be modified once locked.
- Browser-close warning fires when draft is dirty; reopening the
  project surfaces an unsaved-draft restore prompt.
- Opening a project document with an older `schema_version` succeeds
  via the upgrade-shim chain; if any shim raises, read-safe-mode
  surfaces a downloadable raw body without losing data.
- All API routes are served under `/api/v1/`; OpenAPI is published at
  `/api/v1/openapi.json`.
- Diff between two versions returns correct structured deltas.
- Project JSON download returns a valid `ProjectDocumentV1` JSON that
  round-trips through schema validation.
- Per-table JSON download returns a valid table slice.
- Non-logged-in visitor accessing a project URL sees the project,
  can switch versions, can download project / table / HBJSON JSON,
  and is blocked from all writes (frontend hides edit affordances;
  backend rejects write requests with 401).
- Claude Desktop can connect to the MCP server, list a project, fetch
  its document, run a JSON-Patch update against a token-scoped project,
  save the draft, and have the change appear in the editor on next
  reload.
- A user can upload an HBJSON file to a project, see it in the file
  list, and view it in the 3D viewer. Uploading a second HBJSON
  preserves the first; both are independently viewable.
- One V1 project successfully imported via the migration script and
  edited in V2.

## 17. Open questions

To resolve before implementation begins. None block this PRD's
acceptance, but each shapes a downstream decision:

1. ~~**Catalog scope flags** — does V2 v1 support the `global_with_
   project_overrides` or `project_scoped` catalog scopes from the
   2026-05-06 catalog PRD?~~ **Resolved 2026-05-10:** all catalogs
   are global + bookshelf, no per-project overrides at the catalog
   layer. Project-level overrides happen in the project document via
   the user editing copied values. Full roster of v1 + future
   catalogs in §7.0.
2. ~~**Asset deletion semantics** — when a photo is removed from a
   document, do we hard-delete the R2 object, or only the document
   pointer?~~ **Resolved 2026-05-11:** detach from the active draft
   first. The asset row remains available to older saved versions and
   other references. Hard purge is a 90-day GC path only after reference
   checks across saved versions and active drafts (§6.5).
3. **MCP transport** — stdio only, HTTP/SSE only, or both? Lean: both,
   stdio for local Claude Desktop / Code, HTTP/SSE for hosted use
   (e.g. claude.ai integration).
4. ~~**Public link granularity** — per-project link (sees all versions)
   vs. per-version link.~~ **Resolved 2026-05-11:** no separate
   public links exist. Normal `/projects/{id}/...` routes are public-readable.
   A public visitor who has the project URL can view the project.
5. **Diff UI scope in v1** — full visual side-by-side, or structured
   text "summary of changes" only? Lean: structured-text v1, visual
   side-by-side as v1.1.
6. **Editor session etag conflict UX** — on 409, force reload vs. show
   merge dialog. Lean: force reload (single-user expectation; merge
   dialog is real engineering).
7. ~~**Refresh-from-catalog UX** — per-entry only, or also a "refresh
   all" bulk action?~~ **Resolved 2026-05-11:** per-entry refresh only
   in v1. Review all opens the drift/customization report with
   per-entry actions; it does not auto-apply multiple entries.
8. **Project-versions name uniqueness** — enforce unique within a
    project (per the schema sketch) or allow duplicates? Lean:
    enforce; saves users from "which Round 1 Submit was the real
    one."
9. **Pre-save snapshot for one-click undo** — when Save overwrites a
    version, do we keep a transient "pre-Save" copy server-side for a
    short window (e.g. 1 hour) so the user can undo a regretted Save?
    Lean: defer to v1.1; lock + Save As is the pattern for
    high-stakes versions in v1.
10. **Draft GC age threshold** — drafts untouched for >30 days are
    deleted (§8.3). Confirm 30 days is reasonable; alert thresholds
    (e.g. "your draft is 14 days old — Save or discard?") tunable.
11. **Repo split: one repo or two?** §12.2 leans separate Git repos.
    Confirm before V2 scaffolding starts.
12. **HBJSON file size cap** — proposed 50 MB. Confirm against largest
    real Ed/John HBJSON exports. Multifamily projects could exceed
    this. Mitigations if needed: chunked / resumable upload (tus.io
    or signed-URL multipart), or simply raise the cap.
13. **HBJSON storage cost.** ~10 MB × ~10 files/project × ~50 projects
    = ~5 GB lifetime. Trivial on R2; track via `project_assets.size_bytes` for
    visibility.
14. **HBJSON ↔ project_version linkage** — the schema offers an
    optional `project_version_id` on `project_hbjson_files`. Should
    the upload UI strongly prompt for this (so cert submits get
    paired model + builder data), or leave it loose? Lean: prompt
    on upload but allow blank.
15. **HBJSON parsing in the browser** — at 5–20 MB JSON parse +
    geometry build, the viewer load may take seconds. Acceptable for
    v1 with a clear loading state; optimize (worker thread, server
    pre-extracted geometry) only if user feedback warrants.
16. ~~**Ownership semantics** (US-1 Q1).~~ **Resolved 2026-05-10:**
    ownership = dashboard-filter only. Strict ACL deferred. See §4.1
    for the forward-compatible access-check seam.
17. ~~**Forgot-password flow** (US-0 Q1).~~ **Resolved 2026-05-10:**
    admin reset only.
18. ~~**Session duration / concurrency** (US-0 Q2/Q3).~~
    **Resolved 2026-05-10:** 60-minute sliding expiration; single
    active session per user (most-recent-wins). See §13.
19. ~~**"Last modified" definition** (US-1 Q4).~~ **Resolved
    2026-05-10:** denormalized `projects.last_saved_at`, updated on
    every Save / Save As.
20. **V2 URL** — `ph-dash-frontend.onrender.com` is the existing
    PH-Dash URL, not PHN. Pick one for V2: staging on Render
    (`ph-navigator-v2.onrender.com`) → custom domain
    (`nav.bldgtyp.com` or similar) when ready. Lean: stage on
    Render, custom domain post-MVP.
21. **User-action-log retention** (US-C1) — keep forever vs. roll
    off. Lean: keep forever (volume trivial).
22. ~~**Project landing page layout** (US-3 Q1).~~ **Resolved
    2026-05-10:** tab bar — Status / Windows / Envelope / Equipment /
    Model. Status is the default landing tab. Versions are a header
    dropdown (US-3.1), not a tab. Settings live behind the header
    `⋯` overflow menu. New schema additions:
    `project_status_items`, `users.units_preference`. See §11.1.

## 18. Out-of-scope reminders (for visibility)

- Real-time collaboration, presence cursors, comment threads.
- Branching / merging versions.
- Cross-project queries / reports.
- Mobile UX.
- Public write API (third-party integrations).
- AirTable connectivity of any kind.
- LLM-driven catalog writes (read-only catalog through MCP for v1).
- Per-cell, cross-session undo.
- Automatic V1 → V2 migration in production. Manual per-project only.

## 19. Next steps

1. **Finish pre-implementation doc cleanup.** Keep `context/` as the
   canonical description set and `docs/plans/` as transient planning.
2. **Split §17 open questions** into resolved, must-decide before
   implementation, and can-decide during feature work.
3. **Create a short MVP vertical-slice plan** before implementation
   phasing. It should sequence auth/dashboard/project create,
   `ProjectDocumentV1`, one editable table, draft/Save/Save As/lock,
   public read-only mode, JSON schema/download, and one catalog pick.
4. **Define `ProjectDocumentV1` Pydantic model** — the contract
   everything else hangs from. Ship with golden-file tests.
5. **Add generated schema docs and API/MCP docs as code lands.** Do not
   create empty context stubs that future agents have to load.
