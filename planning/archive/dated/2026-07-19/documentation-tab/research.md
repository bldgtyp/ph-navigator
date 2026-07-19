---
DATE: 2026-07-18
TIME: 16:10
STATUS: Complete (code survey — verified against source 2026-07-18)
AUTHOR: Claude (Fable 5) via parallel Explore agents
SCOPE: Current-state map of the asset/photo/datasheet/status infrastructure this feature builds on
RELATED: PRD.md, context/technical-requirements/attachments.md, context/DATA_STORAGE.md §4
---

# Site Photos — current-state code survey

## TL;DR

- **Datasheets: already done everywhere.** Every equipment table (ventilators,
  4 heat-pump leaves, pumps, fans, hot-water heaters/tanks, electric heaters,
  appliances, thermal bridges) plus glazings/frames/materials has
  `datasheet_asset_ids` wired end-to-end: backend field def + attachment
  registry + frontend `attachmentColumn` / `AttachmentCell` with
  `DATASHEET_ATTACHMENT_CONFIG`. This confirms Ed's "TO VERIFY" — equipment
  supports datasheets only.
- **Photos: exist ONLY on envelope assembly segments**
  (`assembly_segments.photo_asset_ids`, asset kind `site_photo`, max 10 /
  25 MB, png+jpeg+webp). No equipment table or aperture record has a photos
  field.
- **The asset backbone is fully generic** — adding equipment photos is
  additive, no new storage/thumbnail/signed-URL work.

## The asset backbone (reuse, don't rebuild)

- **Registry (the gatekeeper):** `backend/features/assets/registry.py` —
  locked `ATTACHMENT_FIELDS` tuple defines every document path that may hold
  asset ids, with kind/MIME/size/max-count policy. `AssetKind` already
  includes `"site_photo"`. Equipment table-key→document-path routing already
  exists (`EQUIPMENT_ATTACHMENT_TABLE_KEYS`, `HEAT_PUMP_ATTACHMENT_TABLE_KEYS`).
  Attachments are **not user-extensible**; new cells are a code change here.
- **Upload flow:** 3-step signed-URL — sha256 → `POST /assets/upload-intent`
  → client `PUT` to R2/MinIO → `POST /assets/{id}/complete-upload`
  (magic-byte sniff, size re-check, background thumbnail via pypdfium2 /
  Pillow, EXIF-transposed). Server never proxies bytes. Content-hash dedup.
- **Refs live INSIDE the versioned JSONB document** as `list[str]` of asset
  ids; `project_assets` is only the byte-pointer table. Attach/detach writes
  go to the **per-user draft** (`_mutate_attachment_array` in
  `assets/service.py`), never directly to a saved version. Save-As shares
  asset ids; GC is reference-aware (90-day orphan sweep).
- **Frontend shared pieces:**
  - `features/assets/components/AttachmentCell.tsx` — the single shared
    upload/preview cell (drag-drop, thumbnails, lightbox modal with
    prev/next/replace/detach/download; `variant: "cell" | "card"`).
  - `features/assets/lib.ts` — `DATASHEET_ATTACHMENT_CONFIG`,
    `SITE_PHOTO_ATTACHMENT_CONFIG` (both exist already).
  - `shared/ui/data-table/columns.tsx` → `attachmentColumn()` (what every
    equipment table uses for datasheets — emits generic CellWrite).
  - `features/assets/hooks.ts` — `useAssetUrls` (bulk signed URLs, polls
    2.5 s while thumbnails pending), `uploadAsset`.
  - `shared/ui/report-table/AttachmentChipCell.tsx` — compact count chip
    (Materials collapsed rows), explicitly designed for cross-surface reuse.
- **Two coexisting write paths** (both land in the same draft arrays):
  materials/apertures use `POST /assets/{id}/attach` + `/detach` (diff-based,
  `envelope/hooks.ts`); equipment tables use whole-array CellWrite through
  the document-write API.

## Equipment tables (the extension targets)

All under document `tables.equipment.*`; contracts in
`backend/features/project_document/tables/<table>.py`; row models in
`project_document/document.py`, `heat_pumps/models.py`, `rows.py`.

