---
DATE: 2026-05-26
TIME: planning
STATUS: Proposed implementation plan for Attachments Phase 4.
AUTHOR: Codex
SCOPE: Bulk asset endpoints, async zip jobs, GC sweeper, and MCP asset
       tools for LLM-driven datasheet workflows.
RELATED:
  - context/technical-requirements/attachments.md
  - context/technical-requirements/api.md §9.10.1 / §9.10.2
  - context/technical-requirements/llm-mcp-schema.md §10.3
  - context/user-stories/50-settings-ops-llm.md
  - docs/plans/2026-05-25/feature-attachments-prd.md §10
---

# Plan 27 - Attachments Phase 4: Bulk Jobs And MCP

## P0. Why this slice

Phases 1-3 prove individual cells. Phase 4 makes attachments operational
at project scale:

- render multiple thumbnails efficiently through `bulk-urls`;
- download whole columns/tables/projects as deterministic zip bundles;
- expose list / resolve / bulk-download / bulk attach-detach tools to
  MCP clients;
- add the first reference-aware GC sweeper for orphaned assets.

This is the phase that unlocks the real LLM workflow: "find every ERV
datasheet, package them by manufacturer/model, and give me a zip."

## P1. Acceptance - Phase 4 Done When

1. `bulk-upload-intent` creates / dedupes upload intents for a batch and
   returns per-item statuses without creating duplicate assets.
2. `bulk-urls` resolves up to 100 asset ids with download and thumbnail
   URL envelopes, rejecting over-cap requests with a structured error.
3. `bulk-download` starts an async zip job for filters by table,
   column, asset ids, and asset kind.
4. Completed zip jobs create an `export_bundle` asset with a normal
   signed download route and a top-level `MANIFEST.csv`.
5. Browser UI can download at least one column-level and one project- or
   table-level asset bundle.
6. MCP tools work with project-scoped tokens and correct `asset:read` /
   `asset:write` scopes.
7. MCP `bulk_attach` and `bulk_detach` validate each item and return
   structured partial-failure details without silently applying partial
   state as success.
8. GC sweeper can identify unreferenced failed/pending-expired/detached
   assets and move purge candidates under the `_orphaned/` prefix only
   when no saved version or active draft references them.
9. Full backend tests, targeted MCP tests, frontend build/test/lint, and
   browser smoke pass.

## P2. Backend Work

### P2.1 Bulk Upload Intent

Implement:

```text
POST /api/v1/projects/{pid}/assets/bulk-upload-intent
```

Rules:

- item cap: choose a conservative cap (for example 50) and document it;
- each item validates `asset_kind`, MIME, size, and hash;
- dedup uses `(project_id, content_hash_sha256)` consistently with
  single upload intent;
- response preserves input order;
- invalid items return per-item errors; decide whether the endpoint is
  all-or-nothing or mixed-result before implementation and document the
  choice in `api.md` if it changes the canonical contract.

### P2.2 Bulk URL Resolver

Implement:

```text
GET /api/v1/projects/{pid}/assets/bulk-urls?ids=<csv>
```

Rules:

- cap at 100 ids;
- preserve input order;
- authenticated editor/viewer project access required;
- anonymous access applies the same referenced-by check as single
  `/url`, across all registered attachment fields;
- no asset enumeration: unknown / unauthorized ids should not reveal
  cross-project existence.

Update `<AttachmentCell>` to use `bulk-urls` when available, while
keeping the single-url path as a fallback for small/error cases.

### P2.3 Async Jobs

Implement generic jobs if not already available:

```text
GET /api/v1/projects/{pid}/jobs/{job_id}
```

Minimum job model:

- `id`, `project_id`, `job_type`, `status`, `progress`;
- `created_by`, `created_at`, `started_at`, `finished_at`;
- `result_asset_id`, `error_code`, `error_details`;
- project-scoped access checks.

This can start as DB-backed polling. Do not introduce Redis/Celery
unless the current backend already has a durable worker pattern.

### P2.4 Bulk Download Zip

