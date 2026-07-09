---
DATE: 2026-06-05
STATUS: CANONICAL TECHNICAL REQUIREMENTS — attachments cell type
        and supporting upload/preview/download/delete pipeline.
RELATED: context/PRD.md §6.5 (asset backbone),
         context/technical-requirements/data-model.md §6.5,
         context/technical-requirements/api.md §9.10,
         context/technical-requirements/data-table.md (FieldDef),
         context/technical-requirements/llm-mcp-schema.md §10.3,
         planning/features/attachments/PRD.md
         (decision archive — non-canonical)
---

# PH-Navigator V2 — Attachments Requirements

This is the implementation contract for the `attachment` cell type and
the upload / preview / download / delete pipeline that supports it. Load
on demand when touching this surface; do not include in default startup
context.

The dated decision archive (with alternatives considered, rejected
options, AirTable behavior comparison, and resolution history) lives at
`planning/features/attachments/PRD.md`. This file is the
durable contract only.

## A0. Implementation status (v1 acceptance)

The asset backbone, REST surface, fixed-field registry, MCP asset tools,
and the shared `<AttachmentCell>` are implemented. The following parts of
this contract are **deferred to Phase-5 polish and are NOT v1 acceptance
blockers**:

- **Parallel upload coordinator with `op_group_id`** (A4.3, A5). v1 ships
  sequential per-file uploads; the batched coordinator and shared
  `op_group_id` are deferred.
