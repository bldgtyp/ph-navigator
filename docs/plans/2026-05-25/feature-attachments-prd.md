---
DATE: 2026-05-25
TIME: 21:30
STATUS: DRAFT (rev 2 — pre-set fields only; no custom-field type) —
        feature-specific PRD for the Attachments cell type and
        supporting upload/preview/download/delete pipeline.
AUTHOR: Ed May (with Claude)
SCOPE: Multi-file attachments on project-document table cells
       (AirTable parity), the upload/preview/delete UX, the storage
       backend, the MCP/LLM API ergonomics, and the phasing to ship.
RELATED:
  - context/PRD.md §6.5 (asset backbone), §10 (LLM/MCP), §11.3 (tables)
  - context/technical-requirements/data-model.md §6.5, §6.6 (custom fields)
  - context/technical-requirements/api.md §9.10 (assets)
  - context/technical-requirements/data-table.md (FieldDef registry)
  - context/technical-requirements/llm-mcp-schema.md §10.3 (MCP tools)
  - context/user-stories/20-envelope.md (Q-ENV-2 / Q-ENV-2.1 datasheets)
  - context/user-stories/50-settings-ops-llm.md NEW-DATASHEET-1, NEW-LLM-API-1
  - docs/plans/2026-05-24/plan-13-custom-fields-overview.md §6 (deferred types)
  - ph-navigator/backend/features/gcp/ (V1 precedent — GCS, not R2)
---

# PH-Navigator V2 — Attachments Feature PRD

## 1. Why this doc exists

Attachments are the *highest-volume manual workflow* on a PH consulting
project: every product on every project gets a manufacturer datasheet
PDF stapled to its record, every site visit produces photos that
document the as-built reality of each assembly segment, every thermal
bridge simulation produces a Flixo / Dartwin file that has to live with
the model. Today this happens in AirTable, where a column with an
"Attachment" type accepts drag-dropped files, shows a small icon
preview in the cell, and surfaces a full-size preview on click.

V2 has the **building blocks** for this — the `project_assets` table,
R2 bucket plumbing, signed-URL upload/download, attach/detach JSON-Patch
wrappers, and stub `attachment` slots in `FieldDef` and
`AttachmentRenderer` — but **no end-user surface and no implementation
yet**.

**Scope decision (2026-05-25, Ed):** Attachments are **core fields on
a fixed set of tables** in v1. The closed v1 custom-field set
(`{short_text, long_text, number, url, single_select, formula}`) stays
unchanged — `attachment` is NOT added as a user-extensible custom-field
type. The AirTable-parity UX lives in the *cell*; the schema is
pre-configured by PHN and not user-mutable. This keeps the cell + upload
pipeline complexity but removes schema mutations, changeType handling,
and the field-add UI.

This PRD is the canonical authoring document for closing that gap. It
collects the user stories already scattered across `20-envelope.md`,
`30-tables-equipment.md`, and `50-settings-ops-llm.md`; pins down the
storage backend; specifies the AirTable-parity UX; lays out the data
model and API/MCP surface; and proposes a phased implementation.

> **Status.** Draft for design discussion. Not yet authoritative.
> Once decisions land, the durable parts graduate into
> `context/technical-requirements/attachments.md` (new) and a row each
> in `data-model.md`, `data-table.md`, `api.md`, and
> `llm-mcp-schema.md`; phasing graduates into individually-dated
> implementation plans.

## 2. Goal and non-goals

### 2.1 Goal

Make attaching one or more files (PDF / PNG / JPG / WebP; HBJSON for
thermal-bridge simulation files) to **pre-set attachment cells on the
PH-shaped tables** feel **identical to AirTable**, while keeping the
V2 architecture intact:

- documents own structure; R2 owns bytes;
- one upload backbone (`project_assets`) serves every surface;
- editor writes flow through the draft buffer with normal ETag /
  idempotency / undo / version semantics;
- Viewer (public read-only) can preview and download; cannot mutate;
- LLM clients can list, fetch, batch-download, and attach via MCP with
  the same security model as the browser.

Concretely, after this feature ships:

1. The fixed v1 set of attachment cells (§9.2) renders through a single
   `<AttachmentCell>` component on the corresponding tables:
   - `project_materials.datasheet_asset_ids[]`
   - `segments.photo_asset_ids[]`
   - `equipment.ervs[*].datasheet_asset_ids[]`
   - `equipment.pumps[*].datasheet_asset_ids[]`
   - `equipment.fans[*].datasheet_asset_ids[]`
   - `thermal_bridges[*].datasheet_asset_ids[]`
   - `thermal_bridges[*].simulation_file_asset_ids[]`
2. The user can drag-drop one or many files into a cell; uploads run in
   parallel with optimistic "uploading…" pills; on completion the cell
   shows a clickable thumbnail strip.
3. Cell height is fixed (no expand-to-fit). Extra thumbnails are reached
   by horizontal mouse-wheel scroll *inside the cell* with no visible
   scrollbar — AirTable parity.
4. An empty cell renders blank when unselected; the moment the cell
   becomes active, a small bordered "📎 Drop files here" button
   appears in the cell.
5. Clicking a thumbnail opens a full-size preview modal with
   pagination through the cell's attachments and a Download button.
6. Selecting a thumbnail (in the cell strip or modal) and pressing
   Delete detaches it — single keystroke, single undo entry.
7. The user can mass-download attachments — at the cell, the column,
   the table, or the project level — as a zip with deterministic
   filenames.
8. The user can ask Claude to "grab me every datasheet on Project Foo's
   ERVs and rename them by manufacturer" and have the MCP server hand
   back signed URLs (or stream bytes) for each.

### 2.2 Non-goals (v1 of this feature)

- **User-extensible Attachment columns.** No `attachment` in the closed
  v1 custom-field set. No Add-Field UI for Attachment. The cell type is
  only ever set by PHN-controlled pre-set core fields (§9.2). Reaching
  for "users add their own attachment columns" is a v1.1 candidate.
- **In-app PDF annotation / markup / form-fill.** Preview is read-only.
- **Image editing / cropping / rotation** beyond automatic EXIF
  orientation honoring.
- **OCR / auto-extract spec values from datasheets.** Tracked separately
  as a future agentic workflow on top of this API.
- **Attachment "comments" / "mentions" / threaded discussion.**
- **AirTable-style "view-as-grid-of-thumbnails" gallery view of a
  column.** Defer to v1.1.
- **Hard delete with "Recently deleted (7 days)" trash UI.** v1 ships
  detach + 90-day server-side GC per existing PRD §6.5; user-facing
  trash is a v1.1 candidate (admin can pull files back via SQL if
  genuinely needed).
- **Cross-cell drop targets** (drop anywhere in the table → release over
  destination cell). v1 is cell-only drop; cross-cell defer to v1.1.
- **Clipboard paste-image** into attachment cells. Defer.
- **Per-attachment captions / metadata fields.** Attachment is just an
  `asset_id`; metadata lives in sibling cells.
