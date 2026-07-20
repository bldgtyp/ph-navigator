# PH-Navigator V2 — Data Storage Architecture

DATE: 2026-06-22
TIME: 09:30 EDT
STATUS: CANONICAL REFERENCE — the map of where every kind of project data
physically lives, how the pieces point at each other, and how dev differs
from production.

## Purpose

PHN-V2 stores data in **two physical systems** (a Postgres database and an
S3-compatible object store) but across **four logical data classes** with
deliberately different rules. This doc is the single place that draws the
boundaries between them, so you don't have to reconstruct the picture from
`ENVIRONMENT.md`, `PRD.md`, `data-model.md`, and the feature code each time.

Read this when you are deciding *where a new piece of data should live*, wiring
a new storage-backed feature, reasoning about dev-vs-prod parity, or debugging a
"the row exists but the file doesn't" class of problem.

It complements, and does not replace:

- `context/ENVIRONMENT.md` — the operational card (ports, env vars, Render
  re-provision runbook, R2 dashboard setup).
- `context/TECH_STACK.md` — *why* raw SQL + JSONB + R2 (the decision record).
- `context/technical-requirements/data-model.md` — the full relational + JSONB
  schema and the `ProjectDocumentV1` shape.
- `context/technical-requirements/attachments.md` — the per-project asset
  upload/attach contract.
- `context/technical-requirements/save-versioning.md` — the draft/version state
  machine.

---

## 1. The big picture

```
                         ┌─────────────────────────────────────────────┐
                         │                FastAPI backend              │
   REST (browser) ──────▶│  routes → services → repositories           │
   MCP (LLM clients) ───▶│  (raw parameterized SQL · boto3 S3 client)  │
                         └───────────────┬──────────────┬──────────────┘
                                         │              │
                ┌────────────────────────┘              └───────────────────────┐
                ▼                                                                ▼
   ┌──────────────────────────────────────┐         ┌──────────────────────────────────────┐
   │  POSTGRES                             │         │  OBJECT STORE (S3-compatible)         │
   │  (Docker local · Render managed)     │         │  (MinIO local · Cloudflare R2 prod)   │
   │                                       │         │  one bucket, two key namespaces:      │
   │  ① Relational metadata (rows)         │         │                                       │
   │     auth, projects, catalogs,         │         │  ③ projects/{pid}/assets/{aid}/…      │
   │     asset registry, climate datasets, │  ◀──────│     (dynamic, per-project files)      │
   │     jobs, UI views, tokens, audit     │  pointers│    datasheets · photos · HBJSON ·    │
   │                                       │  (ids /  │    EPW · export bundles · thumbnails  │
   │  ② Versioned JSONB documents          │  object_ │                                       │
   │     project_versions.body (immutable) │  keys)  │  ④ climate/{provider}/{version}/…     │
   │     project_version_drafts.body (WIP) │  ◀──────│     (static, app-wide reference)      │
   │                                       │         │     licensed climate bundles          │
   └──────────────────────────────────────┘         └──────────────────────────────────────┘
```

**Two physical stores:**

| Store | Local dev | Production / staging | Holds |
|---|---|---|---|
| **Postgres 16** | Docker container, host `localhost:5433` | Render managed Postgres (Ohio) | All structured data + all *pointers* |
| **Object store** | MinIO, `http://localhost:9000` | Cloudflare R2 (region ENAM) | All file *bytes* |

**Four logical data classes** (the rest of this doc, one section each):

1. **Relational metadata** — normal Postgres rows. Thin: identity, project
   metadata, catalogs, registries, audit. Never shadows document tables.
2. **Versioned JSONB project documents** — the project model itself, stored as
   immutable validated JSON on `project_versions.body`, edited through
   per-user drafts.
3. **Dynamic per-project object files** — user uploads (datasheets, photos,
   HBJSON, EPW, export bundles). Bytes in the object store under
   `projects/…`; one `project_assets` row per file is the registry/pointer.
4. **Static app-wide climate bundles** — licensed reference climate data, one
   `dataset.json` per `(provider, version)` under `climate/…`, seeded into the
   `climate_dataset*` tables.

### 1.1 The one rule that ties it together

