---
DATE: 2026-06-03
TIME: 22:30 EDT
STATUS: Phase 1 complete (doc-only, no code shipped). Phases 2–4
        pending on branch `feat/materials-catalog-import-export`.
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

## Next step

Begin Phase 2 — Backend import pipeline. See
`phases/phase-02-backend-import-pipeline.md`.

## Blockers

None.

## Verification

- [x] Phase 1: match-key decision recorded; downstream docs swept.
- [ ] Phase 2: backend `preview` + `commit` endpoints with tests
      green.
- [ ] Phase 3: frontend overflow-menu items and import modal wired.
- [ ] Phase 4: round-trip against seed file; MCP smoke;
      `make ci` green from repo root; docs fold-back.