- **Per-attachment versioning** ("update this datasheet to v2 and keep
  v1 archived"). v1 model: bytes are immutable; replacing means
  uploading a new asset and detaching the old. Version isolation across
  PHN's own Save / Save As gives the audit trail (§9.5).
- **Per-project storage quota enforcement.** Logged but not enforced.
- **Multi-part / resumable upload for very large files.** v1 caps file
  size below the single-PUT ceiling (see §9.4).
- **Attachments on catalog tables.** Datasheets on
  `catalog_materials` / `catalog_frame_types` / `catalog_glazing_types`
  remain out of scope (per Q-ENV-2.1: catalog rows carry product specs
  only; datasheets are per-project QA artifacts).

## 3. User stories (collected)

The relevant stories are already scattered across the canon. This
section names them so the PRD can reference one ID per concern. Where a
story is **already accepted** the citation is sufficient; where this
PRD adds new acceptance criteria, those criteria are inlined.

### 3.1 Existing stories that depend on Attachments

| ID | Story (one-liner) | Existing canon |
|---|---|---|
| US-ENV-2 (datasheets) | Per-project-material datasheet attached to each unique product | `20-envelope.md` §Q-ENV-2 / Q-ENV-2.1 |
| US-ENV-2 (site photos) | Per-segment site photos documenting each installation slot | `20-envelope.md` §Q-ENV-2 |
| US-EQ-3 (TB sim files) | Per-thermal-bridge simulation file + datasheet | PRD §6.2 sketch |
| US-EQ-4/5/6 (equipment) | Per-ERV / Pump / Fan datasheet (currently as core field) | PRD §6.2 sketch |
| NEW-DATASHEET-1 | Bulk + individual datasheet download from the Specifications sub-tab and `⋯` menu | `50-settings-ops-llm.md` |
| NEW-LLM-API-1 | LLM-friendly read/write asset API: upload-intent, complete, attach/detach, list, signed-URL fetch | `50-settings-ops-llm.md` |

### 3.2 New stories introduced by this PRD

**US-ATT-1 — Pre-set Attachment cells on PH-shaped tables (no
user-extensible columns).**
> As an editor on the project_materials, segments, ERV, Pump, Fan, and
> Thermal Bridge tables, I want the relevant PHN-defined attachment
> cells (datasheet, site photo, simulation file) to render as
> drag-drop AirTable-style attachment cells without my having to add
> any column. I do NOT need a UI to add my own Attachment columns —
> the set is fixed by PHN.

**US-ATT-2 — Drag-drop multi-file upload into a cell.**
> As an editor, I want to drag one or more files from my desktop onto
> any cell of an Attachment column (or any core-attachment cell —
> datasheets, site photos, sim files) and have them upload in parallel,
> appear as "uploading…" pills, then become clickable thumbnails when
> done — matching AirTable's drag-drop behavior.

**US-ATT-3 — Inline thumbnail strip + count.**
> As an editor or Viewer, I want each attachment cell to show a small
> horizontal strip of thumbnails (PDF first-page render, image
> thumbnail, generic file icon for unknown types) with a "+N" affordance
> when more attachments exist than fit — matching AirTable.

**US-ATT-4 — Full-size preview modal with pagination.**
> As an editor or Viewer, I want clicking any thumbnail to open a
> full-size preview lightbox with ←/→ pagination through every
> attachment in that cell, a Download button, a Delete (detach) button
> shown only to editors, and Esc-to-close.

**US-ATT-5 — Mass download via the browser.**
> As an editor packaging a certification submission, I want to download
> all attachments on a column / table / project as a single zip with
> a deterministic, human-readable filename convention so the certifier
> can pair them with the materials list.

**US-ATT-6 — Mass download via MCP / LLM.**
> As an LLM agent assisting a CPHC, I want to call one MCP tool to
> enumerate every attachment on a project (filtered by table, column,
> or asset_kind) and receive signed download URLs and/or bytes, so I
> can run cross-document workflows ("rename all datasheets by
> manufacturer", "check that every ERV row has a datasheet attached").

**US-ATT-7 — Detach with local undo.**
> As an editor, I want removing an attachment from a cell to be a
> single semantic write op I can ⌘Z (matching the existing per-gesture
> undo contract), and I want the underlying asset to remain recoverable
> through the 90-day GC window (PRD §6.5) so that a wrong-click on
> Delete doesn't permanently destroy the file.

**US-ATT-8 — Reorder attachments within a cell.**
> As an editor, I want to drag-reorder attachments within the preview
> lightbox so the "first" attachment (which becomes the cell's primary
> thumbnail) reflects intent, not upload-order accident.

## 4. AirTable reference behavior (parity baseline)

This is the explicit "what does AirTable do?" reference, captured here
so future contributors don't have to re-screenshot. The screenshot Ed
attached on 2026-05-25 (Appliance Data → CUT SHEETS column) is the
canonical visual reference. Behaviors we adopt unless otherwise
specified:

| # | Behavior | Notes |
|---|---|---|
| 1 | Field type "Attachment" listed in the Add-Field type picker. | **Diverge.** No Add-Field UI for Attachment in v1; cells are pre-set by PHN (§9.2). |
| 2 | Empty cell renders nothing when unselected; when the cell becomes active, a small bordered button with paperclip icon + "Drop files here" text appears inside the cell. Click → open file picker; drop → upload. | **Adopt exactly.** Matches the 2026-05-25 Ed screenshot of row 6. |
| 3 | Dragging files anywhere in the table highlights every Attachment cell as a drop target; releasing over a cell uploads there. | We adopt the *focused-cell* drop target; cross-cell drop is v1.1 (Q-ATT-7 deferred). |
| 4 | Multi-file drop = N attachments, one upload each, in parallel. | We adopt. |
| 5 | While uploading, each attachment shows a placeholder pill ("uploading…") with a determinate or indeterminate progress indicator. | We adopt. |
| 6 | On completion, the pill is replaced by a thumbnail. PDF → first-page render; image → resized image; other (incl. HBJSON) → generic file-type icon. | We adopt; thumbnail pipeline §8. |
| 7 | Cell shows a horizontal strip of thumbnails. **Cell height stays fixed; cell width is fixed. Overflowing thumbnails are reached by horizontal scrolling inside the cell with the mouse wheel; no visible scrollbar chrome.** | **Adopt exactly.** AirTable parity per Ed 2026-05-25. No "+N" collapse needed because mousewheel scroll handles overflow. |
| 8 | Hover a thumbnail → tooltip with filename, size, MIME. | We adopt. |
| 9 | Click thumbnail → modal preview with file name, ←/→ to paginate, Download, Esc to close. | We adopt; modal §7. |
| 10 | **Detach**: click/select a thumbnail in the cell strip (or in the modal's rail); the selected thumbnail gains a focus ring; press **Delete** (or Backspace) → detach. No "Detach" button needed. | **Adopt exactly** per Ed 2026-05-25. Single keystroke; single undo entry. |
| 11 | Reorder attachments by drag inside the modal. | We adopt (US-ATT-8). |
| 12 | Same file dropped into a second cell does **not** re-upload; AirTable links to the existing attachment id. | We dedupe by `content_hash_sha256` server-side; the second cell gets the same `asset_id`. UI behavior matches: instant attach. |
| 13 | Paste an image from clipboard into a focused cell uploads it as an attachment. | v1.1 candidate (Q-ATT-8 deferred). |
| 14 | Per-attachment "Expand" opens the full-size in a new tab. | We adopt as the modal's Open-in-new-tab affordance, which simply opens the signed URL. |
| 15 | Mass-download via the column header `⋯` menu → "Download all" → zip. | We adopt at column, table, and project scope. |
| 16 | File size limit: 5GB (paid), 5MB (free attachments inline). | 25 MB per file v1 default (single-PUT comfortable on R2); per-field configurable; 100 MB hard backend cap. |

## 5. Architecture overview

```
┌─────────────────────────────────────────────────────────────────┐
│ React frontend                                                  │
│                                                                 │
│  <DataTable>                                                    │
│    ↓ FieldDef.field_type === 'attachment'                       │
│  <AttachmentCell>          (renderer + drop target)             │
│    ├─ <AttachmentStrip>    (inline thumbnails + "+N")           │
│    ├─ <AttachmentDropZone> (hover overlay during drag)          │
│    ├─ <AttachmentUploadingPill>                                 │
│    └─ <AttachmentModal>    (full-size preview + pagination)     │
│                                                                 │
│  uploadCoordinator                                              │
│    ├─ initiateUpload()  → POST /assets/upload-intent            │
│    ├─ putToR2()         → direct PUT to signed URL              │
│    └─ completeUpload()  → POST /assets/{id}/complete-upload     │
│         then emits CellWrite (append asset_id) through onWrite  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ REST + MCP
┌─────────────────────────────────────────────────────────────────┐
│ FastAPI backend                                                 │
│                                                                 │
│  features/assets/        (NEW — generic asset feature)          │
│    ├─ routes.py          (REST under /api/v1/projects/.../assets)│
│    ├─ service.py         (orchestrates upload intent, complete) │
│    ├─ repository.py      (raw SQL on project_assets)            │
│    ├─ thumbnailer.py     (PDF→PNG, image→resize)                │
│    └─ storage_r2.py      (S3-compat client; signed URL gen)     │
│                                                                 │
│  features/project_document/                                     │
│    └─ tables/registry.py (registers `attachment` as a v1        │
│                           custom-field type alongside the rest) │
│                                                                 │
│  features/mcp/                                                  │
│    └─ tools/assets.py    (list_assets, get_asset_url,           │
│                           bulk_download_assets, attach_asset,   │
│                           detach_asset, create_upload_intent)   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ writes / reads
              ┌────────────────────┐    ┌────────────────────┐
              │ Postgres            │    │ Cloudflare R2       │
              │ project_assets      │    │ /projects/{pid}/    │
              │ project_versions    │    │   assets/{aid}/     │
              │ project_*_drafts    │    │     file.{ext}      │
              │                     │    │     thumb.png       │
              └────────────────────┘    └────────────────────┘
```

Existing pieces marked in `data-model.md` and `api.md`; this feature
extends them. The single net-new system is the **thumbnail pipeline**
(§8). The single most invasive code change is **elevating `attachment`
into the v1 closed custom-field set** (data-table.md §"Field types"
+ data-model.md §6.6.3).

## 6. Storage backend — Cloudflare R2 (reaffirmed)

### 6.1 Decision

**Keep Cloudflare R2.** No backend swap.

### 6.2 Why R2 is still the right call

| Property | Why it matters for this feature | Verdict |
|---|---|---|
| Zero egress fees | The mass-download workflow (US-ATT-5/6) can pull hundreds of MB per project for a single certification submission; some certifiers ask for *every* datasheet in one push. With AWS S3, ten such pulls/month per project could outpace storage cost by 5-10×. With R2, egress is genuinely free. | ✅ |
| S3-compatible API | All Python S3 tooling (`boto3`, `aioboto3`, `aiobotocore`) works against R2 unchanged. No vendor-locked client. | ✅ |
| Same-platform Workers (optional) | If we want edge-rendered thumbnails or auth-checked downloads at the CDN edge, Cloudflare Workers + R2 is the natural pairing. v1 doesn't need it; v1.1 might. | ✅ optional |
| Pricing | $0.015/GB/month storage; $4.50/M Class A writes; $0.36/M Class B reads; egress = $0. For 50 projects × ~500 MB each = ~25 GB → $0.38/month storage. Trivial. | ✅ |
| Multipart upload | Supported. Not needed in v1 (caps at 25 MB single-PUT), but room to grow. | ✅ |
| Lifecycle rules | Native rule support for object expiration (used for 90-day GC of detached/orphaned assets, PRD §6.5). | ✅ |
| Object metadata | Supports `Content-Type`, `Content-Disposition`, `Cache-Control` on PUT and on signed GETs. Required for the "download with original filename" UX (signed URL must include `response-content-disposition`). | ✅ |
| EU / US residency | Region selection at bucket creation. Default to "automatic" or "EEUR" / "ENAM" — confirm in §15 Q-ATT-15. | ⚠️ |
| Outage history | Cloudflare R2 has had two notable multi-hour outages in 2024-2025. PHN should fail gracefully (cell shows "preview unavailable; retry" rather than crashing the table). | ⚠️ mitigation |

### 6.3 Alternatives considered

| Backend | Rejected because |
|---|---|
| AWS S3 + CloudFront | Egress costs eat the mass-download workflow. CloudFront sigv4 signed URLs are mature but operationally heavier; Lambda@Edge thumbnailing adds another service to operate. |
| Backblaze B2 | Cheaper raw storage than R2 ($0.006/GB) but the egress story is only free *to Cloudflare*. Operationally we'd still front it with Cloudflare; net win is marginal. |
| Render's object storage (beta) | Reduces vendor count, but the product is new and undocumented for our scale; lock-in risk if the beta is sunset. |
| Self-hosted MinIO on Render disk | Defeats the purpose of a separate object store: still backed by an attached disk we have to size and back up. |
| Postgres `bytea` columns | Datasheets up to 25 MB; ~50 per project × 50 projects = ~2.5 GB on the primary DB. Bloats backups, increases vacuum cost, ruins logical-replication speed. Rejected. |
| Cloudflare Images | Auto-thumbnailing, but priced per-image, not per-byte, and only handles images (PDFs out of scope). Could be layered later for image-heavy workflows; not the storage primitive. |

### 6.4 Configuration / ops checklist (already partially wired)

`backend/.env.example` already exposes:
```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=ph-navigator-v2-dev
R2_ENDPOINT_URL=
```

Remaining ops work for Phase 0:
- Create `ph-navigator-v2-dev` and `ph-navigator-v2-prod` buckets.
- Configure **CORS on the bucket** so direct browser PUTs from the
  frontend origin succeed: `AllowedOrigins: [<frontend origin>]`,
  `AllowedMethods: [PUT, GET, HEAD]`, `ExposeHeaders: [ETag]`.
- Configure **lifecycle rules**: objects under
  `projects/{pid}/assets/_orphaned/` auto-delete after 90 days (the
  GC service moves orphans into that prefix).
- Pin **public access = off**. All access is signed-URL only.
- Wire **server-side encryption** (SSE-S3 equivalent). R2 encrypts at
  rest by default; document the guarantee.

## 7. UX — cell, drop, preview, delete

### 7.1 Cell rendering

```
                       fixed cell width
                  ◀──────────────────────────▶
                  ┌──────────────────────────┐
  populated cell  │ [📄][🖼][📄][📄][📄][📄]…│  (mousewheel-scrolls horizontally
                  └──────────────────────────┘   inside the cell; no scrollbar
                                                 chrome; cell height unchanged)

                  ┌──────────────────────────┐
  empty unselected│                          │  (renders blank)
                  └──────────────────────────┘

                  ┌──────────────────────────┐
  empty selected  │  ┌────────────────────┐  │
                  │  │ 📎  Drop files here│  │  (bordered light-gray button;
                  │  └────────────────────┘  │   click → file picker;
                  └──────────────────────────┘   cell is a drop target)
```

Rules:

- **Fixed cell height.** The cell does NOT grow vertically to fit
  thumbnails (AirTable parity, Ed 2026-05-25).
- **Fixed cell width** — driven by the existing column-width view
  state (`data-table.md` §"Column widths").
- **Horizontal mousewheel scroll inside the cell** when the thumbnail
  strip overflows. No visible scrollbar; no `+N` collapse. (AirTable
  parity.) Implementation: cell wrapper has `overflow-x: auto`,
  `scrollbar-width: none`, `::-webkit-scrollbar { display: none }`,
  and a wheel-listener that converts vertical wheel deltas to
  `scrollLeft` when the cursor is over the cell.
- **Each thumbnail tile**: small bordered card; image content scaled
  to fit; PDF → first-page render; image → resized image; other types
  (HBJSON, unknown) → generic file-type glyph. Tile width is uniform
  (~36 px) so the layout is deterministic.
- **Empty unselected cell**: renders nothing — totally blank.
- **Empty selected (active) cell**: shows the "📎 Drop files here"
  pill-button in the cell. Click opens a native file picker; drop
  initiates upload. Matches the 2026-05-25 screenshot.
- **Populated active cell** is also a drop target: dropping appends
  to the existing strip. No additional "+" affordance — the whole
  cell is the drop zone, and the file picker is reachable via the
  preview modal's "Add more…" affordance (kept minimal).
- **Read-only mode** (locked version, Viewer, formula N/A here):
  thumbnails remain clickable for preview/download; no
  drop target; the "Drop files here" button is not rendered even
  when selected.

### 7.2 Selection inside the cell

- Clicking a thumbnail **once** selects it: the tile gains a 2 px
  focus ring (uses an existing token, e.g.
  `--phn-selection-ring`).
- Clicking the same thumbnail **twice** (or pressing Enter / Space
  on a selected tile) opens the preview modal.
- Click outside the cell clears the thumbnail selection.
- Arrow keys ←/→ inside the cell move the selection ring along the
  strip (and scroll the cell horizontally if needed).
- Selection is local to the cell — it does not affect grid-level
  active-cell or range-select state.

### 7.2 Drop interaction

- Dragging files over a cell (active or not) shows a strong drop
  overlay on that cell. Other cells dim.
- Drop = N parallel `upload-intent → PUT → complete-upload` chains, one
  per file.
- Each in-flight file renders as a placeholder pill at the end of the
  strip with an indeterminate progress bar.
- On success, the placeholder swaps to a real thumbnail tile.
- On failure (network, MIME rejection, size cap), the placeholder turns
  red with a brief error tooltip; the user can retry or dismiss.
- The CellWrite that appends each new `asset_id` to the cell's array
  emits **once per file** so each upload is an independently
  undoable / committable op — but they share the *same* gesture group
  so a single ⌘Z removes the whole drop. (Implementation: an
  `op_group_id` on the cell writes; undo collapses a group.)

### 7.3 Preview modal

- Triggered by click on any thumbnail tile.
- Layout: large preview area (~80vw × 80vh), filename strip top,
  Prev/Next chevrons left/right, action bar bottom-right.
- Action bar (editor): `Download`, `Open in new tab`, `Detach`.
- Action bar (Viewer / locked version): `Download`, `Open in new tab`
  only.
- ←/→ paginate within the cell's attachment list.
- Esc closes.
- PDF preview: first-page rendered via `pdfjs-dist` in the browser
  (lazy-loaded chunk; do not bundle in the main hash).
- Image preview: native `<img>` with `loading="eager"`, fit-to-frame.
- Other types: download-only fallback panel.

### 7.4 Reorder inside the modal

- Below the main preview, a small thumbnail rail mirrors the cell's
  strip.
- Drag a thumbnail in the rail to reorder.
- Reorder emits a single CellWrite (array re-shuffled, no asset_id
  added/removed).
- One semantic op; one undo entry.

### 7.5 Detach (delete from cell)

- The `Detach` button removes the current attachment from the cell's
  array. The modal advances to the next attachment, or closes if it was
  the last.
- The underlying `project_assets` row is **not** soft-deleted by this
  gesture; it follows the existing PRD §6.5 rule (asset stays
  available; 90-day GC only after no saved-version-or-active-draft
  references). If the user undoes the detach, the asset_id is
  re-appended.

## 8. Thumbnail pipeline

### 8.1 The choice

Three viable shapes:

| Option | Where | Pros | Cons |
|---|---|---|---|
| **A — Server-side on complete-upload (recommended for v1)** | Backend (Python) using `pypdfium2` for PDFs and `Pillow` for images. Thumbnail PNG is uploaded as a sibling R2 object: `projects/{pid}/assets/{aid}/thumb.png`. | Single render per asset; cheap to serve; deterministic; works for Viewers without auth-checked compute. | Adds a few seconds of latency to `complete-upload` for large PDFs; adds Python deps. |
| B — Client-side on demand | Browser uses `pdfjs-dist` to render the first page on first display; caches in `localStorage` / `Cache API`. | Zero server compute; per-user cache. | Every device re-renders; slow first paint on cold cells; doesn't help server-rendered downloads (zip filenames, MCP). |
| C — Cloudflare Images / Worker | Edge transformation. | Auto-variants; CDN-edge cached. | Paid per image; doesn't handle PDFs natively (would still need PDF→image on backend). |

**Recommendation: Option A.** Adds two Python deps (`pypdfium2`,
`Pillow`) — both well-maintained, MIT/BSD, and small. PDF render is
~200 ms per page on a 5MB datasheet; well within an interactive upload
budget. Thumbnail dimensions: 320×400 px (3-up at default cell density),
~25–40 KB PNG.

### 8.2 Failure modes

- Corrupt PDF: thumbnail generation falls back to a generic "PDF" icon.
  Asset is still marked `uploaded`; the cell still works for download.
  Logged structured warning.
- Unsupported MIME (e.g. .dwg): generic file-type glyph as thumbnail.
  No render attempt.
- Very large PDF (multi-hundred-page spec docs): render only the first
  page; cap render-time at 10 s.

### 8.3 What the API returns

`GET /api/v1/projects/{pid}/assets/{aid}/url` and equivalent MCP tool
both return:
```jsonc
{
  "asset_id": "asset_01HX…",
  "download_url": "https://r2…?…sig=…",   // for original file
  "download_expires_at": "2026-05-25T22:00:00Z",
  "thumbnail_url": "https://r2…?…sig=…",  // null if no thumb yet
  "thumbnail_expires_at": "2026-05-25T22:00:00Z",
  "content_type": "application/pdf",
  "original_filename": "Walltite_ECO_2026.pdf",
  "size_bytes": 5234120
}
```

## 9. Data model

### 9.1 Existing `project_assets` (no shape changes)

The table in `data-model.md` §6.5 already covers everything. v1
attachment work adds these `asset_kind` values to its closed set:
- `datasheet`, `site_photo`, `hbjson` — already specified.
- `simulation_file` — promoted from "future" to v1 for TB sim files.
- `attachment` — **new** generic kind for custom-field attachment
  columns. (Discriminator for "user-driven attachment, not a known
  domain artifact.")
- `export_bundle`, `other` — kept future.

A `metadata` JSONB column on `project_assets` (already there) is the
escape hatch for kind-specific extras; the v1 set is:
```jsonc
{
  "thumbnail_object_key": "projects/{pid}/assets/{aid}/thumb.png",
  "thumbnail_status": "ready" | "pending" | "failed",
  "thumbnail_failure_reason": null | "render_timeout" | ...,
  "page_count": 12,            // PDFs only
  "image_dimensions": [w, h]   // images only
}
```

### 9.2 `attachment` as a v1 custom-field type

**This is the single largest change to the existing canon.**

Today `data-model.md` §6.6.3 says v1 types = `{short_text, long_text,
number, url, single_select, formula}` and explicitly defers
`attachment` to plan-13 §6 "future types." This PRD proposes
**promoting `attachment` into the v1 closed set**, conditional on the
storage + thumbnail + asset API work landing first (Phase 0).

Custom-field shape:
```jsonc
{
  "id": "cf_01HX…",
  "field_key": "u_cut_sheets",
  "display_name": "Cut Sheets",
  "field_type": "attachment",
  "config": {
    "max_count": 10,                 // soft cap; UI warns at limit
    "allowed_mime_types": ["application/pdf",
                           "image/png", "image/jpeg", "image/webp"],
    "max_file_size_mb": 25
  }
}
```

Cell value shape (per row, under `row.custom[cf_id]`):
```jsonc
["asset_01HX…", "asset_01HX…", "asset_01HX…"]
```

Stored as an ordered array of `asset_id` strings. Empty = no
attachments. `null` and `[]` are equivalent on read; writes normalize
to `[]`.

#### 9.2.1 Why elevate to custom field rather than keep core-only

The user's stated workflow (drag-drop attachment column on equipment
tables like AirTable's Appliance Data → CUT SHEETS) cannot be served by
core fields alone, because:
- It must work on tables that **don't yet have an attachment field
  in the document schema** (equipment subtypes, future tables);
- Adding a core attachment field today is a schema-version bump +
  shim + frontend column registration — a full code-and-deploy event;
- Different projects need different attachment columns ("warranty
  PDF", "submittal", "RFI response") — these are project-shaped
  vocabulary, not platform vocabulary.

Core-field attachments (`project_materials.datasheet_asset_ids`,
`segment.photo_asset_ids`, `equipment.*.datasheet_asset_ids`,
`thermal_bridges.simulation_file_asset_ids`,
`thermal_bridges.datasheet_asset_ids`) **remain** for the domain
artifacts where PHN has a strong opinion. Both core and custom render
through the same `<AttachmentCell>` and emit the same write shape.

### 9.3 Validation rules (Pydantic)

On schema-mutation (add/change to `attachment`):
- `max_count` ∈ [1, 50]; default 10.
- `max_file_size_mb` ∈ [1, 100]; default 25.
- `allowed_mime_types` is non-empty; defaults to PDF + standard
  image types.

On cell write:
- value is an array of strings (`asset_id` shape: `asset_<ULID>`).
- Each id must resolve to a non-deleted `project_assets` row in the
  same `project_id`.
- Each asset's `content_type` must satisfy the field's `allowed_mime_types`.
- Array length ≤ `max_count`; otherwise structured `attachment_count_exceeded`.

`changeType` rules:
- `attachment ↔ anything else` is **always** `illegal_type_conversion`.
  Converting away from attachment would orphan the asset references;
  converting *to* attachment would have no source data to migrate.
- The user converts by deleting and re-adding (`deleteField` ⇒
  `addField`).

### 9.4 File size, count, and quota caps

- **Per file:** 25 MB v1 default. Configurable per field via
  `max_file_size_mb`. Hard backend cap 100 MB (single-PUT comfort
  zone on R2; multipart deferred).
- **Per cell:** 10 attachments soft default; 50 hard cap.
- **Per project:** no enforcement v1. Logged in `user_action_log`.
  Quotas land if a project exceeds ~5 GB.
- **Per upload batch (drop):** no explicit cap; backed by per-cell cap.

### 9.5 Save / version interaction

Attachment cell writes go through the **draft buffer** like every
other write (`save-versioning.md` §8.3):
- Upload happens out-of-band (direct PUT to R2 against a signed URL).
- `complete-upload` marks the asset row `uploaded`. **The asset row
  exists in `project_assets` from this point** regardless of whether
  the draft is later saved or discarded.
- Appending the `asset_id` into the cell array is the *cell* write
  through the draft. On Save, the version body includes the
  `asset_id`; on Discard, the asset becomes an orphan.
- Orphan handling: per PRD §6.5 the 90-day GC sweeps assets that no
  saved version *and* no active draft references. This already covers
  the "uploaded then discarded" case.

### 9.6 Schema fingerprint and view state

`data-table.md` §View State requires fingerprinting the schema for
view-state persistence. Adding `attachment` as a custom-field type:
- The fingerprint already includes `field_type`, so it captures
  attachment columns without changes.
- `columnWidths`, `hiddenColumns`, `columnOrder`, etc. apply to
  attachment columns identically.
- Aggregations on attachment columns: only `Count` and
  `Count Unique` make sense; the FieldDef declares the supported set
  per type.

## 10. API surface

### 10.1 REST (mostly already in `api.md §9.10`; gap-fills below)

Already specified — no change:
```
POST   /api/v1/projects/{pid}/assets/upload-intent
POST   /api/v1/projects/{pid}/assets/{aid}/complete-upload
GET    /api/v1/projects/{pid}/assets/{aid}
PATCH  /api/v1/projects/{pid}/assets/{aid}
DELETE /api/v1/projects/{pid}/assets/{aid}
GET    /api/v1/projects/{pid}/assets/{aid}/download
GET    /api/v1/projects/{pid}/assets/{aid}/url
POST   /api/v1/projects/{pid}/assets/{aid}/attach
POST   /api/v1/projects/{pid}/assets/{aid}/detach
GET    /api/v1/projects/{pid}/assets?kind=<asset_kind>
```

**Gap-fills this PRD adds:**

```
POST   /api/v1/projects/{pid}/assets/bulk-upload-intent
       body: { items: [ { asset_kind, filename, content_type,
                          size_bytes, content_hash_sha256 } ... ] }
       returns: [ { asset_id, upload_url, expires_at, duplicate_of? } ... ]
```
Batch version of `upload-intent` for multi-file drop.
Idempotent on `(project_id, content_hash_sha256)`.

```
GET    /api/v1/projects/{pid}/assets/bulk-urls?ids=<csv>
       returns: [ { asset_id, download_url, thumbnail_url, ... } ... ]
```
Batch resolver for cell rendering. Cell renders `N` thumbnails with one
HTTP call, not N. Cap at 100 ids per call.

```
POST   /api/v1/projects/{pid}/assets/bulk-download
       body: { filter: { table_key?, column_key?, asset_ids?,
                         kind? },
               filename_pattern: "<template>"  // e.g.
                                 // "{table}/{row.name}__{filename}"
             }
       returns: 202 + { job_id, status_url }
```
Async zip job. Server streams from R2, packages into a zip, uploads
the zip back to R2 as an `asset_kind = 'export_bundle'`, and the client
polls / SSEs the job until ready. The download URL is just a signed
GET on the export bundle.

```
GET    /api/v1/projects/{pid}/jobs/{job_id}
       returns: { status, progress, result_asset_id?, error? }
```

**Discarded alternatives:** streaming zip (server holds open a long
connection) — works but ties up backend workers; async job + result
asset_id is cleaner and matches HBJSON extraction's pattern.

### 10.2 MCP

Tools added on top of existing `create_asset_upload_intent`,
`complete_asset_upload`, `get_asset_url`, `attach_asset`, `detach_asset`:

```
list_assets(project_id, version_id?, filter)
                                     → page of asset metadata
                                       filter: kind, table_key, column_key,
                                               row_ids, content_type, ...

resolve_asset_urls(project_id, asset_ids[])
                                     → batch signed URLs
                                       (≤ 100 ids per call)

start_bulk_download(project_id, filter, filename_pattern)
                                     → job_id

get_job(project_id, job_id)          → job status; embeds
                                       result_asset_id when complete

bulk_attach(project_id, version_id, attachments[])
                                     → atomic multi-attach across cells
                                       (one undo entry on the draft)

bulk_detach(project_id, version_id, asset_refs[])
                                     → atomic multi-detach
```

`list_assets` is the LLM workhorse for "find me every attachment on
project X." It's a thin filter over `project_assets` with optional
join into the active version's document body when `table_key` /
`column_key` filters are supplied.

`bulk_attach` lets an agent say "I uploaded these 12 PDFs and want each
one attached to the ERV row whose model_number matches the filename
prefix" in one call instead of 12 round-trips. Each per-row attach is
validated independently; partial-failure structured error returns
indexes that failed and why.

### 10.3 Error codes

Adds:
- `asset_count_exceeded` — cell has reached `max_count`.
- `asset_mime_not_allowed` — uploaded MIME isn't in the field's allow-list.
- `asset_size_exceeded` — file size > `max_file_size_mb`.
- `asset_upload_incomplete` — attach attempted on an asset whose
  `upload_status` is still `pending` or `failed`.
- `asset_thumbnail_pending` — read-side warning; cell renders generic
  icon until thumbnail finishes.
- `asset_bulk_partial_failure` — used by bulk routes; includes
  per-item error details.

All conform to the §10.3 minimal envelope (`code`, `message`,
`request_id`, `recoverability`, `details`).

## 11. Security and privacy

- **Public read of project URLs ≠ public asset access by id.** Viewers
  resolve signed URLs only for assets referenced by the version they
  are viewing. The backend enforces this via a "referenced by" check
  before issuing a signed URL to an unauthenticated request.
- **MCP** never anonymous: tokens scoped per project, `asset:read` /
  `asset:write` required, all calls audit-logged.
- **MIME sniffing**: server inspects the first 4–8 KB of the uploaded
  object on `complete-upload` (via R2 GET) and compares against the
  claimed `content_type`. Mismatch → reject (mark asset `failed`,
  surface `asset_mime_not_allowed`).
- **No SVG** in v1 (XSS vector). Defer behind a sanitizer if requested.
- **Signed URL TTL**: 15 minutes for previews; 60 minutes for downloads
  (gives the user time to click). Configurable.
- **Filename sanitization**: `original_filename` is stored verbatim
  (for download UX) but never used as an object key. Object keys are
  always `projects/{pid}/assets/{aid}/file.{ext}` and `thumb.png`.
- **Audit log**: every upload, attach, detach, mass-download writes a
  `user_action_log` row with `project_id`, `asset_id`, `action`,
  `mcp_token_id?`.

## 12. Frontend implementation contract

### 12.1 Field registry

`data-table.md` field-type table grows:

| Type | Requirement |
|---|---|
| `attachment` | Cell value is `string[]` of `asset_id`s. Rendered by `<AttachmentCell>` (cell strip + drop target). Inline edit opens the preview modal. Clipboard semantics: copy serializes a TSV cell as a JSON array of asset ids prefixed `[attach:…]`; paste accepts the same shape only (cross-project paste rejected with structured error `asset_cross_project_paste`). Fill propagates the array verbatim. Aggregations: Count, Count Unique. Sort: by length. Filter: `is_empty`, `is_not_empty`, `count_gte`, `count_lte`. |

### 12.2 `<AttachmentCell>` API

```ts
type AttachmentCellProps = {
  projectId: string;
  versionId: string;
  fieldDef: AttachmentFieldDef;
  value: string[];            // asset_ids
  readOnly: boolean;
  onWrite: (next: string[], opGroupId: string) => void;
  uploadCoordinator: UploadCoordinator;
};
```

The cell is dumb about the WriteOp pipeline — it emits a normalized
`string[]` and the parent table converts to a `CellWrite`. Uploads
go through `uploadCoordinator`, which the parent (`<DataTable>`)
injects so multiple cells share a connection pool and respect the
table's FIFO draft-write queue.

### 12.3 Upload coordinator

```ts
type UploadCoordinator = {
  start(file: File, ctx: UploadContext): Promise<string /* asset_id */>;
  startBatch(files: File[], ctx: UploadContext):
    AsyncIterable<UploadProgress | UploadComplete | UploadError>;
  abort(uploadId: string): void;
};
```

- Wraps the 3-step upload-intent → PUT → complete-upload chain.
- Caps concurrent uploads at 4 (configurable; mirrors browser HTTP/1.1
  per-origin limit comfortably).
- Emits progress events the cell uses to render the placeholder pill.
- Dedupes client-side by SHA-256 of the file content before
  upload-intent (so two cells dropping the same file in quick
  succession share a single intent call).

### 12.4 Preview modal

- Lazy-loaded route-level chunk (`pdfjs-dist` is heavy ~1.2 MB gzip;
  must not be in the table's main bundle).
- PDF: `pdfjs-dist` worker bundle preloaded on first attachment
  modal open per session.
- Image: native `<img>`.
- Keyboard: Esc, ←/→, ⌘D download.
- Mobile: out of scope per PRD §3 non-goals.

## 13. Phasing

This is too large for one slice. Proposed five phases; each is
independently shippable and produces a manually-verifiable surface.

| Phase | Slice | Scope | Verification target |
|---|---|---|---|
| **0. Storage + asset backbone** | Backend-only foundation | R2 buckets created + CORS configured; `project_assets` table + repository + service + R2 storage client (`storage_r2.py`); `upload-intent` / `complete-upload` / `delete` / `download` / `url` endpoints; thumbnailer (`pypdfium2` + `Pillow`); content-hash dedup; basic structured errors; pytest covering upload flow end-to-end with a localstack-style R2 mock. | curl upload-intent → PUT → complete-upload → GET url → file roundtrips; thumb.png materialized for PDF + PNG. |
| **1. Site-photo core-field cell (envelope segments)** | First user-facing cell | `<AttachmentCell>` for the existing `segment.photo_asset_ids[]` core field. Drag-drop, upload coordinator, in-cell thumbnail strip, preview modal with download. Single cell type (photo only, no PDFs yet). | Open WALL-C3 assembly, drag two JPGs onto a segment cell, see them upload + preview; reload, see them persist; download. |
| **2. Datasheet core-field cell (project_materials, equipment)** | PDF support + per-product semantics | Extend `<AttachmentCell>` to PDFs via the thumbnailer. Wire to `project_materials.datasheet_asset_ids[]` and `equipment.*.datasheet_asset_ids[]`. Per-row detach, undo, bulk paste/fill across cells of the same column. NEW-DATASHEET-1 column-level zip download. | Build a wall assembly with three project_materials; drag a PDF onto each; verify PDF thumbnail renders; download all from Specifications sub-tab. |
| **3. `attachment` as v1 custom-field type** | The AirTable parity feature | Promote `attachment` into the closed v1 custom-field set; wire schema mutations (addField/deleteField with cell-clear; changeType blocked); custom-field config (max_count, allowed_mime_types, max_file_size_mb); single CellWrite shape consumed by both core and custom attachment cells; viewer-mode read-only. | On Equipment → Pumps table, add an "Attachments" custom column; drop multiple PDFs; close and reopen; preview/download; remove column → cells cleared; assets orphaned + GC scheduled. |
| **4. Bulk-download jobs + MCP ergonomics** | Cross-project / cross-LLM workflows | Bulk download job endpoint + worker + zip packager (template-based filename pattern); MCP `list_assets`, `resolve_asset_urls`, `start_bulk_download`, `bulk_attach`, `bulk_detach`; OpenAPI publishes the full schema. | From Claude Desktop: `list every datasheet on Project Foo with manufacturer = "Mitsubishi" and start a bulk download named by Tag`; receive a zip URL; download. |
| 5. Polish + v1.1 candidates (post-MVP) | — | Recently-deleted UI, clipboard paste-image, cross-cell drop target, gallery view, reorder UX polish, multipart upload for > 25 MB, Cloudflare Worker–rendered thumbnails. | — |

Phases 0–2 are blocking for any envelope-tab work (US-ENV-2). Phase 3
is blocking for the user's stated AirTable-column-on-Pumps workflow.
Phase 4 unlocks the LLM-driven workflows in NEW-DATASHEET-1 and
NEW-LLM-API-1.

Estimated rough sequencing: Phase 0 in 1 PR slice; Phase 1 in 1 slice;
Phase 2 in 2 slices (datasheet UX + bulk-zip for column); Phase 3 in
2 slices (custom field type + schema mutations + viewer); Phase 4 in
1-2 slices.

## 14. Cross-cutting decisions to ratify in this PRD

Each line is a deliberate position, not a question. Move to §15 if it
becomes contentious.

1. **R2 stays.** No backend swap. (§6)
2. **Server-side thumbnails on `complete-upload`.** Python deps:
   `pypdfium2`, `Pillow`. (§8)
3. **Elevate `attachment` to v1 custom-field type.** Closed set
   becomes 7. (§9.2)
4. **Core attachment fields remain** for the four known PH artifacts
   (material datasheets, segment photos, equipment datasheets, TB
   sim/datasheets). Both render through the same cell. (§9.2.1)
5. **Detach != delete.** v1 ships 90-day GC; in-app "Recently
   deleted" UI is v1.1. (§7.5)
6. **One undo per drop gesture.** Multi-file drop is one logical
   group; ⌘Z removes the whole batch. (§7.2)
7. **Bytes are immutable.** Replacing an attachment = upload new +
   detach old. No in-place version chain on a single asset_id. (§2.2)
8. **MCP is the bulk-download backbone for LLM workflows.** Browser
   uses the same async-job endpoint. (§10.1, §10.2)
9. **No SVG, no .exe-family MIMEs, no scripts.** (§11)
10. **Public viewers** preview and download referenced assets only;
    cannot enumerate. (§11)

## 15. Open questions for discussion

### 15.1 Resolved 2026-05-25

- **Q-ATT-1 (custom-field elevation):** RESOLVED — **promote
  `attachment` into the v1 closed custom-field set** (Phase 3 ships
  as scoped). AirTable parity is the whole point of this feature;
  core-field-only attachments would force a code-and-deploy per new
  column. Closed set becomes 7 types.
- **Q-ATT-2 (thumbnail pipeline):** RESOLVED — **server-side on
  `complete-upload`** (Option A). Python deps `pypdfium2` + `Pillow`.
  PDF first-page render at 320×400 px stored as `thumb.png` sibling
  R2 object. Render-time cap 10 s; failures fall back to generic
  type icon and mark `thumbnail_status = failed` without blocking
  the upload. Run as a FastAPI background task on
  `complete-upload`; promote to a real job queue later if pool
  starvation appears (Q-ATT-18).
- **Q-ATT-3 (file-size cap):** RESOLVED — **25 MB per file** as the
  v1 soft default; backend hard cap 100 MB; per-field configurable
  in `config.max_file_size_mb`. Multipart upload stays deferred.
- **Q-ATT-4 (per-cell count cap):** RESOLVED — **10 attachments per
  cell** soft default; hard cap 50. Per-field configurable in
  `config.max_count`.
- **Q-ATT-6 (trash UI):** RESOLVED — **detach silently; 90-day
  server-side GC.** No in-app "Recently deleted" pane in v1.
  Restoration is admin/SQL only. v1.1 candidate per §17.

### 15.2 Still open

5. **Q-ATT-5 — Bulk download filename convention.** (Open.) Template
   variables available: `{table}`, `{row.name}`, `{row.<core_key>}`,
   `{filename}`, `{ext}`, `{kind}`, `{cf_id}`. Default for the
   project-wide datasheet zip (NEW-DATASHEET-1)?  Proposal:
   `{table}/{row.name}__{filename}` and a top-level `MANIFEST.csv`
   mapping rows to filenames.

6. **Q-ATT-6 — Trash UI (Recently deleted).** v1 has none (server
   GC only). When the first user accidentally deletes a datasheet
   and asks "where did it go?", do we add a per-project "Recently
   deleted assets" pane, or surface restoration only through the
   admin/SQL path? **Lean: v1.1.**

7. **Q-ATT-7 — Cross-cell drop target.** AirTable lets you drag a
   file *anywhere* in the table and every Attachment cell becomes a
   drop target; you release over the cell you want. Worth the
   complexity? **Lean: cell-only drop in v1; cross-cell in v1.1.**

8. **Q-ATT-8 — Clipboard paste-image.** Cmd+V on a focused
   attachment cell when an image is in the clipboard auto-uploads.
   AirTable supports. **Lean: v1.1.**

9. **Q-ATT-9 — PDF preview library footprint.** `pdfjs-dist` adds
   ~1.2 MB gzip. Acceptable as a lazy chunk (only loads when modal
   opens)? Alternative: server-rendered preview PNGs at multiple
   resolutions. **Lean: pdfjs-dist lazy chunk.**

10. **Q-ATT-10 — Where does "Add Attachment field" live in the
    UI?**  Same Add-Field popover used by text/number/select, OR
    its own surface? **Lean: same popover.**

11. **Q-ATT-11 — `changeType` policy.** §9.3 proposes
    `attachment ↔ anything else = illegal`. Worth confirming Ed has
    no real use case for "convert this URL column to attachment by
    fetching each URL." **Lean: confirm illegal; the fetch workflow
    is an MCP task, not a column type change.**

12. **Q-ATT-12 — Per-attachment description / caption.** AirTable
    has none; Notion has captions. Each attachment in v1 is just
    `asset_id`; if the user wants to caption "as-built south wall,
    2026-04-15", they put that in a sibling text column. **Lean:
    no caption per attachment in v1.**

13. **Q-ATT-13 — Versioning of the same logical attachment.**
    Ed uploads `Walltite_v1.pdf` and later receives
    `Walltite_v2.pdf`; what's the workflow? Today the answer is
    "upload v2 + detach v1," with v1 still in the saved version's
    history. Worth a explicit "Replace" UX in the modal that does
    both atomically? **Lean: yes, "Replace…" in the modal in v1
    (cheap to add).**

14. **Q-ATT-14 — Bucket region and residency.** R2 supports
    `automatic`, `WEUR`, `EEUR`, `ENAM`, `WNAM`, `APAC`. Default for
    PHN is `ENAM` (Brooklyn, NYC) but Phius/EU work could change
    this. **Lean: `ENAM` for v1, single-bucket.**

15. **Q-ATT-15 — Custom-field attachment on locked versions.**
    Locked versions reject all writes per §8 of the save model. A
    custom Attachment column added in version V then locked: viewer
    sees the thumbnails and can download. Editor switching back to
    V sees them but cannot attach more. Confirmed by §8 already;
    flagging because it's the first user-visible "you can browse
    but not append" surface where the contrast with AirTable's
    "anywhere editable" model is sharp.

16. **Q-ATT-16 — Custom-field attachment and refresh-from-catalog.**
    Catalog tables don't carry custom fields (§9.2 limit), and
    catalog rows don't carry datasheets (Q-ENV-2.1). So
    refresh-from-catalog never has to merge attachment cells. No
    cross-impact. **Resolved by composition; no decision needed.**

17. **Q-ATT-17 — Asset reuse across projects.** Today an asset is
    `project_id`-scoped. Two projects using the same Walltite
    datasheet each get their own asset row + R2 object. Reasonable
    for now; future "PH-Materials shared workspace" parity might
    want a cross-project asset library. **Out of scope for v1.**

18. **Q-ATT-18 — Web Worker thumbnailing vs. main thread.** PDF
    render is CPU-bound. Server-side runs in a worker pool; the
    backend should not block the request loop. Use FastAPI
    `BackgroundTasks` or a real `Celery`/`RQ` worker? **Lean: start
    with FastAPI background task on `complete-upload`; promote to a
    proper job queue when concurrency justifies.**

19. **Q-ATT-19 — Idempotency for upload-intent.** §10 says batch
    intent is idempotent on `(project_id, content_hash_sha256)`.
    Confirm single-intent is also keyed on the same tuple via
    `Idempotency-Key` header semantics (api.md §9.5). **Lean: yes;
    same rule for both endpoints.**

20. **Q-ATT-20 — Drop on locked-row vs. locked-version.** Locked
    *version* clearly read-only. Per-row lock isn't a v1 concept.
    Note for the future.

## 16. Risks

- **R1: R2 outages.** The cell must degrade to "preview unavailable;
  download will retry" rather than crash the table. UI must never
  block the rest of the editor on an asset fetch.
- **R2: Asset orphan accumulation.** If GC ever lags, orphan assets
  pile up. Add an ops dashboard counter; alarm on
  `orphan_asset_count > 1000`.
- **R3: Thumbnail render queue starvation.** A spike of large PDFs
  could pin the background workers. Bound the queue; on overflow,
  mark `thumbnail_status = pending` and render lazily on first GET.
- **R4: Custom-field attachment + locked versions.** If a user adds an
  attachment column in version V_working, fills it, then Save-As'es to
  V_locked, and later wants to remove the column — the
  `deleteField` flow needs to clear cells across the unlocked draft
  cleanly. Tests must cover this.
- **R5: Signed-URL leakage via Viewer.** A Viewer who downloads a
  signed URL retains the URL until expiry. Mitigation: short TTL,
  and never embed signed URLs in cached HTML.
- **R6: Cost surprise from a malicious uploader.** Auth gates writes;
  there is no anonymous upload. Quota work tracked as v1.1.

## 17. Out-of-scope reminders (visibility)

- In-app PDF annotation.
- Per-attachment captions / metadata fields.
- Cross-project shared asset library.
- AirTable-style "Recently deleted" trash UI.
- Multipart / resumable upload (> 25 MB).
- Mobile attachment UX.
- Auto-extract spec values from datasheets (agentic, post-v1).

## 18. Next steps

1. Walk through §15 open questions with Ed; record resolutions inline
   here as a Resolved section (mirrors PRD §17 style).
2. Once §14 + §15 stabilize, graduate the durable shape into:
   - `context/technical-requirements/attachments.md` (NEW canonical
     contract);
   - small additions to `data-model.md` §6.5 + §6.6 (attachment as
     custom-field type; metadata extras);
   - small additions to `api.md` §9.10 (bulk endpoints) and
     `llm-mcp-schema.md` §10.3 (bulk + list_assets tools);
   - one row added to the `FieldDef` table in `data-table.md`.
3. Write the first phase plan (`plan-23-attachments-phase-0-storage-backbone.md`)
   covering Phase 0 only — backend + R2 + thumbnailer + endpoints +
   tests. No frontend.
4. Bring Phases 1–4 into individually-dated plans as they begin.
