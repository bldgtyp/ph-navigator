---
DATE: 2026-05-26
TIME: planning
STATUS: Proposed implementation plan for Attachments Phase 2.
AUTHOR: Codex
SCOPE: Datasheet attachment cells for project materials and equipment,
       with PDF support and the first browser bulk-download affordance.
RELATED:
  - context/technical-requirements/attachments.md
  - context/technical-requirements/api.md §9.10
  - context/technical-requirements/data-model.md §6.5
  - context/user-stories/20-envelope.md (US-ENV-2 / US-ENV-13)
  - context/user-stories/30-tables-equipment.md (equipment datasheets)
  - docs/plans/2026-05-26/plan-24-attachments-phase-1-site-photo-cell.md
---

# Plan 25 - Attachments Phase 2: Datasheet Cells

## P0. Why this slice

Phase 2 makes attachments useful for the highest-volume certification
workflow: manufacturer datasheets. It extends the Phase 1 cell and
draft-write path from image-only site photos to PDF/image datasheets on:

- `tables.project_materials[*].datasheet_asset_ids[]`;
- `tables.equipment.ervs[*].datasheet_asset_ids[]`;
- `tables.equipment.pumps[*].datasheet_asset_ids[]`;
- `tables.equipment.fans[*].datasheet_asset_ids[]`.

It also adds the first browser-facing "download all datasheets" path for
the Specifications surface. The async job / MCP bulk surface remains
Phase 4; this phase can implement a narrow column-level browser download
only if it is needed for user acceptance.

## P1. Acceptance - Phase 2 Done When

1. Project-material, ERV, Pump, and Fan datasheet fields render through
   the same `<AttachmentCell>` as Phase 1.
2. Editors can attach PDF, PNG, JPG, and WebP datasheets to each
   registered field; each cell enforces max 5 files and 25 MB per file.
3. PDF datasheets show server-generated thumbnails in the cell and open
   in the preview modal through lazy-loaded `pdfjs-dist`.
4. Image datasheets keep Phase 1 behavior.
5. The preview modal exposes `Replace...`; replace uploads a new asset
   and swaps it into the same array index as one semantic draft write.
6. Replacing a datasheet in a Save-As version does not mutate the prior
   saved version's asset ids.
7. The Specifications / datasheet surface can download all datasheets
   for a project-material column as a zip with `MANIFEST.csv`.
8. Viewer / locked-version mode can preview and download datasheets but
   cannot upload, detach, replace, or reorder.
9. Backend, frontend, and browser checks pass.

## P2. Backend Work

### P2.1 Attachment Registry Additions

Add registered attachment-field configs:

```text
tables.project_materials[*].datasheet_asset_ids[]
tables.equipment.ervs[*].datasheet_asset_ids[]
tables.equipment.pumps[*].datasheet_asset_ids[]
tables.equipment.fans[*].datasheet_asset_ids[]

asset_kind: datasheet
allowed MIME: application/pdf, image/png, image/jpeg, image/webp
max_count: 5
max_file_size_mb: 25
```

The registry must drive validation, anonymous referenced-by checks,
diff extraction, and filename resolution. Avoid route-specific
knowledge of materials or equipment.

### P2.2 PDF Completion And Thumbnails

Phase 0 generates PDF thumbnails, but Phase 2 is the first browser
consumer. Confirm:

- `metadata.thumbnail_status` is `ready`, `failed`, `pending`, or `na`;
- `thumbnail_url` is returned when available;
- corrupt PDFs remain downloadable with generic glyph fallback;
- PDF MIME sniff rejects non-PDF magic bytes.

If Phase 0 left thumbnail generation as a background task without a
reliable test drain, add a deterministic test helper before depending on
it from frontend tests.

### P2.3 Replace Semantics

Add a service-level draft write for replace:

1. create / complete a new asset;
2. validate the new asset against the target field;
3. replace the selected old `asset_id` with the new `asset_id` at the
   same array index;
