---
DATE: 2026-06-24
TIME: 17:30 EDT
STATUS: Planning
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Product/behavior contract for promoting glazings/frames to documented
  project entities (Materials parity).
RELATED: ./README.md, ./decisions.md, ./PLAN.md, ./phases/
---

# PRD — Glazing + Frame Documentation

## Goal

Glazings and frames become **flat, deduped, documented project entities** that
mirror `ProjectMaterial`, so a user can attach datasheets and set a
specification status **per product, once**, and so the two report pages can be
built as `MaterialsPanel` clones. The aperture builder keeps working unchanged.

## The target shape (mirror `ProjectMaterial`)

`ProjectMaterial` (`backend/features/project_document/envelope_models.py:217-269`)
is the template. The new models live in the same file and copy its structure:
`id`, the spec fields, `specification_status: SpecificationStatus = "missing"`,
`datasheet_asset_ids: list[str]`, `catalog_origin: CatalogOrigin | None`, plus
the same `extra="forbid"`, string-strip/color validators, and the
`require_catalog_origin_family(...)` model-validator (with the matching
`expected_table`).

### `ProjectGlazing`

`id` pattern `^pglz_[A-Za-z0-9_-]+$`. Data fields copied from `GlazingRef`
(`envelope_models.py:122-149`): `name`, `manufacturer`, `brand`, `suffix`,
`u_value_w_m2k`, `g_value`, `color`, `source`, `comments`. **Drop** the
inline-only `datasheet_url` (replaced by the `datasheet_asset_ids` bookshelf).
Add `specification_status`, `datasheet_asset_ids`, `catalog_origin`
(`expected_table="glazing_types"`).

### `ProjectFrame`

`id` pattern `^pfrm_[A-Za-z0-9_-]+$`. Data fields copied from `FrameRef`
(`envelope_models.py:84-119`): `name`, `manufacturer`, `brand`, `use`,
`operation`, `location`, `mull_type`, `prefix`, `suffix`, `material`,
`width_mm`, `u_value_w_m2k`, `psi_g_w_mk`, `psi_install_w_mk`, `color`,
`source`, `comments`. **Drop** `datasheet_url`. Add `specification_status`,
`datasheet_asset_ids`, `catalog_origin` (`expected_table="frame_types"`).

### Tables (mirror `tables.project_materials`)

In `ProjectDocumentTables` (`document.py:264-269`):

```python
project_glazings: list[ProjectGlazing] = Field(default_factory=list)
project_frames:   list[ProjectFrame]   = Field(default_factory=list)
```

Add unique-id validation (reuse `validate_unique_ids`) and a **cross-table FK
validator**: every `element.glazing_id` / frame-slot id must resolve to a row
in the corresponding flat table (this is the apertures analogue of the existing
segment→material checks). `schema_version` bumps `11 → 12`
(`document.py:197,293`).

### Aperture element FK fields (replace inline refs)

In `envelope_models.py`:

- `ApertureElement.glazing: GlazingRef | None`  →  `glazing_id: str | None`
  (pattern `^pglz_...`).  (`:320`)
- `ApertureElementFrames.{top,right,bottom,left}: FrameRef | None`  →
  `... : str | None` (pattern `^pfrm_...`).  (`:292-300`)

`GlazingRef` / `FrameRef` are **retained** as the catalog-copy DTO used by the
pick command payload and the bookshelf-copy helpers — they are simply no longer
stored on the element (see Phase 2). Their `datasheet_url` field stays for now
(import/export compatibility); it is not promoted.

## Dedup rules (how "shown once" is honored)

A pick/construction site **upserts** into the flat table and returns an id:

- **Catalog-sourced ref** (`catalog_origin.catalog_record_id` set): dedup by
  `(catalog_table, catalog_record_id)`. Same product picked on 4 sides / many
  windows → one `ProjectFrame` row → "shown once." The built-in default
  frame/glazing (`recPHNDefFrame001` / `recPHNDefGlazng01`) dedup this way
  automatically.
- **Hand-entered ref** (`catalog_origin is None`): **each pick creates its own
  entity**, exactly like `ProjectMaterial` (no value-dedup). This is the
  Materials-faithful default. See `decisions.md` D-2 for the alternative
  (value-tuple dedup) Ed can opt into if hand-entered duplication proves noisy.

Upsert/dedup is **backend-owned** (honors the "all data manipulation lives in
the backend" hard rule). The frontend keeps sending the existing pick command
with the full ref payload; the handler does the upsert + FK assignment.

## Semantics change (intended, must be flagged to users later)

The flat model adopts Materials' **shared-edit semantics**:

- Editing a `ProjectFrame`/`ProjectGlazing` (values or spec-status) changes
  **every** aperture slot that references it.
- To make one slot different, the user **picks or hand-enters a different
  product** (the Materials "detach to a new material" pattern,
  envelope-tab.md §2.7.3).

This replaces today's per-slot-independent inline editing. The not-yet-built
`EditFieldOverride` command (`aperture_commands/models.py:180-199`, currently in
`_NOT_IMPLEMENTED_KINDS`) is therefore **obsolete** under the new model — drop
it rather than implement it.

## Datasheet bookshelf (the headline capability)

Reuse the generic asset-attachment registry, not a new pipeline
(`backend/features/assets/registry.py`):

- Add `project_glazings` and `project_frames` to the datasheet `ATTACHMENT_FIELDS`
  table list (`registry.py:~34,54-55`) with `field_key="datasheet_asset_ids"`.
- Extend `iter_rows_for_raw_tables` (`registry.py:224-233`) to return rows for
  the two new tables.

That is the entire backend wiring for "link datasheets to glazings/frames just
like materials." The UI (drag-and-drop `AttachmentCell`) lands with the report
pages.

## Specification status

`ProjectGlazing`/`ProjectFrame` default `specification_status="missing"` and
accept the existing `SpecificationStatus` literal
(`complete | missing | question | na`, `envelope_models.py:27`). Set via the
documentation command in Phase 3. No new status vocabulary.

## Drift

`aperture_drift/comparator.py` already compares ref fields against the catalog
row (`_FRAME_KEYS` :21-38, `_GLAZING_KEYS` :43-52). After promotion it compares
the **`ProjectFrame`/`ProjectGlazing`** against the catalog instead of the
inline ref — same key lists, new source. `name` stays excluded (derived). No
new fields are added to the drift keys (`specification_status`,
`datasheet_asset_ids` are project-side documentation, never catalog-compared —
mirror `ProjectMaterial`, whose drift also ignores them).

## Non-goals

- No new report page (that is the sibling feature).
- No new datasheet/spec-status **UI** here (API + integration tested only).
- No change to the catalog tables (`catalog_glazing_types` / `catalog_frame_types`)
  or to `window-glass-catalog-enums`.
- No per-use-site **site photos** for apertures in v1 (materials have them per
  segment; whether aperture use-sites get installation photos is deferred — see
  `decisions.md` D-5). The read use-sites still carry the field shape so it can
  be added later without a schema change.
- No backwards compatibility for un-migratable legacy docs beyond the standard
  safe-mode read fallback (`store.py:255-277`); PHN is pre-deploy.

## Invariants / acceptance

- Every `element.glazing_id` / frame-slot id resolves to a flat-table row
  (cross-table validator; document fails closed otherwise).
- A catalog product used N times appears as exactly **one** flat row.
- A fresh seed + a migrated v11 dev document both validate as v12 and render an
  unchanged aperture builder.
- `make ci` green (backend suite + ruff + ty) at the end of every backend phase.
