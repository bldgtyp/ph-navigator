---
DATE: 2026-06-24
TIME: 17:58 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Phase 3 — documentation commands (spec-status + field edits + remove),
  datasheet asset-registry extension, write-validation. Backend-only; no UI yet.
RELATED: ./phase-02-rewire-write-path.md, ../PRD.md (Datasheet bookshelf)
---

# Phase 3 — Documentation commands + datasheet bookshelf

Give `ProjectGlazing`/`ProjectFrame` the same editing + datasheet capability
`ProjectMaterial` has. The UI is the sibling report-pages feature; here we build
and **API/integration-test** the backend.

## Documentation commands

Mirror the envelope `update_project_material` / `remove_project_material`
pattern (frontend dispatch in `MaterialsPanel.tsx:225-263`; backend in the
envelope command handler). Add aperture-side commands (or extend the envelope
command set if these entities are reached through it — pick the home that keeps
"project_glazings/frames are document tables" consistent with how
project_materials is wired):

- `update_project_glazing` / `update_project_frame`: patch
  `specification_status` and/or editable value fields on one entity by id.
  Shared-edit (changes all uses) — that is the model (D-6).
- `remove_project_glazing` / `remove_project_frame`: delete an **unused** entity
  (no element references it). Reject if still referenced (mirror
  `remove_project_material`’s guard).

Reuse the document-table replace/patch plumbing already used for
`project_materials`. Do **not** invent a new mutation channel.

## Datasheet bookshelf — `backend/features/assets/registry.py`

- Add `project_glazings` and `project_frames` to the datasheet
  `ATTACHMENT_FIELDS` table list (the loop at `:54-55` that builds
  `<table>.datasheet_asset_ids` configs; current tables incl.
  `project_materials` at `:34`).
- Extend `iter_rows_for_raw_tables` (`:224-233`) with branches returning
  `tables["project_glazings"]` / `tables["project_frames"]` rows.
- This makes `attach_asset` / reference-validation
  (`assets/reference_validation.py`) accept
  `table_key="project_glazings"|"project_frames"`, `field_key="datasheet_asset_ids"`
  — the exact generic flow Materials uses.

## Write-validation

If `manufacturer`/`brand` on glazing/frame should be constrained to the catalog
single-select vocabularies (per `window-frames-catalog-enums` /
`window-glass-catalog-enums`), reuse those option stores for validation on
`update_project_*`. Default: accept free text on the **project** entity (the
constraint lives on the **catalog**, not the picked project copy) unless Ed
wants parity — flag, don't block.

## Tests

- `update_project_glazing/frame` sets spec-status + fields; shared across uses.
- `remove_*` deletes an unused entity; rejects a referenced one.
- `attach_asset` to `project_glazings.datasheet_asset_ids` succeeds; reference
  validation accepts the new table keys; a dangling asset id is rejected.
- `make ci` green.

## Exit criteria

- Met. `tests/test_project_document_aperture_documentation_commands.py` covers
  update/remove commands and datasheet attachment through HTTP; `tests/test_assets_registry.py`
  covers registration/reference discovery. Touched-file `ruff check` and full
  backend `uv run pytest` passed.
