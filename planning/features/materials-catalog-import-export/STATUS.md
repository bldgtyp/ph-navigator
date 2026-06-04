---
DATE: 2026-06-03
TIME: 22:00 EDT
STATUS: PRD locked. PLAN.md + four phase files drafted. Awaiting
        kickoff on `feat/materials-catalog-import-export`.
AUTHOR: Claude (Opus 4.7)
SCOPE: Status ledger for Materials Catalog JSON import/export.
RELATED:
  - README.md
  - PRD.md
  - PLAN.md
  - phases/phase-01-backend-external-id.md
  - phases/phase-02-backend-import-pipeline.md
  - phases/phase-03-frontend-overflow-menu.md
  - phases/phase-04-verification-docs.md
---

# STATUS — Materials Catalog Import / Export

## Current state

- Feature folder created; PRD locked.
- Decisions folded back: dedup by stable `external_id` (new column
  on `catalog_materials`); MVP conflict behavior is Skip-matches
  only; no selection-based export; include-inactive toggle governs
  export; backend owns the entire import pipeline behind a
  `preview` + `commit` endpoint pair (reusable by a future MCP /
  CLI caller); no CSV adapter.

## Next step

Draft `PLAN.md` and the phase files. Likely phasing:

1. **Phase 1 — Backend `external_id`.** Add the column +
   Alembic migration; backfill existing rows; expose it in the
   `CatalogMaterialPublic` payload; update repository/service.
2. **Phase 2 — Backend import pipeline.** File-format types, the
   upgrade chain (v1 only at first), per-row coerce/validate,
   dedup-by-`external_id`, `preview` + `commit` routes with the
   token cache, tests.
3. **Phase 3 — Frontend overflow-menu wiring.** Add Export /
   Import items to `MaterialsCatalogPage`'s
   `overflowMenuActions` slot; client-side serialize for export;
   upload modal with preview dialog driven by the backend report.
4. **Phase 4 — Verification + docs.** Round-trip test against the
   reference CSV-derived seed file; Playwright MCP smoke; doc
   fold-back into `context/`.

## Blockers

None.

## Verification

- [ ] User stories reviewed and approved.
- [ ] Open questions resolved and folded into PRD.
- [ ] `PLAN.md` + phase files drafted.
- [ ] Implementation phases executed; `make ci` green.
