---
DATE: 2026-06-12
TIME: -
STATUS: Implemented 2026-06-12 — all gates green (pytest, Vitest,
  Playwright e2e, make ci). Evidence + implementation amendments in
  STATUS.md ("Phase 1 — implemented"). Notable design calls made during
  implementation: (1) re-linking a soft-deleted file's bytes RESTORES the
  old row (asset-layer hash dedup returns the same asset_id, which is
  UNIQUE here across live and deleted rows); (2) the hbjson upload policy
  is a kind-level branch in the assets intent validation — without it,
  hbjson intents fell through to the thermal-bridge ATTACHMENT_FIELDS
  config and its 25 MB cap; (3) the asset `_validate_magic` JSON sniff
  was fixed for files larger than its 8 KB prefix (latent bug that
  rejected every real HBJSON at complete-upload).
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff for Model Viewer Phase 1 — HBJSON file
  management (US-VIEW-1). Backend table + routes + MCP tools; frontend
  Model tab, file chip + popover, upload flow. No 3D rendering.
RELATED:
  - planning/features/model-viewer/PLAN.md (phase sequence)
  - planning/features/model-viewer/PRD.md (§3 data flow, §5 backend)
  - planning/features/model-viewer/UI_SPEC.md (§2 file chip, §8 states)
  - context/user-stories/40-model-viewer.md (US-VIEW-1 — canonical
    acceptance criteria; this doc amends its DDL, see §3.1)
  - context/CODING_STANDARDS.md (mandatory for all feature code)
---

# Phase 1 — HBJSON file management

## 1. Goal

An editor can upload `.hbjson` files into the Model tab, see them in a
dated list, rename them, add notes, pick one (reflected in the URL),
and soft-delete them. A viewer can list and pick but not mutate. No 3D
yet — the viewer area renders the empty/placeholder state.

Every US-VIEW-1 acceptance criterion (1–14) applies except where this
doc records an amendment. Read US-VIEW-1 in full before starting.

## 2. Required reading (in order)

1. `context/user-stories/40-model-viewer.md` — US-VIEW-1 only.
2. `planning/features/model-viewer/UI_SPEC.md` §2 (file chip +
   popover), §8 (empty state — Phase-1 subset).
3. `planning/features/model-viewer/decisions.md` — D-13 (geometry
   summary columns now, job in Phase 2), D-06 (no sonner / no global
   toast system).
4. `context/CODING_STANDARDS.md` — backend + frontend sections.
5. Existing code to mirror:
   - `backend/features/assets/` (routes/service/repository/schemas —
     the upload backbone this phase rides on)
   - `backend/features/project_status/` + its frontend twin
     `frontend/src/features/project_status/` (a complete, small
     feature pair showing both module patterns)
   - `backend/features/mcp/tools.py` + `server.py` (MCP tool pattern)

## 3. Backend work

New module: `backend/features/model_viewer/` with `routes.py`,
`models.py`, `service.py`, `repository.py` (per CODING_STANDARDS).
Register the router in `backend/main.py` alongside the existing
`include_router` calls.

### 3.1 Migration — `project_hbjson_files`

New Alembic file in `backend/alembic/versions/`, named per the
existing convention (`YYYYMMDD_NNNN_short_title.py`, next free
sequence number). Use `op.create_table` style like
`20260526_0011_project_assets_and_jobs.py`.

**Type corrections vs. the US-VIEW-1 DDL sketch** (the story predates
the real schema; the live DB is authoritative):

- `users.id` is **UUID**, not INTEGER → `uploaded_by` is `sa.Uuid()`.
- `project_assets.id` is **TEXT** → `asset_id` is `sa.Text()`.
- Name the uploader column `uploaded_by` (matches `project_assets.
  created_by` naming style; the story's `uploaded_by_user_id` is
  superseded).

