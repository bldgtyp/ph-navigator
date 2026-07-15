---
DATE: 2026-05-12
STATUS: CANONICAL TECHNICAL REQUIREMENTS — extracted from context/PRD.md to keep startup context small.
  DATE is stale as a "last verified" signal (routes have been added
  piecemeal, e.g. material-catalog-drift, without bumping it) — treat this
  file's route inventory as a floor, verify against
  `backend/features/*/routes.py` before relying on completeness.
RELATED: context/PRD.md §9, context/TECH_STACK.md
---

# PH-Navigator V2 — API Requirements

This file preserves implementation-level requirements that were formerly
embedded in `context/PRD.md`. Load it on demand when touching this surface;
do not make it part of default startup context.

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
  versioning. Before first deploy, `/api/v1` serves only the current
  clean-baseline project-document shape (`schema_version: 1`) and
  rejects unsupported bodies. Future body-schema bumps use the beta
  schema-evolution lane in §10.5: forward-only project-document upgraders,
  fixtures, and the audit CLI.
- **Deprecation marking.** Endpoints scheduled for removal carry a
  `Deprecation: true` response header and an entry in
  `/api/v1/deprecations`.

This costs ~zero on day 1 (just a router prefix) and saves real pain
later.

### 9.2a Auth

```
POST   /api/v1/auth/login       email/password sign-in; sets HTTP-only
                                session cookie
GET    /api/v1/auth/session     current editor session; slides expiry
POST   /api/v1/auth/logout      invalidates current session and clears cookie
```

Login failures return the generic `invalid_credentials` structured
error. Session failures distinguish `not_authenticated`,
`session_expired`, and `session_invalidated` so the frontend can choose
the correct re-auth modal copy. All mutating auth routes still pass the
same Origin policy as later project writes.

TB-01 implementation details:

- Session cookie name: `phn_session`.
- Cookie flags: `HttpOnly`, `Path=/`, configurable
  `SESSION_COOKIE_SAMESITE` defaulting to `lax`; `Secure` is off only
  for local/test environments and on otherwise. Split-origin staging
  deployments set `SESSION_COOKIE_SAMESITE=none`.
- Session lifetime: 60-minute sliding expiry. `/auth/session` returns
  the current user and `expires_at`.
- Every API response includes `X-Request-ID`; callers may send one or
  let the backend generate it.
- Mutating browser requests under `/api/` require an `Origin` matching
  the configured CORS origins.
- The frontend currently uses a route-level auth guard for the empty
  dashboard. The in-place re-auth modal remains required before the
  first editable project surface ships.

### 9.2b Admin user management (added, undated — shipped 2026-06-29)

```
GET    /api/v1/admin/users                       list users
POST   /api/v1/admin/users/invite                invite a new user (issues account_tokens link)
POST   /api/v1/admin/users/{user_id}/reset-link   issue an admin reset-link
POST   /api/v1/admin/users/{user_id}/deactivate   deactivate a user
POST   /api/v1/admin/users/{user_id}/reactivate   reactivate a user
PATCH  /api/v1/admin/users/{user_id}/admin        grant/revoke the Admin preset
PATCH  /api/v1/admin/users/{user_id}/name         edit a user's name
PATCH  /api/v1/admin/users/{user_id}/email        edit a user's email
GET    /api/v1/admin/users/{user_id}/audit        per-user admin-action audit trail
```

All gated server-side by the `admin.users.manage` capability; see
`context/PRD.md` §4 and `context/technical-requirements/stack-auth-migration.md`
§13.

### 9.2c MCP tokens (added, undated)

```
GET    /api/v1/projects/{project_id}/mcp-tokens              list a project's MCP tokens
POST   /api/v1/projects/{project_id}/mcp-tokens               issue a token (plaintext shown once)
POST   /api/v1/projects/{project_id}/mcp-tokens/{id}/revoke   revoke a token
```

See `context/mcp.md` for scopes and token-issuance conventions.

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

If the saved body cannot validate as the current project-document
schema, `GET /document` returns the read-safe envelope described in
§10.5 instead of a typed document: `schema_version_unsupported: true`,
the saved/current schema versions, request id, and the raw body. For
MVP, the durable contract is raw Project JSON recovery; this envelope is
a Phase 1 aid, not a guarantee that older/invalid documents remain
editable. Typed table reads remain validation-gated.

