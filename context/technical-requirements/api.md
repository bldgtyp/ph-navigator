---
DATE: 2026-05-12
STATUS: CANONICAL TECHNICAL REQUIREMENTS — extracted from context/PRD.md to keep startup context small.
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
  versioning. `/api/v1` may serve project documents at
  `schema_version: 1` *or* `schema_version: 2`; clients that don't
  know v2 must check and refuse, or upgrade. See §10.5.
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