- **Modal-rail drag-reorder** (A4.5).
- **Grouped undo** for batched drops, reorder, and replace (the "one undo
  entry" / single-⌘Z semantics in A4.3–A4.7).

The following properties are **required for v1 and are proven by
automated tests**:

- **Locked-version / read-only enforcement.** Attach and detach are
  rejected with `version_locked` on a locked version
  (`tests/test_assets_locked_version.py`), preserving the §A6
  immutable-by-discipline invariant.
- **Bulk download** zip + `MANIFEST.csv`, ordering, filename de-dup, and
  filter behavior (`tests/test_assets_bulk_download.py`).
- **MCP asset tools** scope enforcement (`asset:read` / `asset:write`)
  and `bulk_attach` / `bulk_detach` partial-failure reporting
  (`tests/test_assets_mcp.py`).
- **Orphan-sweeper** dry-run protection of assets referenced by a saved
  version or an active draft (`tests/test_assets_orphan_sweeper.py`).

## A1. Scope

V1 attachments are **pre-set core fields on a fixed roster of
project-document tables**. There is no user-extensible Attachment
column type in v1 — the closed v1 custom-field set
(`{short_text, long_text, number, url, single_select, formula}`)
stays unchanged.

Every attachment cell renders through one shared `<AttachmentCell>`
component and goes through the same upload backbone (`project_assets`,
`data-model.md` §6.5).

## A2. The fixed v1 attachment-field roster

Attachment cells exist ONLY on these PHN-declared core fields:

| Document path | Core field | asset_kind | Allowed MIME / ext | Max files / cell | Max file size |
|---|---|---|---|---|---|
| `tables.project_materials[*]` | `datasheet_asset_ids[]` | `datasheet` | `application/pdf`, `image/png`, `image/jpeg`, `image/webp` | 5 | 25 MB |
| `tables.assemblies[*].layers[*].segments[*]` | `photo_asset_ids[]` | `site_photo` | `image/png`, `image/jpeg`, `image/webp` | 10 | 25 MB |
| `tables.equipment.ervs[*]` | `datasheet_asset_ids[]` | `datasheet` | `application/pdf`, `image/png`, `image/jpeg`, `image/webp` | 5 | 25 MB |
| `tables.equipment.pumps[*]` | `datasheet_asset_ids[]` | `datasheet` | `application/pdf`, `image/png`, `image/jpeg`, `image/webp` | 5 | 25 MB |
| `tables.equipment.fans[*]` | `datasheet_asset_ids[]` | `datasheet` | `application/pdf`, `image/png`, `image/jpeg`, `image/webp` | 5 | 25 MB |
| `tables.equipment.hot_water_heaters[*]` | `datasheet_asset_ids[]` | `datasheet` | `application/pdf`, `image/png`, `image/jpeg`, `image/webp` | 5 | 25 MB |
| `tables.equipment.hot_water_tanks[*]` | `datasheet_asset_ids[]` | `datasheet` | `application/pdf`, `image/png`, `image/jpeg`, `image/webp` | 5 | 25 MB |
| `tables.equipment.electric_heaters[*]` | `datasheet_asset_ids[]` | `datasheet` | `application/pdf`, `image/png`, `image/jpeg`, `image/webp` | 5 | 25 MB |
| `tables.equipment.appliances[*]` | `datasheet_asset_ids[]` | `datasheet` | `application/pdf`, `image/png`, `image/jpeg`, `image/webp` | 5 | 25 MB |
| `tables.thermal_bridges.rows[*]` | `pdf_report_asset_ids[]` | `datasheet` | `application/pdf` | 5 | 25 MB |

Per-field config (allowed MIME, `max_count`, `max_file_size_mb`) lives
in code in `backend/features/assets/registry.py`, with row-table
contracts in `backend/features/project_document/tables/attachments.py`
(see `data-model.md` §6.6.7 registered-table-contract pattern). Adding
a new attachment cell in v1.1+ is a code change, not a runtime change.

Cell value shape (every entry above):
```jsonc
"datasheet_asset_ids": ["asset_01HX…", "asset_01HX…"]
```

Empty = `[]`. `null` reads coerce to `[]`. Writes normalize to `[]`.

Backend hard caps (apply regardless of per-field config):
- single file ≤ 100 MB (multipart upload deferred);
- per cell ≤ 50 (defends against runaway frontend code).

## A3. Storage backend

**Cloudflare R2**, S3-compatible. Region: **ENAM**. Single bucket per
environment (`ph-navigator-v2-dev`, `ph-navigator-prod`).

R2 wiring already declared in `backend/.env.example` (`R2_ACCOUNT_ID`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
`R2_ENDPOINT_URL`).

Bucket configuration:
- public access OFF (signed URLs only);
- CORS: `AllowedOrigins: [<frontend origin>]`,
  `AllowedMethods: [PUT, GET, HEAD]`, `ExposeHeaders: [ETag]`;
- lifecycle rule: `projects/_orphaned/` auto-deletes
  after 90 days (the GC service moves orphans into that prefix).

Object-key layout:
```
projects/{project_id}/assets/{asset_id}/file.{ext}     # original
projects/{project_id}/assets/{asset_id}/thumb.png       # generated
projects/_orphaned/{project_id}/{asset_id}/{filename}   # GC-quarantined
```

Object keys are server-controlled and never derived from
`original_filename`. `original_filename` is stored on the row only
for display/download UX.

Signed URL TTLs:
- preview: 15 minutes;
- download (response-content-disposition: attachment): 60 minutes.

## A4. `<AttachmentCell>` UX contract

### A4.1 Cell rendering

- **Fixed cell height.** Cell does NOT grow vertically to fit
  thumbnails.
- **Fixed cell width** — driven by the existing column-width view
  state (`data-table.md` §"Column widths").
- **Horizontal mousewheel scroll inside the cell** when the thumbnail
  strip overflows: `overflow-x: auto`, `scrollbar-width: none`,
  `::-webkit-scrollbar { display: none }`, plus a wheel listener
  converting vertical wheel deltas to `scrollLeft` while the cursor is
  over the cell. No `+N` overflow collapse.
- **Each thumbnail tile**: a uniformly-framed square card (one border, one
  radius, one subtle shadow) sized per cell variant — compact (`~32 px`) in
  dense-table contexts, roomier (`~44 px`) in spec-card / expansion
  surfaces (driven by `--attachment-tile-size`). Image content scaled to
  fit (`object-fit: cover`). PDF → first-page render; image → resized
  image; HBJSON / unknown → generic file-type badge (PDF/IMG/JSON/FILE).
- **Empty unselected cell**: renders nothing.
- **Empty selected (active) cell**: renders a bordered pill button
  inside the cell — `📎  Drop files here`. Click → native file picker;
  drop → upload.
- **Populated active cell**: entire cell is also a drop target.
  Dropping appends to the strip.
- **Read-only modes** (locked version, anonymous Viewer, formula N/A
  here): thumbnails clickable for preview/download; no drop target;
  no empty-state button; Delete key is a no-op.

### A4.2 Opening a thumbnail

- **Single click on a thumbnail = open the preview modal.** (Superseded the
  earlier select-then-double-click model — 2026-07-09, decision D-1.)
- Each thumbnail is a real focusable `<button>`; Enter / Space on a
  focused tile opens the same modal via native button activation.
- There is no in-strip "selected" state and no arrow-key strip
  navigation; navigation between attachments happens inside the modal
  (Prev / Next). Detach happens inside the modal (§A4.6).

### A4.3 Drop interaction

- Dragging files over an active cell shows a strong drop overlay on
  that cell only (no cross-cell highlighting in v1).
- Drop = N parallel `upload-intent → PUT → complete-upload` chains.
- Each in-flight file renders as a placeholder pill with an
  indeterminate progress bar at the tail of the strip.
- On success, the placeholder swaps to a real thumbnail.
- On failure, the placeholder turns red with an error tooltip; retry
  or dismiss.
- One CellWrite per file but all writes share an `op_group_id` so a
  single ⌘Z removes the whole batch. **(Deferred — Phase-5 polish; see
  A0. v1 ships sequential uploads with per-file undo.)**

### A4.4 Preview modal

- Triggered by double-click on a thumbnail (or Enter on a selected
  thumbnail).
- Layout: large preview (~80vw × 80vh); filename strip top with size
  + MIME; Prev/Next chevrons; bottom-right action bar.
- Action bar (editor): `Download`, `Open in new tab`, `Replace…`.
- Action bar (Viewer / locked version): `Download`,
  `Open in new tab` only.
- Below preview: thumbnail rail mirroring the cell's strip; current
  tile marked; click another rail tile to navigate.
- Keyboard: ←/→ paginate; **Delete / Backspace** detaches the
  currently-viewed attachment (modal advances or closes); Esc closes;
  ⌘D triggers Download.
- PDF: lazy-loaded `pdfjs-dist` chunk renders page 1.
- Image: native `<img>`.
- HBJSON / other non-previewable: file-info panel + prominent
  Download button (no inline render).

### A4.5 Reorder

**(Deferred — Phase-5 polish; see A0.)**

- Drag-reorder within the modal's thumbnail rail.
- Single CellWrite reshuffling the array; one undo entry.

### A4.6 Detach

- Detach happens **from the preview modal**: open a thumbnail (single
  click, §A4.2) → **Detach** (or the modal's Delete / Backspace on the
  currently-viewed attachment). The in-strip Delete-to-detach shortcut was
  removed with the select model (2026-07-09, decision D-1).
- One semantic CellWrite removing the `asset_id`; one undo entry.
- No confirm dialog.
- Underlying `project_assets` row is NOT soft-deleted; PRD §6.5 rule
  applies (90-day GC only after no saved-version-or-active-draft
  references). ⌘Z restores by re-appending the `asset_id`.

### A4.7 Replace

- `Replace…` in the preview modal opens a file picker; the chosen
  file uploads as a new asset and **swaps in place** for the
  currently-viewed attachment (append new + remove old at the same
  index — one semantic op).
- One undo entry.
- New asset's `display_name` and `original_filename` come from the
  uploaded file. Nothing is inherited from the replaced asset.
- The replaced asset is detached, not modified. The saved version's
  body that referenced it still resolves correctly (§A6 invariant).

## A5. Upload coordinator (frontend)

```ts
type UploadCoordinator = {
  start(file: File, ctx: UploadContext): Promise<string /* asset_id */>;
  startBatch(files: File[], ctx: UploadContext):
    AsyncIterable<UploadProgress | UploadComplete | UploadError>;
  abort(uploadId: string): void;
};
```

Rules:
- Wraps the 3-step `upload-intent → PUT to signed URL →
  complete-upload` chain.
- Concurrency cap: 4 parallel in-flight uploads.
- Dedup client-side by SHA-256 of file content before
  `upload-intent` (two cells dropping the same file share one intent
  call).
- **Survives navigation.** Pending CellWrites are buffered against
  the originating `(project_id, version_id)` and posted to the draft
  API regardless of which version is on screen when complete-upload
  returns. The frontend surfaces a small toast:
  *"Datasheet attached to <project>/<table>/<row> (Working draft)"*
  with a click-to-return link.
- **Duplicate-within-cell:** before emitting the CellWrite, the
  frontend filters out asset_ids already present in the cell and
  shows a "already attached" tooltip on the source thumbnail. No
  duplicate ids land in cell arrays.

## A6. Save / version invariants

Attachment cell writes go through the draft buffer like every other
cell write (`save-versioning.md` §8.3). The five invariants:

1. **Bytes are immutable** per `asset_id`. No in-place replacement of
   an asset's content.
2. **A saved version body is frozen.** Once saved, the `asset_id`
   strings it references never change.
3. **Save As clones the body verbatim.** Cell arrays in the new
   version start as exact copies; no R2 objects duplicated; both
   versions reference the same `asset_id`s.
4. **Detach/attach in V_n only mutates V_n's body.** Frozen prior
   versions continue to reference original `asset_id`s regardless.
5. **GC is reference-aware** (PRD §6.5). An asset is purged only
   when no saved version *and* no active draft references it. While
   any saved version references the asset, the bytes remain
   reachable.

### A6.1 Test targets (edge cases)

Phase 0–3 tests must cover all ten:

| # | Scenario |
|---|---|
| E1 | Upload completes after user navigates away from the originating version; CellWrite still lands on the originating draft. |
| E2 | Upload completes after the draft is discarded; asset row exists, is unreferenced, GC'd in 90 days. |
| E3 | Same file dropped twice in the same cell; frontend filters before CellWrite, "already attached" tooltip. |
| E4 | Same file dropped into V2 cell while V1 already references it; both reference the same `asset_id`; detach from V2 does not affect V1. |
| E5 | Detach from V2 while V1 still references the asset; 90 days pass; asset is NOT GC'd (V1 protects it). |
| E6 | Save As V1 → V2 while uploads in V1's draft are pending; pending CellWrites drain into V1 first, then V2 inherits via the Save-As clone. |
| E7 | Replace in V2 of an asset still referenced by V1; new asset replaces in V2; old asset stays reachable via V1. |
| E8 | ETag conflict on attach (browser + MCP race); second caller gets 409 stale-draft-etag and retries. |
| E9 | Cross-project asset reference (asset belongs to a different project); rejected at the API layer with `asset_cross_project_reference`. |
| E10 | Version diff renders attachments: `/diff` returns `{ added: [asset_id], removed: [asset_id] }` per cell. |

## A7. Thumbnail pipeline

**Server-side, synchronously triggered as a FastAPI background task
on `complete-upload`.** Python deps: `pypdfium2` (PDF), `Pillow`
(images).

Per-type behavior:

| Source | Strategy | thumbnail_status |
|---|---|---|
| `application/pdf` | `pypdfium2` renders page 1 → 320×400 PNG → R2 sibling `thumb.png`. | `ready` on success; `failed` on render error. |
| `image/png`, `image/jpeg`, `image/webp` | `Pillow` resizes longest edge to 320 px → PNG → R2 sibling. EXIF orientation honored. | `ready` on success; `failed` on render error. |
| `.hbjson` (any MIME), other unknowns | No render. | `na`. |

Failure handling:
- Render time capped at 10 s per file.
- Corrupt source: log structured warning; mark `thumbnail_status =
  failed`. Asset still marked `uploaded`; cell renders generic glyph.
- Render queue is FastAPI `BackgroundTasks`. Promotion to a real job
  queue (Celery / RQ) is a v1.1 decision triggered by measured
  contention.

## A8. Errors

All conform to the common minimal envelope (`code`, `message`,
`request_id`, `recoverability`, `details`) defined in
`llm-mcp-schema.md` §10.3.

Codes introduced by this feature:
- `asset_count_exceeded` — cell at the field's `max_count`.
- `asset_mime_not_allowed` — uploaded MIME not in the field's
  allow-list.
- `asset_size_exceeded` — file size > the field's `max_file_size_mb`.
- `asset_upload_incomplete` — attach attempted on an asset whose
  `upload_status` is `pending` or `failed`.
- `asset_thumbnail_pending` — read-side warning; client falls back
  to generic icon.
- `asset_cross_project_reference` — attach attempted on an asset
  belonging to a different project.
- `asset_bulk_partial_failure` — used by bulk routes; includes
  per-item error details.

## A9. Security

- **Public-readable project URLs ≠ public asset enumeration.**
  Anonymous viewers can resolve signed URLs only for assets that are
  *currently referenced* by the version they are viewing. The backend
  enforces this "referenced by" check before issuing a signed URL.
- **MCP** never anonymous: tokens scoped per project, `asset:read` /
  `asset:write` required, all calls audit-logged.
- **MIME sniffing on `complete-upload`**: the backend GETs the first
  4–8 KB of the uploaded object from R2 and verifies that the magic
  bytes match the claimed `content_type`. Mismatch → reject (mark
  asset `failed`, return `asset_mime_not_allowed`).
- **HBJSON content sniff**: when an HBJSON is uploaded, the server
  attempts a one-shot JSON parse on the first ~256 KB; non-JSON →
  reject. Full schema validation is the viewer's responsibility at
  render time.
- **No SVG** in v1 (XSS surface).
- **Signed URL TTLs** as in §A3.
- **Filename sanitization**: `original_filename` stored verbatim;
  never used as an object key.
- **Audit log**: every upload, attach, detach, mass-download writes a
  `user_action_log` row with `project_id`, `asset_id`, `action`,
  `mcp_token_id?`.

## A10. Cross-references

- Upload / download / attach / detach REST: `api.md §9.10`.
- Bulk endpoints (`bulk-upload-intent`, `bulk-urls`, `bulk-download`,
  `jobs`): `api.md §9.10`.
- MCP tool inventory: `llm-mcp-schema.md §10.3`.
- Field-registry row for `attachment`: `data-table.md`.
- Asset row schema + GC: `data-model.md §6.5`.
- Decision archive (alternatives considered, AirTable parity baseline,
  resolution history): `planning/features/attachments/PRD.md`.