`/document/tables/{name}` and `/draft/tables/{name}` are generic route
shapes, but table behavior is registry-owned. A supported table must be
registered with payload validation, response serialization, document
replacement, row extraction for downloads/MCP, and diff extraction.
Unsupported names return structured `404 document_table_not_found` from
the registry rather than a route-local special case.

### 9.5 Drafts (autosave / crash recovery)

```
GET    /api/v1/projects/{pid}/versions/{vid}/draft                   current user's draft
                                                                     summary: source,
                                                                     ETags, dirty tables,
                                                                     lock/edit state
                                                                     (200 even when clean)
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

If the saved body or current user's draft body cannot validate as the
current project-document schema, editor `GET /draft` returns the same
read-safe envelope shape as `GET /document`. This keeps the editor out
of a broken tab, but mutating draft routes remain validation-gated.

All mutating REST writes accept `Idempotency-Key`. Replay semantics:

- scope = `(user_id, route, key)`;
- TTL = 24 hours from first completed response;
- replay after completion returns the cached response body and status;
- same key with a different body on the same route returns
  `409 idempotency_key_reuse`;
- in-progress duplicate requests return `409 idempotency_in_progress`.

Draft writes additionally use `If-Match` / `If-Match-Version` ETags as
defined in §8.5 and the state-machine note.

Heat Pumps Phase 0 adds active-version convenience endpoints that still
write through the same draft buffer and ETag gates:

```
GET   /api/v1/projects/{pid}/equipment/heat-pumps
PATCH /api/v1/projects/{pid}/equipment/heat-pumps/{table}
```

`{table}` is one of `outdoor-equip`, `indoor-equip`, `outdoor-units`,
or `indoor-units`. The PATCH body is one JSON-Patch-style op against a
row id path (`/-` for add, `/{row_id}` for replace/remove). Delete ops
that would cascade accept `?dry-run=true` and return
`cascade_preview.affected[]` without mutating.

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
Project JSON returns the raw document body. Table JSON returns a scoped
object keyed by the registered table name, e.g. `{ "rooms": [...] }`.

### 9.8 Catalog

```
GET    /api/v1/catalog/{table}                              list records
POST   /api/v1/catalog/{table}                              create record
GET    /api/v1/catalog/{table}/{rid}                        record + version list
POST   /api/v1/catalog/{table}/{rid}/versions               create new version
PATCH  /api/v1/catalog/{table}/{rid}/versions/{vid}         in-place edit (current only)
DELETE /api/v1/catalog/{table}/{rid}                        soft delete record
```

TB-07 implementation status (2026-05-14): Materials is the first catalog
and ships under a per-catalog prefix rather than the generic
`/catalog/{table}` shape — the live routes are
`/api/v1/catalogs/materials` with list/create/get/patch/delete plus a
`POST /{rid}/reactivate` for soft-undelete. `PATCH` targets the
identity row and the current version in one in-place edit; explicit
`/versions` sub-routes and new-version creation are deferred until a
second catalog requires the generic shape (TB-08 should pick: keep
per-catalog prefixes consistent across catalogs, or generalize to
`/catalog/{table}` once 2+ catalogs exist). Every response carries
`catalog_schema_version: 1` and the joined `current_version_id` /
`version_label` / `version_date` so downstream pickers can build a
`catalog_origin` block at pick time.

### 9.9 Public links

**Removed 2026-05-10.** Per the updated §4 access model, there are
no per-share tokens, no `/v/{token}` routes, and no public link
create / revoke endpoints. Project URLs (`/projects/{id}/...`) are
public-readable for all visitors; the backend gates writes behind
the editor session token, and the frontend gates edit affordances
by auth state. There is nothing to manage at the public link level
because public links don't exist as a separate concept.

### 9.9a Project location

Project location is relational project metadata, not a versioned
project-document table. Reads are public-readable with privacy projection;
writes and derive actions are editor-only.

```
GET  /api/v1/projects/{pid}/location
PUT  /api/v1/projects/{pid}/location
POST /api/v1/projects/{pid}/location/geocode
POST /api/v1/projects/{pid}/location/elevation
POST /api/v1/projects/{pid}/location/derive/{kind}   # kind: phius | phi | weather
POST /api/v1/projects/{pid}/climate/sources/ashrae/current
GET  /api/v1/projects/{pid}/climate/epw-roster                  # ?region= &near= &limit=
POST /api/v1/projects/{pid}/climate/sources/weather/from-catalog
POST /api/v1/projects/{pid}/climate/sources/weather/from-upload
```

`GET /location` returns coordinates, coarse public geodata, EPW attachment
metadata, and editor-visible address fields. For anonymous/viewer reads, the
same route returns `site_address: null` while preserving public fields such as
`latitude`, `longitude`, `elevation_m`, `county`, `state`, `country`, and
`climate_zone`.

`PUT /location` accepts only editable fields: coordinates, elevation, time
zone, true north, site address, city/state, and EPW fields. Server-derived
fields (`county`, `county_fips`, `country`, `climate_zone`,
`geodata_provenance`) are not accepted from the client. Setting the location is
the single front door for geodata: when raw coordinates change through this
route, the server re-derives county/state/FIPS (FCC Area API → Census),
elevation (USGS EPQS → Open-Meteo), and `climate_zone` (bundled PNNL 2021 IECC
county table), and persists them with per-field provenance. A client-supplied
`state` or `elevation_m` in the same write is preserved; clearing the
coordinates clears the derived geodata. The heavy external lookups run before
the write transaction is opened.

`POST /location/geocode` is an editor-only address-or-town search. Exact
town/locality + two-letter state matches are served from the bundled,
integrity-validated 2025 Census Gazetteer index; an optional valid five-digit
ZCTA ranks ambiguous same-state results by distance but never replaces the
locality internal point. ZIP-only input returns no candidates. Queries without
a locality match use the live keyless Census oneline address geocoder.
Candidates include `result_type: "address" | "locality"`; locality candidates
always have `street_address: null`. A broken bundled index returns
`503 locality_index_unavailable` without address fallback, while live Census
address failures return `502 geocoder_unavailable`.

`POST /location/elevation` is an editor-only stateless lookup used by the Set
Location modal to auto-fill the elevation field. It resolves elevation for the
given coordinates (USGS EPQS → Open-Meteo) and returns a suggestion without
persisting anything or attaching climate sources.

`POST /location/derive/{kind}` is editor-only and attaches one climate type from
the nearest source for the project's *saved* coordinates (no coordinates are
sent in the body); it returns `409 location_not_set` when the location is unset.
Each Climate page owns its own action:

- `kind=phius` / `kind=phi` — when the seeded provider dataset exists, attaches
  or updates the nearest provider location as a `project_climate_source` row.
  Its `data` includes the pinned dataset version, great-circle distance in
  miles, elevation delta in feet, and the Phius hard pass/fail or PHI advisory
  status/message.
- `kind=weather` — resolves the nearest OneBuilding EPW station from the
  configured XLSX catalog URLs (or the built-in WMO-region defaults), downloads
  the station zip, stores the `.epw` bytes as a project EPW asset, records the
  EPW reference on `project_location`, and attaches/upserts a **single**
  `kind='weather'` source (the EPW + STAT bundle): `ref=<asset_id>` (the primary
  EPW file asset) with `data.stat_metrics` (HDD65, CDD50, record high/low,
  missing-field flags) and `data.design_conditions` (heating + cooling DB/MCWB
  at 0.4% / 1% / 2% plus the dehumidification pair) both parsed from the zip's
  `.stat` companion, alongside station metadata, source URL, and `fetched_at`.
  The parser records the basis/edition stated by the `.stat` file rather than
  assuming a fixed edition.

`POST /climate/sources/ashrae/current` is editor-only and performs the
copyright-sensitive ashrae-meteo.info path for one nearest station only. It uses
the saved project coordinates, accepts `{ "ashrae_version": "2009" | "2013" |
"2017" | "2021" | "2025" }`, and **replaces the `data.design_conditions` on the
project's existing `weather` source in place** (recording a
`data.design_conditions_source` with `provider='ashrae_meteo'` and a source
URL). It returns `409 weather_source_required` when no weather file is set yet.

`GET /climate/epw-roster` is the weather "Select from map" picker feed
(editor-only): OneBuilding EPW catalog stations for the project, nearest-first,
each with `distance_mi` and `elevation_delta_ft` against the site. `?region=`
filters by US state (default = the project's state); `?near=true` sweeps the
nearest across the USA (`?limit=` caps the page). It carries **no proximity
verdict** — distance/elevation are informational only (the picker has no
certification gate). Returns `409 project_location_required` without a site.

`POST /climate/sources/weather/from-catalog` is editor-only and attaches the
station the picker selected (`{ "url": "<catalog zip URL>" }`): it downloads +
parses + stores the EPW + STAT bundle as the single `weather` source — the same
shape as the nearest-derive — and writes the project EPW pointer onto the
location. Unknown URLs return `422 epw_catalog_entry_not_found`.

`POST /climate/sources/weather/from-upload` is editor-only and attaches a
manually-uploaded bundle by its already-stored asset ids (`{ "epw_asset_id",
"stat_asset_id"?, "ddy_asset_id"? }`). The EPW is required (its header supplies
the station); the `.stat` (if given) is parsed into the same metrics + design
conditions; the `.ddy` is stored by id only. The companions upload as `stat` /
`ddy` asset kinds. A wrong-kind ref returns `422 asset_kind_mismatch`.

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
GET    /api/v1/projects/{pid}/assets/{aid}/url                  signed preview/download
                                                                  URLs + expires_at
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

`download` is the stable link to place in rendered Markdown or explicit
Download UI anchors; it performs access checks, then redirects to a
short-lived signed R2 URL with attachment disposition. `url` is for
clients that need the signed URL JSON envelope directly (viewer fetches,
MCP tools, and batch download flows). That envelope includes a
`preview_url` without attachment disposition for inline image/PDF
preview and a `download_url` with attachment disposition for explicit
download.

`attach` and `detach` are convenience wrappers around the draft JSON-Patch
API. They require `project:write` plus `asset:write`, obey the same ETag
rules as other draft writes, and only mutate asset-id arrays in the
project document. They do not mutate saved versions directly.

#### 9.10.1 Bulk asset endpoints

These complement the single-asset routes above. They are available for
multi-file browser workflows and LLM-agent workflows through MCP
(`llm-mcp-schema.md` §10.3). Current `<AttachmentCell>` code still loops
single-file upload calls sequentially; move it to `bulk-upload-intent`
when the parallel upload coordinator lands. Full contract:
`attachments.md`.

```
POST   /api/v1/projects/{pid}/assets/bulk-upload-intent
       body: { items: [ { asset_kind, original_filename, content_type,
                          size_bytes, content_hash_sha256, display_name? }
                        ... ] }
       returns: { items: [ { asset_id, upload_url, expires_at,
                             duplicate_of? } ... ] }