Implement:

```text
POST /api/v1/projects/{pid}/assets/bulk-download
```

Filter options:

- `table_key`;
- `column_key`;
- `asset_ids`;
- `kind`.

Zip requirements:

- stream original files from R2;
- default path pattern: `{table}/{row.name}__{filename}`;
- sanitize path segments to avoid zip-slip;
- de-duplicate filename collisions deterministically with suffixes;
- include `MANIFEST.csv` with table, row id, row display name, field,
  asset id, original filename, content type, size, and zip path;
- upload zip back to R2 as `asset_kind = export_bundle`;
- expose through normal asset download route.

Do not hard-code materials/equipment paths. Asset-to-row resolution
should use the registered attachment-field roster.

### P2.5 MCP Tools

Implement tools from `llm-mcp-schema.md §10.3`:

```text
list_assets(project_id, version_id?, filter)
resolve_asset_urls(project_id, asset_ids[])
start_bulk_download(project_id, filter, filename_pattern?, include_manifest_csv?)
get_job(project_id, job_id)
bulk_attach(project_id, version_id, attachments[])
bulk_detach(project_id, version_id, asset_refs[])
```

Auth:

- MCP never anonymous;
- `asset:read` required for list / resolve / download / job result;
- `asset:write` plus project write scope required for bulk attach /
  detach;
- all mutating tools audit-log `mcp_token_id`.

Concurrency:

- bulk attach / detach uses the same draft ETag model as browser writes;
- all items in one call share an undo/audit group;
- partial failure must be explicit and machine-readable.

### P2.6 GC Sweeper

Add a standalone sweeper that can run manually first, then as a cron:

- finds failed or pending-expired assets;
- finds uploaded assets that are soft-deleted or detached from current
  drafts;
- scans all non-deleted `project_versions.body` and active drafts for
  asset ids before considering purge;
- moves true purge candidates to
  `projects/{pid}/assets/_orphaned/{asset_id}/...`;
- relies on R2 lifecycle to delete after 90 days.

Never hard-delete an R2 object directly in the first implementation.

## P3. Frontend Work

### P3.1 Bulk URL Use In Cells

Refactor asset URL resolution so a cell or table viewport can resolve
N asset ids with one `bulk-urls` call. Keep stable cache keys and avoid
thrashing signed URLs during scroll.

### P3.2 Browser Bulk Download Commands

Add download commands where users naturally need them:

- datasheet column menu;
- table action menu;
- project-level attachment/export surface if one exists.

The UI should show job progress and expose the final zip download. Do
not block the table while the job runs.

### P3.3 Error Surfaces

Add structured partial-failure display for bulk downloads and bulk
attach/detach where browser surfaces call those endpoints. Errors should
name affected row/field/filename where possible.

## P4. Tests

Backend:

- bulk upload dedup and per-item validation;
- bulk URL auth/reference checks;
- zip path sanitization and manifest contents;
- job lifecycle success/failure;
- export bundle asset metadata;
- GC protects assets referenced by old saved versions;
- GC moves only true orphans to `_orphaned/`;
- MCP read scope, write scope, and forbidden-scope tests;
- MCP bulk partial-failure payload shape.

Frontend:

- bulk URL batching and fallback;
- job progress UI;
- zip download command surfaces;
- partial-failure rendering.

Browser / MCP:

- from browser, start a column datasheet zip and download it;
- from MCP token, list assets filtered by kind/table/column;
- start bulk download and poll job to result;
- run bulk attach/detach against a draft and verify browser reflects the
  result after refresh.

## P5. Out Of Scope

- User-extensible attachment columns.
- Better-than-polling job transport such as SSE/WebSockets unless a
  generic job surface already exists.
- OCR / auto-extract from datasheets.
- Multipart upload.
- Cloudflare Worker thumbnail rendering.

## P6. Done Definition

This phase is mergeable when zip jobs, MCP tools, and GC have real tests
and at least one browser plus one MCP workflow prove the project-scale
attachment path end-to-end.