> **Postgres owns *references*; the object store owns *bytes*.**
>
> Project documents and relational rows store **opaque ids and object keys**,
> never durable file URLs. Every file URL handed to a browser or LLM is a
> **short-lived signed URL** minted on demand. There is no public object
> access and no durable public object URL anywhere in the system.

A direct corollary, and the reason the object store exists at all
(`features/climate/object_store.py`, `attachments.md`):

> **This repo is public; much of the data is licensed** (Phius / PHI climate
> data, manufacturer datasheets, project PHI/Phius/PHPP/WUFI artifacts).
> Licensed and project-private bytes therefore live **only** in the private
> object store — never in git, never inline in a public-readable API field.
> (This is the storage-side expression of the repo-root CLAUDE.md "This repo
> is public" hard rule.)

---

## 2. Class ① — Relational metadata (Postgres rows)

Normal, fully-relational tables. The PRD rule: relational tables hold *platform
metadata* (identity, project metadata, registries, audit) and **do not shadow
the project-document tables** (assemblies, apertures, rooms, equipment, etc. —
those live in class ②).

Grouped by concern (full column-level schema in `data-model.md` §6.1;
`20260624_0001` is the relational baseline reset — several migrations layer
on top since; see `backend/alembic/versions/` for the current chain):

### Auth & audit
| Table | Holds | Notes |
|---|---|---|
| `users` | identity, `password_hash` (**Argon2id**, nullable, + `password_set_at`), `units_preference`, `is_staff`, soft-delete | Email unique via `uq_users_email_lower`. `is_staff` is the bldgtyp cross-tenant flag (2026-06-27). |
| `sessions` | server-side sessions (opaque cookie → row) | Partial unique index = one active session per user. |
| `user_action_log` | append-only audit trail (`details` JSONB, `target_user_id`/`target_email`) | Indexed by `created_at` and `(user_id, created_at)`; never deleted. `target_*` columns (2026-06-27) record admin actions taken on another user. |
| `account_tokens` | single-use, expiring, **hashed** invite/reset tokens (`token_hash`, `token_type`, expiry) | 2026-06-27, backs the admin-user-management invite/reset-link flow. Plaintext token never stored; partial unique index = one active token per `(user_id, token_type)`. |
| `user_grants` | fine-grained per-user capability grants (capability, scope_type/scope_id, granted_by) | 2026-06-27, backs the access-capability model (`admin.users.manage`, `catalog.edit`, etc.); global-scope grants are unscoped by constraint. |

### Projects & lifecycle (metadata only — content is class ②)
| Table | Holds | Notes |
|---|---|---|
| `projects` | name, `bt_number` (unique), `cert_programs[]`, `owner_id`, `team_id`, `active_version_id`, denormalized `last_saved_at`, soft-delete + `hard_delete_after` | `owner_id` is a dashboard concept, **not** an ACL. `team_id` (2026-06-27, nullable, no FK yet) reserves tenancy; `NULL` = legacy/bldgtyp-internal project. |
| `project_status_items` | lifecycle checklist (`todo`/`done`/`na`), fractional `order_index` | Intentionally outside the document body — status is "where is this project," not a versioned model property. |
| `user_project_preferences` | per-user pin/order on the dashboard | personal, so not on `projects`. |
| `mcp_tokens` | project-scoped LLM bearer tokens, **hashed** (`token_hash`), `scopes[]`, revocable | Plaintext token never stored. |

### Catalogs (immutable shared libraries — the "bookshelf")
| Table | Holds | Notes |
|---|---|---|
| `catalog_materials` | material thermal/optical props | Flat current table. |
| `catalog_frame_types` | window frame PH performance | Includes the built-in default frame row. |
| `catalog_glazing_types` | glazing U/g performance | Includes the built-in default glass row. |
| `catalog_field_options` | per-field single-select vocabularies for the catalogs above | Baseline-seeded for frame-types and glazing-types. Keyed `(catalog_table, field_key, option_id)`; case-insensitive unique label index. |

Catalog PK ids are AirTable-shaped (`rec` + 14 base62 chars) so a row is
portable across databases via JSON import/export. **Catalog picks are *copied*
into the project document** (`catalog_origin` records the source); projects
never live-join the catalog, so editing a catalog never silently mutates
in-progress project work.

**Catalog single-select vocabularies** (`catalog_field_options`) are a *separate*
store from the project-document `single_select_options` JSON map (data-model.md
§6.6.4): catalogs are global app data, so their option lists are a relational
reference table keyed `(catalog_table, field_key)`, **storing the label string**
(rows in the owning catalog table store the label too — D-2 of
`planning/archive/dated/2026-06-23/window-frames-catalog-enums/`). Built generic (D-7) so glazing
and materials can adopt it; **frame-types** (six fields: manufacturer / brand /
use / operation / location / mull_type) and **glazing-types** (one field:
manufacturer — `brand` stays free text, its values are near-unique per row) are
wired today — materials is the only un-migrated catalog. Both wired catalogs
derive `name` **server-side** from its parts (read-only — `manufacturer | brand
| suffix` for glazing, where `brand` is a free-text part) and resolve the
built-in default by **id** (`recPHNDefFrame001` / `recPHNDefGlazng01`), not name.

### Climate reference datasets (the Postgres side of class ④)
| Table | Holds | Notes |
|---|---|---|
| `climate_dataset` | one row per `(provider, version)` release; `label`, `source` | `UNIQUE(provider, version)`. |
| `climate_dataset_location` | one row per weather station; `data` JSONB = full standardized `ClimateRecord` | Geo + lat/long indexes for nearest-station search. |

### Registries / pointers into the object store (classes ③/④)
| Table | Holds | Notes |
|---|---|---|
| `project_assets` | **the canonical pointer row for every uploaded file** — `object_key`, `content_hash_sha256`, `content_type`, `size_bytes`, `upload_status`, `metadata` JSONB (thumbnail/orphan state) | See §4. |
| `project_jobs` | async job state (only `asset_bulk_download` in v1), `result_asset_id` | Result asset is indexed. |
| `project_hbjson_files` | HBJSON viewer/extraction metadata keyed to an `asset_id`; cached geometry, dedup by content hash | The file itself is a `project_assets` row of kind `hbjson`. |
| `project_location` | site geodata (lat/long/elevation/tz), derived county/FIPS/climate-zone, `geodata_provenance` JSONB, `epw_asset_id` pointer | 1:1 with `projects`; `epw_asset_id` is an FK to `project_assets(id)` with `ON DELETE SET NULL`. |
| `project_climate_source` | per-project climate sources (`kind`, `ref`, `data` JSONB) | See §5. |

### Per-user UI state
| Table | Holds | Notes |
|---|---|---|
| `user_table_views` | DataTable column widths/filters/sort per `(user, project, table)`; `view_state` JSONB (≤64 KiB) | **Hard-deleted** (a cache — no audit value), unlike everything else, which soft-deletes. |

> **Note on the JSONB columns above.** Several relational rows carry a JSONB
> column (`details`, `metadata`, `data`, `geodata_provenance`, `view_state`).
> That is a *typed escape-hatch field on a relational row* — it is **not** the
> same thing as class ②, which is an entire versioned project model living in
> one column. Don't conflate "a row has a JSONB field" with "this is the
> document model."

---

## 3. Class ② — Versioned JSONB project documents

This is the heart of V2 and the reason it left V1's relational entity model.
The entire project model — assemblies, layers, segments, project materials,
apertures, rooms, thermal bridges, equipment, option lists, the field-config
registry — is **one Pydantic-validated JSON document** (`ProjectDocumentV1`; the code
constant `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` in
`backend/features/project_document/document.py` is the authoritative
`schema_version`, bumped by each forward-only migration in
`migrations/upgrade.py`) stored as JSONB.

### 3.1 The tables

```
projects.active_version_id ──▶ project_versions (id, project_id,
                                  parent_version_id,        -- linear history
                                  name, kind, locked,
                                  body            JSONB,    -- the document
                                  schema_version, body_size_bytes,
                                  created_*/updated_*)
                                      ▲
                                      │ (version_id, user_id) PK
                               project_version_drafts (body JSONB,  -- WIP copy
                                  base_version_etag, draft_etag,
                                  last_patched_at, updated_via)
```

### 3.2 Lifecycle — "immutable-by-version"

The CLAUDE.md shorthand is *"versioned, immutable-by-discipline saves."* In
code the unit of immutability is the **version**, not a separately-stored
discipline partition:

- `project_versions.body` is written **only** by the version-save service, in
  one transaction. Edits never mutate a saved body in place.
- Live editing flows into a **per-user draft** (`project_version_drafts`,
  one per `(version_id, user_id)`), created lazily on the first JSON-Patch op.
  Drafts are crash-recovery WIP, **not** versions — they don't appear in
  version lists or diffs.
- **Save** overwrites the active version's body from the draft and deletes the
  draft. **Save As** inserts a *new* `project_versions` row (linear
  `parent_version_id`) and repoints `projects.active_version_id`.
- **Lock** (`locked = true`, used for cert submits / closeouts) makes a version
  effectively immutable: Save returns `409`, and the only forward path is Save
  As into a fresh unlocked version. This is the "immutable revision" guarantee
  certification needs that the relational model couldn't express.
- Concurrency is **ETag-guarded, not lock-based**: drafts and saves carry
  `If-Match` / `If-Match-Version`; mismatches `409`. Browser and MCP writers
  for the same editor share one draft and reconcile through the same ETags.

Full state machine, conflict rules, and the denormalized-metadata invariants:
`save-versioning.md`. Full body shape and the field-config registry:
`data-model.md` §6.2–§6.6.

### 3.3 Boundary notes

- The document stores **catalog values copied in** (class ①) and **asset ids**
  (class ③), never live catalog joins and never durable file URLs.
- MVP deliberately defers document-side query infrastructure (generated
  columns, GIN indexes, sidecar search/shadow tables). The body is the source
  of truth; reporting is reconstructed from it on demand (`data-model.md` §6.4).

---

## 4. Class ③ — Dynamic per-project object files

Every user-uploaded file — datasheet, site photo, HBJSON model, EPW weather
file, generated export bundle — uses **one generic asset backbone**. Feature
surfaces attach metadata; they never invent their own upload/download path or
key scheme.

### 4.1 The split

| Lives in Postgres (`project_assets` row) | Lives in the object store |
|---|---|
| `id` (server-generated `asset_…`), `project_id`, `asset_kind` | the file bytes |
| `object_key`, `r2_etag`, `content_hash_sha256` | a server-rendered `thumb.png` (PDFs/images) |
| `content_type`, `size_bytes`, filenames | |
| `upload_status` (`pending`/`uploaded`/`failed`) | |
| `metadata` JSONB (thumbnail + orphan state) | |
| provenance (`created_by`, `uploaded_at`, soft-delete) | |

### 4.2 Object-key layout (backend-controlled — never derived from filenames)

```
projects/{project_id}/assets/{asset_id}/file.{ext}          # the file
projects/{project_id}/assets/{asset_id}/thumb.png           # generated thumbnail
projects/_orphaned/{project_id}/{asset_id}/{name}           # GC-quarantined
```

### 4.3 Asset kinds (`features/assets/registry.py`)

`datasheet` · `site_photo` · `hbjson` · `simulation_file` · `export_bundle` ·
`epw` · `stat` · `ddy` · `other`. A fixed registry maps each attachable document field
(`project_materials.datasheet_asset_ids`, `assembly_segments.photo_asset_ids`,
`project_glazings.datasheet_asset_ids`, `project_frames.datasheet_asset_ids`,
equipment/thermal-bridge datasheet fields, …) to its allowed kinds, MIME types,
per-cell `max_count`, and per-file size cap.

### 4.4 Upload flow — direct-to-store, three steps

1. **Upload intent** (`POST …/assets/upload-intent`) — validate kind/size/MIME,
   dedup by `(project, content_hash_sha256)`, insert a `pending` row, return a
   **short-lived signed PUT URL** (10 min). The backend never proxies bytes.
2. **Browser PUTs** the bytes straight to the object store via that URL.
3. **Complete upload** (`POST …/complete-upload`) — `HEAD` to verify size,
   read the first 8 KB to validate magic bytes, flip the row to `uploaded`,
   store the ETag, and queue thumbnail rendering as a background task.

### 4.5 Download flow — signed GET, on demand

`GET …/assets/{id}/url` mints signed GET URLs (preview ≈15 min, download ≈60
min with a `Content-Disposition` attachment header) plus a thumbnail URL.
Anonymous viewers can only resolve assets **referenced by the version they're
viewing** (`_asset_is_referenced` / `project_location.epw_asset_id`); MCP needs
`asset:read`.

### 4.6 Delete, orphans, and the 90-day sweep

- "Delete" in the UI = **detach from the active draft** (drop the id from the
  document array). The bytes stay, still reachable by older saved versions.
- Bytes are hard-purged only via GC. `sweep_orphaned_assets.py` finds assets
  that are soft-deleted / failed / expired-pending / unreferenced across **all
  versions and drafts**, then **moves** the object under `…/_orphaned/…` and
  marks the row.
- A bucket **lifecycle rule auto-deletes `…/_orphaned/*` after 90 days** —
  a recovery window before permanent loss.

### 4.7 Consistency model

DB↔store is **not** a distributed transaction. The signed-PUT design means a
`pending` row can exist with no object (upload never finished — the sweep
reaps it). The GC writes the DB orphan-state only *after* the object move
succeeds, so a network failure leaves both sides pointing at the original key.
The DB is authoritative for *what should exist*; the store is authoritative for
*what bytes exist*.

Full contract: `attachments.md`. Backbone schema: `data-model.md` §6.5.

---

## 5. Class ④ — Static app-wide climate bundles

Reference climate data (Phius, PHI) is **app-wide, immutable, and keyed by
`(provider, version)`** — the opposite of per-project assets. It is the same
object store and the **same bucket** as class ③ (one `R2Client` /
`AssetStorage`), just a different key namespace.

### 5.1 The two-tier shape

```
OBJECT STORE                              POSTGRES
climate/{provider}/{version}/dataset.json ──seed──▶ climate_dataset (provider,version,UNIQUE)
  (ClimateBundle: kind, schema_version,                 │ 1:N
   provider, version, label, source,                    ▼
   records[ClimateRecord])              climate_dataset_location (data JSONB = ClimateRecord)
climate/{provider}/{version}/raw/…        (optional raw-source archive, provenance)
```

- **`climate/…` bundle is the source of truth.** It lives in the private store,
  **never git**, precisely because the repo is public and the data is licensed
  (`object_store.py` docstring, PRD D-CS-2).
- The bundle is **self-describing** (carries its own provider/version/label),
  so the seed step is provider-agnostic.

### 5.2 Process vs Seed (deliberately separate)

1. **Process** (rare, operator-only CLI, `features/climate/processing.py`) —
   parse raw provider source (Phius `-mon.txt` tree, PHI `.xlsx`) into a
   standardized `ClimateBundle`, `--upload` it to `climate/{provider}/{version}/`.
2. **Seed** (`features/climate/seeding.py --all`) — pull published bundles from
   the store and upsert `climate_dataset` + `climate_dataset_location`.
   **Idempotent per `(provider, version)`**; `--all` picks up any new provider
   once its bundle exists, with no code change.

> **Prod seeding is on-demand, not on every restart.** Because the data is
> app-wide and immutable, the Render start command stays *migrate + uvicorn*;
> you publish a new bundle to R2 and run the seed CLI only when a new
> `(provider, version)` ships. Rows persist across restarts. (Runbook:
> `ENVIRONMENT.md` → "Climate reference-data seed".)

### 5.3 Per-project climate sources (`project_climate_source`)

Distinct from the app-wide datasets: each project records the climate bases it
uses for different workflows. `kind` dispatches the meaning of `ref` / `data`:

| `kind` | `ref` points at | `data` JSONB |
|---|---|---|
| `phius` / `phi` | `climate_dataset_location.id` | **server-computed** proximity (distance, elevation delta, pass/fail) |
| `weather` | `project_assets.id` (the primary EPW asset, class ③) | EPW/STAT/DDY bundle metadata, HDD/CDD, source URL, and ASHRAE design conditions when fetched |
| `custom` | — (null) | a full inline `ClimateRecord` |

There is no project-wide default source: Phius, PHI, weather, and custom
sources answer different workflow questions. Proximity is **always recomputed
server-side** on attach — never trusted from the client. Phius/PHI read paths
tolerate a stale `ref` after reference-dataset reseeds by returning the stored
source row and cached proximity `data`; create/update still validates that the
referenced dataset location exists.

---

## 6. Pointer / boundary reference

Every cross-store reference in the system, in one place:

| From (Postgres) | Points at | Target | Kind of pointer |
|---|---|---|---|
| `projects.active_version_id` | `project_versions.id` | within Postgres | FK |
| `project_versions.parent_version_id` | `project_versions.id` | within Postgres | FK (linear history) |
| `project_version_drafts.(version_id,user_id)` | version + user | within Postgres | composite FK |
| `project_versions.body[].*_asset_ids[]` | `project_assets.id` | document → registry | **id string** (not a URL) |
| `project_assets.object_key` | `projects/{pid}/assets/…` | Postgres → object store | object key |
| `project_assets.metadata.thumbnail_object_key` | `…/thumb.png` | Postgres → object store | object key |
| `project_hbjson_files.asset_id` | `project_assets.id` | within Postgres | FK (1:1) |
| `project_location.epw_asset_id` | `project_assets.id` | within Postgres | FK |
| `project_climate_source.ref` (weather) | `project_assets.id` | within Postgres | id string |
| `project_climate_source.ref` (phius/phi) | `climate_dataset_location.id` | within Postgres | id string |
| `climate_dataset (provider,version)` | `climate/{provider}/{version}/dataset.json` | Postgres → object store | derived object key |
| document catalog rows (`catalog_origin`) | `catalog_*` row id | document → catalog | **copied value** + origin id (no live join) |

**Who controls keys:** the backend, always. Asset keys are
`projects/{pid}/assets/{server-generated asset_id}/…`; climate keys are
`climate/{provider}/{version}/…`. User filenames are stored for display only
and never appear in a key.

---

## 7. Dev vs Production

Same code, same schema, same key layouts — only the endpoints and credentials
change. The whole point of the MinIO + Docker setup is that the storage
*semantics* (signed URLs, key layout, lifecycle) match production.

| Aspect | Local dev | Render staging / production |
|---|---|---|
| **Postgres** | Docker, host `localhost:5433` → container `5432` (so V1 keeps `5432`) | Render managed Postgres 16 (Ohio); `DATABASE_URL` auto-wired by `render.yaml` |
| **Databases** | two: `ph_navigator_v2` (dev) + `ph_navigator_v2_test` (pytest truncates it) | one app DB (Render auto-suffixes the internal name) |
| **Migrations** | `uv run alembic upgrade head` | run in the backend service **start command** before uvicorn |
| **Object store** | MinIO `http://localhost:9000` (console `:9001`) | Cloudflare R2, region **ENAM** |
| **`R2_ENDPOINT_URL`** | set to the MinIO URL | the `https://{account}.r2.cloudflarestorage.com` endpoint |
| **Bucket** | `ph-navigator-v2-dev` (created by `make object-store-init`) | `ph-navigator-prod` in production; `ph-navigator-v2-dev` only for optional recreated staging |
| **Credentials** | fixed local stand-ins (`phn_minio` / `phn_minio_local_only`) | R2 S3-token creds via Render secrets / Apple Passwords — **never committed** (public repo) |
| **CORS** | MinIO wildcard `*` for signed PUT/GET (local only — never copy to R2) | Production R2 CORS allows only `https://www.ph-nav.com` and `https://ph-nav.com` for `PUT/GET/HEAD` |
| **Public access** | n/a | **off** — signed URLs only |
| **Orphan lifecycle** | not enforced (manual sweep) | bucket rule auto-deletes `…/_orphaned/*` after 90 days; multipart abort after 7 days |
| **Climate seed** | `make`-driven dev bootstrap seeds a small NY slice into MinIO | **on-demand**: publish bundle to R2 + run `climate.seeding --all` |
| **Config source** | `backend/.env` (gitignored, from `.env.example`) | process env from `render.yaml`; secrets `sync: false` |

Boundaries that must **never** blur between the two:

- The MinIO wildcard CORS and the local stand-in credentials are local-only.
- Render DB credentials never go into `backend/.env`; local dev never points at
  the Render DB except for the documented one-off staging seed/reset.
- No `.env` overlays and no `requirements.txt` — config is `Settings` fields
  (`config.py`) and deps are `pyproject.toml` + `uv.lock`.

Operational detail (production Render/R2/DNS, env-var tables, optional
staging Blueprint re-provision, R2 dashboard/CORS setup, one-off seeds):
`context/PRODUCTION_DEPLOYMENT.md` and `context/ENVIRONMENT.md`.

---

## 8. Why these boundaries (rationale)

- **Document model over a relational entity tree.** Certification needs stable,
  immutable revisions and clean export/diff; LLM/MCP usefulness needs
  predictable whole-document JSON. A versioned JSONB body delivers both without
  a second ORM domain model competing with the Pydantic document.
  (`TECH_STACK.md` "Persistence Decision".)
- **Thin relational layer beside it.** Things that are *not* a versioned
  property of the energy model — who you are, where a project sits in its
  lifecycle, shared catalogs, the asset registry, audit — are normal rows.
  Keeping them out of the body avoids versioning data that has no business
  being snapshotted.
- **Bytes in an object store, not Postgres.** Datasheets, photos, and 5–20 MB
  HBJSON/EPW files don't belong in DB rows. The store gives cheap durable blob
  storage, direct browser upload/download via signed URLs (the API never
  proxies bytes), and a lifecycle engine for orphan cleanup.
- **Signed URLs + private bucket, because the repo is public and the data is
  licensed.** No durable public URLs means a leaked document field can't expose
  a licensed datasheet or a private project file.
- **Climate as static reference, copied-in like catalogs.** Climate bundles and
  catalogs are shared libraries, not project state. They are immutable, seeded
  on demand, and projects copy values in (with provenance) rather than
  live-joining — so updating a library never silently rewrites finished work.
- **One bucket, two namespaces; one asset backbone.** A single storage
  abstraction (`AssetStorage` / `R2Client`) serves both `projects/…` and
  `climate/…`, and a single `project_assets` backbone serves every upload kind.
  Fewer moving parts, one set of credentials, one lifecycle config.

---

## 9. Durability — what is backed up, and what is not

The two stores have **different** protection, and the asymmetry is deliberate.

| Class | Store | Protected by |
| --- | --- | --- |
| ① Relational metadata | Postgres | Render PITR (3d) **+ off-site encrypted daily dumps** (30 daily / 12 monthly) |
| ② Versioned JSONB documents | Postgres | same — these are inside the dump |
| ③ Dynamic per-project assets | R2 `ph-navigator-prod` | R2 durability only — **no independent backup** |
| ④ Static climate bundles | R2 | R2 durability only — regenerable from source |

**Postgres is fully backed up off-site.** A daily GitHub Actions job dumps the
whole database, encrypts it with `age` to a key held offline, and stores it in a
separate R2 bucket (`phn-db-backups`) outside Render. Operating since
2026-07-20, restore drill passed. See `context/DATABASE_BACKUPS.md`.

**Object-store bytes are not**, by decision (D-9 in the archived backup packet).
Most assets are re-derivable from the Dropbox source files, and the documents —
the irreplaceable part — live in Postgres.

### The cross-store consequence

Because Postgres is backed up and R2 is not, the two stores can be restored to
**different points in time**. After a DB-only restore:

- `project_assets` rows still reference R2 object keys.
- If R2 is intact, those keys resolve and nothing is lost.
- If R2 is not, the documents are structurally intact but some file **bytes** are
  missing — a dangling reference, not a corrupt document.

This is accepted for now. Anything that must survive independently of R2 belongs
in Postgres, not the object store.

## 10. Related docs

- `context/ENVIRONMENT.md` — ports, env vars, Render/R2 setup & runbooks.
- `context/TECH_STACK.md` — persistence & object-storage decision record.
- `context/technical-requirements/data-model.md` — full schema + document shape.
- `context/technical-requirements/attachments.md` — asset upload/attach contract.
- `context/technical-requirements/save-versioning.md` — draft/version state machine.
- `context/PRD.md` §5–§6, §12 — architecture overview and stack/deployment.
- `context/DATABASE_BACKUPS.md` — off-site backup system + restore runbook.