```
Batch version of `upload-intent` for multi-file drop. Each item is
idempotent on `(project_id, content_hash_sha256)` via the existing
`Idempotency-Key` header rule (§9.5). Items resolving to an existing
asset return that `asset_id` plus `duplicate_of` instead of issuing a
new upload URL.

```
GET    /api/v1/projects/{pid}/assets/bulk-urls?ids=<csv>
       returns: { items: [ { asset_id, preview_url, preview_expires_at,
                             download_url, download_expires_at,
                             thumbnail_url, thumbnail_status,
                             thumbnail_expires_at, content_type,
                             original_filename, size_bytes } ... ] }
```
Batch URL resolver. Used by `<AttachmentCell>` to render all of a
cell's thumbnails in one HTTP call. Cap: 100 ids per call; over-cap
returns `400 asset_bulk_overflow`.

```
POST   /api/v1/projects/{pid}/assets/bulk-download
       body: { filter: { table_key?, column_key?, asset_ids?, kind? },
               filename_pattern?: "{table}/{row.name}__{filename}",
               include_manifest_csv?: true }
       returns: 202 + { job_id, status_url }
```
DB-backed zip job. Current implementation completes the zip work inside
the request, stores the final job state, and still returns a `status_url`
for a consistent polling/read path. The server streams each asset from
R2, packages a zip with the resolved per-file paths (default pattern
`{table}/{row.name}__{filename}`), prepends a top-level `MANIFEST.csv`
mapping rows to filenames, uploads the zip back to R2 as
`asset_kind = 'export_bundle'`, and exposes it through normal asset
download routes. The client polls or reads `status_url` (see §9.10.2)
until the job reports `completed`, then GETs the export bundle's asset.

Template variables available in `filename_pattern`:
`{table}`, `{row.id}`, `{row.name}`, `{row.<core_key>}`,
`{filename}`, `{ext}`, `{kind}`.

#### 9.10.2 Jobs

Generic async-job polling. Shared with HBJSON extraction; reused by
bulk-download.

```
GET    /api/v1/projects/{pid}/jobs/{job_id}
       returns: { id, kind, status, progress, result_asset_id?,
                  error?, created_at, updated_at }
