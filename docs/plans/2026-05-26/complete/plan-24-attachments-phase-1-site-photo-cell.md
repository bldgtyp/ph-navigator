---
DATE: 2026-05-26
TIME: planning
STATUS: Proposed implementation plan for Attachments Phase 1.
AUTHOR: Codex
SCOPE: First user-facing attachment cell: image-only site photos on
       envelope assembly segments.
RELATED:
  - context/technical-requirements/attachments.md
  - context/technical-requirements/data-model.md §6.5
  - context/technical-requirements/data-table.md
  - context/technical-requirements/api.md §9.10
  - context/user-stories/20-envelope.md (US-ENV-13 / site photos)
  - docs/plans/2026-05-25/feature-attachments-prd.md §13
  - docs/plans/2026-05-25/plan-23-attachments-phase-0-storage-backbone.md
---

# Plan 24 - Attachments Phase 1: Site-Photo Cell

## P0. Why this slice

Phase 0 creates the storage backbone but intentionally leaves
`attach` / `detach` as project-document stubs. Phase 1 turns that
backbone into one real user-facing attachment workflow:

- `tables.assemblies[*].layers[*].segments[*].photo_asset_ids[]`;
- image-only uploads (`image/png`, `image/jpeg`, `image/webp`);
- shared `<AttachmentCell>` rendering in the DataTable primitive;
- upload coordinator for direct-to-R2 browser uploads;
- real draft writes for append / detach / reorder;
- public-reader preview and download for referenced assets.

This is the smallest complete vertical slice because site photos avoid
PDF preview, datasheet product semantics, zip packaging, and MCP bulk
tools. It proves the core invariants: document stores ordered
`asset_id[]`; R2 stores bytes; draft writes carry version isolation.

## P1. Source Review Notes

Use `context/technical-requirements/attachments.md` as the canonical
contract. The dated feature PRD is still useful for rationale and
AirTable parity, but do not copy two stale phrases from its architecture
overview:

- `attachment` is not a user-extensible custom-field type in v1.
- overflow is mousewheel horizontal scroll, not a `+N` collapse.

Phase 1 should not pull Phase 4 bulk endpoints forward. For this first
cell, resolve URLs through the single-asset `/url` endpoint with a
small client cache and request pooling. `bulk-urls` remains Phase 4.

## P2. Acceptance - Phase 1 Done When

1. A segment row renders `photo_asset_ids[]` as an attachment field
   with fixed cell height and horizontal mousewheel scrolling.
2. Empty inactive site-photo cells render blank; empty active cells
   render the paperclip-style `Drop files here` affordance.