4. preserve old asset rows and R2 objects;
5. write one audit-log event for replace, or paired attach/detach events
   with a shared `op_group_id`.

Do not mutate the old asset row except for normal GC reference tracking
later.

### P2.4 Column-Level Datasheet Zip

There are two acceptable implementations:

- **Preferred if Phase 4 is near:** add only the UI command shell and
  defer actual zip jobs to Phase 4.
- **Preferred if datasheet workflow needs immediate acceptance:** add a
  narrow synchronous or background browser-only zip for
  `project_materials.datasheet_asset_ids[]`, then replace it with the
  generic Phase 4 job endpoint.

If implemented in Phase 2, the zip must:

- include original files, not thumbnails;
- default paths to `{table}/{row.name}__{filename}`;
- include top-level `MANIFEST.csv`;
- package only assets referenced by the active version/draft context;
- use stable PHN asset download checks, not raw R2 public URLs.

Do not add MCP tools in Phase 2.

## P3. Frontend Work

### P3.1 PDF Preview

Extend `AttachmentModal`:

- lazy-load `pdfjs-dist` only on first PDF preview;
- render page 1 in the preview frame;
- keep the table bundle from pulling PDF worker code into the main
  chunk;
- fallback to a download-only panel when PDF render fails.

Add a visible loading state that does not resize the modal frame.

### P3.2 Datasheet Cell Wiring

Wire the attachment renderer into the project-material and equipment
tables using core field definitions:

```ts
{
  field_key: "datasheet_asset_ids",
  field_type: "attachment",
  display_name: "Datasheet",
  read_only_schema: true,
  config: { assetKind: "datasheet", maxCount: 5, ... }
}
```

Do not expose schema-mutation menu entries. No "Add Attachment field" UI
appears.

### P3.3 Replace UI

Add `Replace...` in editor mode only:

- file picker constrained to the field allow-list;
- upload placeholder appears in the same thumbnail rail position;
- on completion, swap old -> new in one CellWrite;
- undo restores the old asset id;
- failure leaves the old attachment in place.

### P3.4 Specifications Download UI

For project materials, add the smallest discoverable browser command for
column-level download. Candidate locations:

- Specifications sub-tab action bar;
- datasheet column header menu;
- project-materials overflow menu.

Use the same filename convention that Phase 4 will generalize:
`{table}/{row.name}__{filename}` plus `MANIFEST.csv`.

## P4. Tests

Backend:

- each datasheet registry path validates MIME, max count, project id;
- PDF success, corrupt PDF fallback, and MIME mismatch;
- replace preserves old asset and swaps the draft array;
- Save As clone keeps old asset ids until replaced in the new draft;
- anonymous reader can resolve only referenced datasheets;
- optional zip includes manifest and expected paths.

Frontend:

- PDF preview chunk is lazy and does not enter the main bundle;
- datasheet cell renders PDF thumbnail / generic failed-thumbnail glyph;
- replace success, failure, and undo;
- read-only suppression of replace/drop/delete;
- column download command calls the expected API.

Browser:

- attach one PDF to each of three project materials;
- reload draft and preview all three PDFs;
- replace one PDF after Save As, then diff against prior version;
- download project-material datasheets zip and inspect `MANIFEST.csv`.

## P5. Out Of Scope

- Site photos beyond Phase 1 behavior.
- Thermal-bridge datasheet / simulation-file fields - Phase 3.
- Generic `bulk-download` job endpoint and MCP bulk tools - Phase 4.
- Multipart uploads over 25 MB.
- OCR / spec extraction from datasheets.
- User-extensible attachment columns.

## P6. Done Definition

This phase is mergeable when PDF/image datasheets work across materials
and equipment, replace semantics are browser-verified across Save-As
version isolation, and the plan records whether column-level zip was
implemented now or explicitly left to Phase 4.
