---
DATE: 2026-06-24
TIME: 17:58 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Phase 0 — ProjectGlazing/ProjectFrame models, flat tables, element FK
  fields, cross-table validation, ensure_project_* upsert helpers.
RELATED: ../PRD.md, ./phase-01-document-migration.md
---

# Phase 0 — Models + flat tables + FK + upsert helpers

**Co-lands with Phase 1** (the migration). Together they are one PR: this phase
makes the old apertures shape invalid, so the migration must ship alongside.

## Targets

### 1. New models — `backend/features/project_document/envelope_models.py`

Add `ProjectGlazing` and `ProjectFrame` directly after `ProjectMaterial`
(`:217-269`), copying its structure verbatim (the `extra="forbid"` config, the
string-strip / color-normalize validators, and the
`require_catalog_origin_family` model-validator).

- `ProjectGlazing`: `id` pattern `^pglz_[A-Za-z0-9_-]+$`; fields from `GlazingRef`
  (`:122-149`) minus `datasheet_url`; add `specification_status:
  SpecificationStatus = "missing"`, `datasheet_asset_ids: list[str] =
  Field(default_factory=list)`, `catalog_origin` with
  `expected_table="glazing_types"`.
- `ProjectFrame`: `id` pattern `^pfrm_[A-Za-z0-9_-]+$`; fields from `FrameRef`
  (`:84-119`) minus `datasheet_url`; same three added fields with
  `expected_table="frame_types"`.

### 2. Element FK fields — same file

- `ApertureElement.glazing` (`:320`) → `glazing_id: str | None = Field(default=None,
  pattern=r"^pglz_[A-Za-z0-9_-]+$", max_length=80)`.
- `ApertureElementFrames` (`:292-300`) `top/right/bottom/left` → `str | None`
  with pattern `^pfrm_...`.

Keep `GlazingRef`/`FrameRef` as-is (still used by the pick payload + bookshelf
helpers; D-4).

### 3. Document tables — `backend/features/project_document/document.py`

- In `ProjectDocumentTables` (`:264-269`) add `project_glazings: list[ProjectGlazing]`
  and `project_frames: list[ProjectFrame]` (default empty), importing the new
  models (they live in `envelope_models`, re-exported through `document.py` like
  `ProjectMaterial`).
- Bump `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` `11 → 12` (`:197`) and the
  `schema_version: Literal[11]` → `Literal[12]` (`:293`).
- Add unique-id validation for both new tables (reuse `validate_unique_ids` from
  `_validators`).
- Add a **cross-table FK model-validator** on `ProjectDocumentV1` (near the
  existing aperture loop `:618`): every `element.glazing_id` resolves to a
  `project_glazings` id; every frame-slot id resolves to a `project_frames` id.
  Mirror how segment→material integrity is treated.

### 4. Upsert/dedup helpers — `backend/features/project_document/apertures/_ref_helpers.py`

Add `ensure_project_glazing(tables, ref: GlazingRef) -> str` and
`ensure_project_frame(tables, ref: FrameRef) -> str`:

- Catalog ref (`ref.catalog_origin` set): find an existing row with the same
  `(catalog_table, catalog_record_id)`; reuse its id, else append a new
  `ProjectGlazing`/`ProjectFrame` built from the ref (carrying `catalog_origin`,
  default `specification_status="missing"`, empty `datasheet_asset_ids`) with a
  freshly minted `pglz_`/`pfrm_` id.
- Hand-entered ref (D-2 Option A): always append a new entity.
- Return the entity id. (Pure function over the tables object; the pick handler
  in Phase 2 calls it.)

Use the existing id-minting helper the codebase uses for `pmat_`/`apt_` ids
(locate the id factory used by `factories.py`); do **not** introduce a new id
scheme.

## Tests

- `ProjectGlazing`/`ProjectFrame` validate like `ProjectMaterial` (round-trip,
  `extra="forbid"` rejects unknown, color normalize, catalog-origin family
  check rejects wrong `catalog_table`).
- Element with a `glazing_id` that has no matching flat row → document validation
  error (cross-table FK).
- `ensure_project_glazing/frame`: catalog ref dedups to one row across repeat
  calls; distinct `catalog_record_id`s create distinct rows; hand-entered always
  appends (Option A).

## Exit criteria

- Met. Verified with focused backend tests, touched-file `ruff check`, and full
  backend `uv run pytest` (1097 passed, 2 skipped).
