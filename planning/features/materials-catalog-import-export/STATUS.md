---
DATE: 2026-06-03
TIME: 22:45 EDT
STATUS: Phases 1 + 2 complete on
        `feat/materials-catalog-import-export`. Phase 3 (frontend
        overflow-menu wiring) is next.
AUTHOR: Claude (Opus 4.7)
SCOPE: Status ledger for Materials Catalog JSON import/export.
RELATED:
  - README.md
  - PRD.md
  - PLAN.md
  - phases/phase-01-match-key-decision.md
  - phases/phase-02-backend-import-pipeline.md
  - phases/phase-03-frontend-overflow-menu.md
  - phases/phase-04-verification-docs.md
---

# STATUS — Materials Catalog Import / Export

## Current state

- Branch: `feat/materials-catalog-import-export`.
- **Phase 1 — Match-Key Decision: Complete.** No code change.
  Schema review confirmed `catalog_materials.id` is already a
  stable, opaque, portable `rec` + 14 base62-char string
  (`backend/features/catalogs/_shared.py:new_catalog_record_id`).
  A parallel `external_id` column would have been redundant.
  PRD + PLAN + downstream phase docs swept to reference `id`.
- Phases 2–4 specs revised in lockstep with the Phase 1 decision.
- **Phase 2 — Backend Import Pipeline: Complete.** New
  `backend/features/catalogs/materials/import_export/` package
  (file_format / upgrade / coerce / tokens / pipeline / service),
  two routes (`POST /import/preview` async-streamed + `POST
  /import/commit`), 21 contract tests. `/simplify` precision
  review surfaced seven issues — all fixed before merge and
  folded back into
  `phases/phase-02-backend-import-pipeline.md` "What actually
  shipped" section: streaming 8 MB body cap (not Content-Length
  header), negative-`schema_version` → 400, ARGB alpha=0 → null,
  length caps mirroring `_CatalogMaterialFields`,
  `existing_ids: dict[str, bool]` with `matched_inactive_skip`
  warning, per-row SAVEPOINT for race-safe commit yielding a new
  `CommitResponse.skipped_conflict_ids`, and a module-load drift
  guard between `_CATEGORY_LABEL_TO_ID` and `MATERIAL_CATEGORY_IDS`.
- `make ci` from repo root: green.

## Next step

Begin Phase 3 — Frontend overflow-menu wiring. See
`phases/phase-03-frontend-overflow-menu.md`. The contract Phase
3 should target is the "Final error-code surface" + "Final
warning / error reason codes" tables at the bottom of the Phase
2 doc.

## Blockers

None.

## Verification

- [x] Phase 1: match-key decision recorded; downstream docs swept.
- [x] Phase 2: backend `preview` + `commit` endpoints with 21
      contract tests green; `/simplify` findings resolved; spec
      fold-back complete.
- [ ] Phase 3: frontend overflow-menu items and import modal wired.
- [ ] Phase 4: round-trip against seed file; MCP smoke;
      `make ci` green from repo root; docs fold-back.