```

`status` ∈ `'queued' | 'running' | 'completed' | 'failed'`.
`progress` is a 0.0–1.0 float, advisory only.

### 9.10a Aperture Catalog Drift Report

```
GET /api/v1/projects/{pid}/versions/{vid}/apertures/drift-report?source=draft|version
```

Returns the per-field drift report for catalog-sourced FrameRef /
GlazingRef values in `tables.apertures[]`. The route is editor-only,
omits hand-entered refs without `catalog_origin`, and reports each
ref as `in_sync`, `drifted`, or `catalog_row_missing` with per-field
catalog-vs-project deltas plus the `local_overrides` flag. Apply
actions write through the `refreshRefFromCatalog` aperture command on
`POST /apertures/command`.

### 9.10a-1 Apertures HBJSON export (added, undated)

```
GET /api/v1/projects/{pid}/versions/{vid}/apertures/hbjson?source=draft|version
```

Returns the V1-shaped window-constructions payload for the Rhino/honeybee_ph
import path, keyed by escaped aperture-element identifier. View-access
gated (`APERTURES_EXPORT_HBJSON` capability); see
`context/technical-requirements/hbjson-export.md` for the sibling model-wide
export.

### 9.10b Envelope (Assembly Builder)

```
GET  /api/v1/projects/{pid}/versions/{vid}/envelope?source=draft|version
GET  /api/v1/projects/{pid}/versions/{vid}/envelope/assemblies/{aid}/thermal?source=draft|version
GET  /api/v1/projects/{pid}/versions/{vid}/envelope/material-catalog-drift?source=draft|version
GET  /api/v1/projects/{pid}/versions/{vid}/envelope/export/hbjson
POST /api/v1/projects/{pid}/versions/{vid}/draft/envelope/commands
```

The `envelope` slice composes assemblies, project materials, and per-
segment use-site notes / photo refs for the Assembly Builder UI. All
edits flow through the semantic-command POST; there is no per-field
PATCH endpoint. See:

- `context/technical-requirements/envelope-commands.md` — the 23
  command kinds, request shapes, and conflict codes shared by the
  frontend and the MCP server.
- `context/technical-requirements/envelope-thermal-preview.md` — the
  thermal R/U preview contract, flag vocabulary, and input-hash cache
  semantics.
- `context/technical-requirements/envelope-catalog-drift.md` — the
  five drift states and the `refresh_project_material_from_catalog`
  three-action contract.
- `context/technical-requirements/envelope-hbjson-export.md` — the
  saved-version-only opaque-construction export payload.

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
GET /api/v1/schemas/room/v1.json
GET /api/v1/schemas/{schema_slug}/v1.json
GET /api/v1/openapi.json
```

Schemas are served from Pydantic-generated contracts. The `v1.json`
suffix is the *document schema* version, independent of the API version
(see §10.5). Dedicated project-document, Room row, and Rooms table
envelope endpoints remain for stable inspector links. Registered table
row schemas are served through `{schema_slug}` from the table-contract
registry; current slugs include `aperture-type`, `project-material`, and
`assembly-segment`. Catalog (Materials, Frame, Glazing) schemas will be
added as those table contracts land.