3. An editor can drag two JPG/PNG/WebP files onto a segment photo cell;
   uploads run through Phase 0's `upload-intent -> PUT ->
   complete-upload` chain; the resulting `asset_id`s append to
   `segment.photo_asset_ids[]`.
4. Reloading the draft shows the same thumbnails in the same order.
5. Clicking / keyboard-opening a thumbnail opens the preview modal with
   image preview, filename, size, MIME, Download, Open in new tab, and
   read/write-aware controls.
6. Selecting a thumbnail and pressing Delete or Backspace detaches that
   asset from the draft, without soft-deleting the `project_assets` row.
7. One undo gesture restores a detached image; a multi-file drop is one
   grouped undo operation.
8. The same image dropped twice into the same cell is filtered before a
   CellWrite lands; the cell array contains no duplicate ids.
9. Viewer / locked-version mode can preview and download referenced
   site photos but cannot upload, detach, reorder, or see the empty-cell
   drop affordance.
10. Anonymous `/assets/{aid}/url` succeeds only when the asset is
    referenced by the public-readable version being viewed.
11. `make test`, `make typecheck`, `make lint`, frontend build, and a
    browser smoke of the site-photo workflow pass.

## P3. Backend Work

### P3.1 Attachment Field Registry

Add a backend table-contract entry for:

```text
tables.assemblies[*].layers[*].segments[*].photo_asset_ids[]
asset_kind: site_photo
allowed MIME: image/png, image/jpeg, image/webp
max_count: 10
max_file_size_mb: 25
```

The config lives in code on the registered table contract, not in the
document body. Reads normalize missing / null values to `[]`; writes
normalize to ordered `string[]`.

### P3.2 Real Attach / Detach Draft Writes

Replace Phase 0's attach/detach stub with a narrow implementation for
registered attachment fields:

- validate target path resolves to a registered attachment field;
- validate asset exists, is `uploaded`, belongs to the same project,
  has `asset_kind = site_photo`, and satisfies MIME / size caps;
- reject cross-project ids with `asset_cross_project_reference`;
- reject over-cap appends with `asset_count_exceeded`;
- apply the same draft ETag / idempotency behavior as ordinary
  CellWrites;
- write audit rows for attach and detach.

Do not implement generic arbitrary JSON-Patch paths. The target must
resolve through the attachment-field registry.

### P3.3 Referenced-By Check For Viewer URLs

Implement the first real referenced-by check for:

```text
tables.assemblies[*].layers[*].segments[*].photo_asset_ids[]
```

For authenticated editors, existing project access checks are enough.
For anonymous public readers, issue signed URLs only if the asset id is
present in the version body being viewed. Keep this implementation
registry-driven so Phases 2 and 3 add fields without adding another
route branch.

### P3.4 Diff Support

Ensure project-document diff reports site-photo cell changes as:

```json
{ "added": ["asset_..."], "removed": ["asset_..."] }
```

The Phase 1 browser surface only needs a readable diff entry; thumbnail
rendering in the diff modal can be basic if the existing diff UI is not
yet asset-aware.

## P4. Frontend Work

### P4.1 Shared Asset Client

Add `frontend/src/features/assets/`:

```text
api.ts          upload intent, complete upload, URL resolve, metadata
types.ts        AssetMetadata, AssetUrls, UploadProgress, UploadContext
hooks.ts        useAssetUrls, useUploadCoordinator
query-keys.ts   project-scoped asset URL/cache keys
```

Use TanStack Query for metadata / URL envelopes. Signed URL TTLs are
short; cache using the returned `expires_at` and refresh before expiry.

### P4.2 Upload Coordinator

Implement the `UploadCoordinator` from `attachments.md §A5`:

- concurrency cap: 4 uploads;
- client SHA-256 dedup before intent creation;
- one pending placeholder per file;
- route complete uploads back to the originating
  `(project_id, version_id, table_key, row_id, field_key)`;
- group multi-file drops with one `op_group_id`;
- abort support for cancelled placeholders.

Phase 1 may keep navigation survival in memory only. It must still land
the CellWrite against the originating draft if the user switches versions
before upload completion within the same session.

### P4.3 `<AttachmentCell>`

Add shared attachment rendering under
`frontend/src/shared/ui/data-table/fields/attachment/` or the closest
current field-renderer pattern:

- fixed-height thumbnail strip;
- mousewheel-to-horizontal-scroll behavior;
- empty inactive blank state;
- empty active drop/file-picker affordance;
- in-flight placeholder pills;
- selected thumbnail ring and arrow-key movement;
- Delete / Backspace detach;
- double-click / Enter / Space preview modal open;
- read-only suppression of drop and detach.

Keep the component dumb about draft details. It emits normalized
`string[]` through the existing `onWrite` / CellWrite pipeline and
receives the upload coordinator from the feature route.

### P4.4 Preview Modal

Phase 1 modal supports images only:

- native `<img>`;
- filename, MIME, size, uploaded date if available;
- Download and Open in new tab;
- Delete / Backspace in editor mode;
- thumbnail rail with reorder drag.

Do not add `pdfjs-dist` in Phase 1.

### P4.5 Envelope Segment Surface

Wire the first attachment field into the assembly segment table surface
that owns `segment.photo_asset_ids[]`. If the full Assemblies builder is
not available when this plan executes, create the narrowest reachable
test surface that renders the registered `assemblies` document slice
without inventing a separate asset model.

## P5. Tests

Backend:

- attachment-field registry validates `photo_asset_ids[]`;
- attach happy path appends to a draft;
- detach removes from a draft and leaves `project_assets` untouched;
- duplicate append is a no-op or structured validation result before
  persistence;
- cross-project reference returns `asset_cross_project_reference`;
- over-cap returns `asset_count_exceeded`;
- anonymous URL resolution passes only for referenced assets;
- diff reports added / removed asset ids.

Frontend:

- `<AttachmentCell>` blank / active-empty / populated / read-only
  states;
- drop upload flow with mocked asset client;
- duplicate-within-cell filtering;
- Delete / Backspace detach;
- arrow-key selection and horizontal scroll;
- preview modal image rendering;
- grouped undo for multi-file drop if undo infrastructure is available.

Browser:

- editor uploads two site photos, reloads, previews, detaches one, undo
  restores;
- locked version and anonymous viewer can preview/download but cannot
  mutate.

## P6. Out Of Scope

- PDF datasheets and `pdfjs-dist` preview - Phase 2.
- Project-material / ERV / Pump / Fan datasheet fields - Phase 2.
- Thermal-bridge datasheets and simulation files - Phase 3.
- `bulk-upload-intent`, `bulk-urls`, `bulk-download`, jobs - Phase 4.
- MCP asset tools - Phase 4.
- Clipboard paste-image, cross-cell drop, gallery view - Phase 5.

## P7. Done Definition

This phase is mergeable when the acceptance checklist passes locally,
the browser smoke is recorded, and the implementation has no new
attachment-specific branches outside the asset service, registered table
contracts, and shared DataTable attachment renderer.