Columns:

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `server_default=gen_random_uuid()` |
| `project_id` | UUID NOT NULL | FK `projects.id` ON DELETE CASCADE |
| `asset_id` | TEXT NOT NULL UNIQUE | FK `project_assets.id` |
| `display_name` | TEXT NOT NULL | default = original filename minus extension |
| `notes` | TEXT NULL | max 1000 chars enforced in service/model |
| `uploaded_by` | UUID NOT NULL | FK `users.id` |
| `uploaded_at` | TIMESTAMPTZ NOT NULL | `server_default=now()` |
| `extracted_volume_m3` | DOUBLE PRECISION NULL | D-13: column now, job Phase 2 |
| `extracted_envelope_area_m2` | DOUBLE PRECISION NULL | " |
| `extracted_floor_area_m2` | DOUBLE PRECISION NULL | iCFA; " |
| `extraction_status` | TEXT NOT NULL DEFAULT `'pending'` | `pending`/`success`/`failed` |
| `extraction_error` | TEXT NULL | |
| `extracted_at` | TIMESTAMPTZ NULL | |
| `content_hash_sha256` | TEXT NOT NULL | denormalized from `project_assets` at link time — exists so the dedup uniqueness can be a DB constraint (a partial unique index can't span a join) |
| `deleted_at` | TIMESTAMPTZ NULL | soft delete |

Indexes: `(project_id, uploaded_at DESC)` partial `WHERE deleted_at
IS NULL` (serves the newest-first list); **partial UNIQUE**
`(project_id, content_hash_sha256) WHERE deleted_at IS NULL`
(makes the dedup contract race-proof — see §3.3). Provide a real
`downgrade()`.

Nothing reads the `extracted_*` columns in this phase (D-13 —
the US-ENV-14 Airtightness consumer is FUTURE).

### 3.2 Routes

`APIRouter(prefix="/api/v1/projects/{project_id}/hbjson-files",
tags=["model-viewer"])`. Use the same access dependencies as assets:
`require_project_view_access` / `require_project_edit_access` from
`features.projects.access`.

| Route | Access | Behavior |
|---|---|---|
| `GET ""` | view | List non-deleted rows newest-first. Each row joins asset facts: `size_bytes`, `original_filename`, uploader display name — plus `extraction_status` and `extraction_error` (D-16: drives the "Failed to parse" badge; all rows stay `pending` until the Phase 2 job exists). |
| `POST ""` | edit | **Link step**: body `{asset_id, display_name?, notes?}`. Validates the asset exists in this project, `asset_kind='hbjson'`, `upload_status` complete. Runs content-hash dedup (§3.3) → `409` with the existing file's `{id, display_name}` payload on a duplicate. Creates the metadata row (`extraction_status='pending'`). |
| `PATCH "/{file_id}"` | edit | Rename (`display_name`, trimmed, non-empty) and/or `notes` (≤1000 chars). |
| `DELETE "/{file_id}"` | edit | Soft delete (`deleted_at = now()`). Returns 204. Leave a one-line comment seam where the US-ENV-14 airtightness-pin clear will go — that table does not exist yet, so no code. |
| `GET "/{file_id}/download"` | view | Resolve via the existing asset signed-URL path (reuse `AssetService`; do not re-implement R2 signing). |

File **bytes** ride the existing generic asset flow — the frontend
calls `POST .../assets/upload-intent` (with `asset_kind='hbjson'`),
PUTs to the signed URL, then `POST .../assets/{id}/complete-upload`,
then this module's `POST /hbjson-files` link step. Do not build a
parallel upload path.

**Upload constraints** (100 MB cap per D-17; `.hbjson`/`.json` extension;
content-type `application/json`): check where `AssetService.
create_upload_intent` validates kind/size today. If validation is
per-attachment-field (see `assets/registry.py` — `ATTACHMENT_FIELDS`
is document-attachment oriented and does NOT govern this flow), add
the hbjson constraints in the model_viewer service before requesting
the intent, and enforce server-side wherever the existing flow puts
kind-level caps. Surface both rules client-side too (§4.3).

### 3.3 Content-hash dedup

`project_assets.content_hash_sha256` is already captured at intent
time. Dedup rule (US-VIEW-1 crit. 3): a `POST /hbjson-files` link is
rejected `409` when another **non-deleted** `project_hbjson_files`
row in this project has the same hash. The link step copies the
asset's hash into `content_hash_sha256` and inserts; enforcement is
two-layer: a repository SELECT first (so the 409 can carry the
existing file's `{id, display_name}` for the friendly "[Switch]"
message), with the §3.1 partial unique index as the backstop — catch
the unique-violation and map it to the same 409 payload, so two
editors uploading the same file concurrently can't both land.
(Checking at link time — not intent time — keeps the asset flow
generic; the few wasted bytes on a rejected duplicate are
acceptable. The client may also pre-check by listing files if it
wants to skip the upload, but the server check is the contract.)
On 409, the orphaned asset should be deleted via the existing asset
delete path so R2 GC reclaims it.

### 3.4 MCP tools

Follow `backend/features/mcp/tools.py` (`tool_*` functions) +
`server.py` stub registration. Add: `tool_list_hbjson_files`,
`tool_create_hbjson_file` (link step), `tool_rename_hbjson_file`,
`tool_delete_hbjson_file`, `tool_get_hbjson_file_download_url`.
Reuse `features/mcp/helpers.py` for access/error handling. Upload
intent + complete-upload are already asset-level; do not duplicate.

## 4. Frontend work

New module: `frontend/src/features/model_viewer/` mirroring the
`project_status` layout: `api.ts`, `hooks.ts`, `query-keys.ts`,
`types.ts`, `components/`, `routes/ModelTab.tsx`,
`model_viewer.css`.

### 4.1 Tab wiring

The `model` tab already exists in `PROJECT_TABS`
(`frontend/src/features/projects/lib.ts`) and currently falls through
to the placeholder in
`frontend/src/features/projects/components/ProjectTabContent.tsx`.
Add a `tab === "model"` branch rendering `<ModelTab project={...} />`.
Update `TAB_COPY.model` if it remains visible anywhere.

### 4.2 File chip + popover (UI_SPEC §2)

- Floating top-left chip: `▦ {display_name} · {date} ▾`, truncate
  ~28 ch. Always visible (it is also the upload entry point).
- Popover (~360 px): drop zone (editors only) → divider → file rows
  newest-first → divider → "Refresh list".
- Row: name (+ quiet `(Latest)` on the newest row — independent of
  the active checkmark), `{size} MB · {relative time} · {uploader}`,
  notes sub-row italic/muted, active row check + subtle bg, `⋯` menu
  (Rename · Edit notes · Download · Delete) — editors; viewers see
  Download only.
- Rows with `extraction_status === 'failed'` show a quiet
  destructive-token **"Failed to parse"** badge, tooltip =
  `extraction_error` (D-16). Build it now from the list payload —
  it stays invisible until the Phase 2 job can fail.
- Inline rename: saves on blur/Enter; empty rejected. Notes editor:
  textarea, 1000-char max, saves on blur.
- Delete: confirm dialog per US-VIEW-1 crit. 9, **but omit the
  airtightness-pin sentence** — US-ENV-14 does not exist yet
  (deliberate simplification, consistent with D-13; restore the
  sentence when that feature lands). If the deleted file was active,
  switch to next-newest or empty state.

### 4.3 Upload flow

1. Validate locally: extension `.hbjson`/`.json` (case-insensitive),
   ≤100 MB (D-17). Rejection messages per US-VIEW-1 crit. 3 as
   amended.
2. Compute SHA-256 via Web Crypto (`crypto.subtle.digest`).
3. `POST upload-intent` (`asset_kind='hbjson'`) → PUT with progress
   (thin progress bar across the drop zone — no modal) →
   `complete-upload` → `POST /hbjson-files`.
4. On `409` dedup: message *"This file matches an existing upload
   ({name}). Switch to it instead?"* with a **[Switch]** action that
   activates the existing file.
5. On success: new file becomes active; list refetches.

**Message surface:** there is no global toast system and sonner is
banned (D-06). Render validation/dedup/error messages inline inside
the popover (a small status line under the drop zone). Check first
whether an app-wide inline-notice component already exists and reuse
it.

### 4.4 Active file + URL

- TanStack Query for the list (`query-keys.ts` convention as in
  `project_status`).
- Active file id ⇆ `?file={id}` via `useSearchParams`; default =
  newest; in-session only (US-VIEW-1 crit. 6).
- Invalid/missing `?file=` falls back to newest without error.
- Lay the groundwork store now: create `store.ts` exporting the
  Zustand `modelViewerStore` with just `activeFileId` (synced from
  URL) — later phases extend it. Zustand `^5.0.2` is already a
  dependency.

### 4.5 Empty / placeholder states

- No files: centered card per UI_SPEC §8 (drop zone CTA for editors,
  message-only for viewers). The lit-scene/grid backdrop arrives in
  Phase 3 — for now a plain surface-token background.
- Files exist: placeholder panel "3D viewer arrives in Phase 3"
  showing the active file's name (proves selection plumbing).

## 5. Out of scope (later phases)

3D canvas, `/model_data`, extraction job (Phase 2 — only the columns
land now), lenses/themes/inspector/measure, sun path, the
airtightness pin.

## 6. Verification gate

1. **Backend pytest** (new `backend/tests/test_model_viewer_files.py`
   or a `features/`-style location matching current conventions):
   upload-link round-trip, list ordering, rename/notes validation,
   soft delete + list exclusion, dedup 409 + orphan-asset cleanup
   (incl. the unique-index backstop: bypass the SELECT and assert
   the violation maps to the same 409 payload; and re-upload of a
   soft-deleted file's hash succeeds), viewer-role 403 on writes. Use the existing test-DB conftest;
   never point at the dev DB.
2. **Vitest**: hooks + chip/popover components (upload validation
   paths, dedup branch, viewer-role hiding, failed-parse badge
   renders from a `status='failed'` list row).
3. **Playwright e2e** (`frontend/tests/e2e/model-viewer-files.spec.ts`):
   sign in as the seeded agent user (`make seed-agent-user`,
   `codex@example.com`), upload
   `planning/features/model-viewer/ph_nav_v2_example.hbjson` (459 KB),
   rename, add a note, verify `?file=` updates, delete, verify empty
   state. Frontend on strict port 5173.
4. **Closeout**: `make format` then `make ci` green, per the repo
   gate. Run `graphify update .` after code lands.

## 7. Exit criteria

US-VIEW-1 criteria 1–14 pass as amended (§3.1 types, §4.2 delete
dialog, §4.3 inline messages). STATUS.md verification ledger row
"Phase 1" updated with evidence links.