Every table has: `datasheet_asset_ids` built-in field + the shared `status`
field (`_status_field.py`: `opt_status_complete/needed/question/na`, default
`needed`; `STATUS_TABLE_NAMES` = the 12-table source of truth). None has
photos. Envelope/aperture records use `specification_status` instead
(`missing/question/complete/na`).

Frontend: `features/equipment/` — `routes/equipmentPageConfig.ts`
(`EQUIPMENT_TABS`: ventilators, heat-pumps, pumps, fans, hot-water-heaters,
hot-water-tanks, electric-heaters, appliances), per-table
`components/*Table.tsx` all DataTable-based with a Datasheet
`attachmentColumn`. Heat pumps render four leaf tables.

### Net change to add equipment photos

1. `photo_asset_ids` FieldDef per table module + `list[str]` default on row
   models (mirror the datasheet lines; consider extracting a shared
   `datasheet/photo_field_def()` helper — status already has one, datasheet
   is hand-copied 12×).
2. Registry entries per table (`site_photo` kind; `iter_rows_for_raw_tables`
   already routes equipment tables).
3. One more `attachmentColumn` (config = `SITE_PHOTO_ATTACHMENT_CONFIG`) per
   `*Table.tsx` + `*_PHOTO_FIELD_KEY` constants + `buildEmpty*Row` defaults.
4. Document schema-migration note: new fields default to `[]`; existing saved
   versions validate via defaults (verify against the document
   schema-migration mechanism decision, memory 2026-06-24).

## Status tab (the projection precedent)

- Backend: `project_document/status_summary.py` — `STATUS_SUMMARY_TABLES`
  master list; groups Mechanical / DHW / Envelope / Thermal Bridges; two
  status sources (`custom_status` via `custom_values["status"]`,
  `specification_status` for glazings/frames/materials). Endpoints:
  `GET /document/status-summary` (saved) + `GET /draft/status-summary`.
- Frontend: `features/project_status/components/RecordStatusSummary.tsx`
  (`record-status`), `summary.ts` (`statusSummaryDestinationPath` — links
  back to owning surfaces with `focus={row_id}`).
- **Completion currently derives only from status-field values — not from
  datasheet/photo presence.** A photos done/missing overview needs either an
  extended summary payload or a sibling endpoint.
- Separate feature, don't conflate: `features/project_status/` "status items"
  = the manual roadmap checklist.

## US-ENV-15 (drafted envelope Site Photos sub-tab — unbuilt)

`context/user-stories/20-envelope.md` §US-ENV-15 (Draft, promoted to MVP
2026-05-10): 4th envelope sub-tab `/envelope/site-photos`; groups the same
per-segment photos by `assembly.type` (wall/floor/roof/other — field exists
per Q-ENV-15.1); sticky section headers with anchor-copy links; per-assembly
cards with mini cross-section strip; **editable here too** (same write
affordances, "different view of the same data"); photo zones disabled when
material `specification_status === 'na'` (Q-ENV-13.3); Viewer rendering is
the primary motivation (contractor share via normal public project URL).
Route today: placeholder only.

## Access model (what Story 3 relies on; full survey in contributor-auth/research.md)

- Anonymous visitors get `ViewerPrincipal("client")` → `project.view` only;
  **every project URL is publicly readable** (no per-project public/private
  flag; `access_mode` is computed per request, not stored). Metadata
  redaction for viewers exists (public_alias etc.).
- All asset **reads** (list/url/download) allow viewers — but only assets
  referenced by the version being viewed. All asset **writes** require
  `require_editor_user` (any signed-in user = full editor in the beta model).
- Draft/save wrinkle: photos attach to the editor's draft; anonymous viewers
  see the **last saved version**. Newly-uploaded photos are invisible to
  contractors until a Save. (PRD §D6.)

## V0 precedent (the directions-page content model)

`/Users/em/Desktop/PH-Navigator-site-photos.html` (V0 `/envelope-data/site-photos`):
static instructional page, one content block per assembly type
(Floor/Wall/Roof), each a grid of "required photo" cards = instruction
bullet-list (camera icon) + example photo (e.g. "Show installed insulation
thickness using a ruler in the image", "Include photo of the product wrapper
/ stamp showing brand / type"). Equipment block was a stub pointing at the
equipment section. Content was hardcoded frontend copy + bundled example
images; not per-project.
