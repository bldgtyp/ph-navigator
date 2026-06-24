---
DATE: 2026-06-24
TIME: 17:30 EDT
STATUS: Planned
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 1 — v11→v12 document migration (inline refs → flat tables + FK),
  seeds/templates, golden-corpus test. Co-lands with Phase 0.
RELATED: ./phase-00-models-and-tables.md, ../decisions.md (D-7)
---

# Phase 1 — Document migration v11 → v12

Hoist existing inline `glazing` / `frames.{side}` refs into the new flat tables
and rewrite elements to FK. Mechanism: a Pydantic `@model_validator(mode="before")`
upgrader, mirroring `_migrate_legacy_manufacturer_filters`
(`backend/features/project_document/document.py:278`).

## The upgrader

Add a `mode="before"` validator on the document (or `ProjectDocumentTables`)
model that runs when the raw dict still carries the legacy shape (detect: any
aperture element has a dict-valued `glazing` or a dict-valued `frames.{side}`,
or `schema_version < 12`). It must:

1. Initialise `project_glazings: []` and `project_frames: []` if absent.
2. Walk `tables.apertures[].elements[]`. For each inline glazing/frame ref:
   - Dedup by `(catalog_table, catalog_record_id)` for catalog refs; append a
     new entity for hand-entered (D-2 Option A). Reuse the same dedup logic as
     `ensure_project_*` (factor a pure helper both call).
   - Build a `ProjectGlazing`/`ProjectFrame` from the ref fields (drop
     `datasheet_url`; default `specification_status="missing"`,
     `datasheet_asset_ids=[]`; carry `catalog_origin` verbatim).
   - Replace `element.glazing` with `element.glazing_id = <pglz_id>` (or `None`
     if the inline ref was null); replace each `frames.{side}` ref with the
     `<pfrm_id>` (or `None`).
3. Stamp `schema_version = 12`.

Idempotent: a v12 doc (ids already FK, flat tables populated) passes through
untouched. On any failure the standard safe-mode read fallback applies
(`store.py:255-277`) — the doc reads raw, editing disabled.

## Seeds + templates

- `backend/features/project_document/templates.py` — `empty_project_document`:
  ensure the new tables default to `[]` (the model default covers it; confirm
  the template doesn't hand-build a stale `tables` dict).
- `backend/scripts/seed_dev_db.py`, `seed_hbjson_model.py`,
  `seed_agent_browser_fixture.py` — any script that builds apertures via
  `factories.build_default_aperture_type` is auto-correct once Phase 2 rewires
  the factory; until then, regenerate fixtures so the seeded dev project is v12.
- Any captured-JSON test fixtures with inline aperture refs: either let the
  upgrader migrate them on load, or regenerate.

## Golden-corpus test

Add `backend/.../tests` covering: a representative **v11** apertures document
(default frame on 4 sides + a picked catalog glazing + a hand-entered frame +
a second aperture reusing the same catalog frame) migrates to a v12 document
where:

- `project_frames` has exactly one row for the default frame (shared across all
  4 sides and both apertures), one for the hand-entered frame.
- `project_glazings` has one row for the picked glazing.
- Every element's `glazing_id` / frame-slot ids resolve.
- Re-validating the migrated doc is a no-op (idempotency).

## Exit criteria

- Golden-corpus migration test green; idempotency test green.
- Fresh `make db-seed` produces a v12 dev project; the aperture builder renders
  unchanged (manual sanity, full smoke deferred to the report-pages feature).
- Full backend suite green; `ruff` + `ty` clean.
