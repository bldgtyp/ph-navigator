---
DATE: 2026-06-03
TIME: 23:00 EDT
STATUS: Phases 1 + 2 + 3 complete on
        `feat/materials-catalog-import-export`. Phase 4
        (verification + docs fold-back) is next.
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
- **Phase 3 — Frontend Overflow Menu: Complete.** New
  `frontend/src/features/catalogs/materials/import_export/`
  package (types, api, useImportMutations, ImportDialog,
  OverflowMenuItems, export). `MaterialsCatalogPage` mounts the
  Export/Import items into `<DataTable overflowMenuActions>` and
  conditionally renders `ImportDialog`. 12 new vitest tests.
  `/simplify` precision review found six issues; four fixed
  before merge (conditional-mount teardown, double-click
  disable, per-pick request-id guard, `EMPTY_MATERIALS` constant
  for memo stability); two deferred to Phase 4 hardening
  (mutation generic error typing, `formatApiError` catch-all
  copy). `make ci` green from repo root.
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

Begin Phase 4 — Verification + docs. See
`phases/phase-04-verification-docs.md`. Two carry-over items
from Phase 3's deferred list should land in Phase 4: tighten
`useImportMutations` error generics to `ApiRequestError`, and
extend `formatApiError` with a catch-all mapping pass.

## Blockers

None.

## Verification

- [x] Phase 1: match-key decision recorded; downstream docs swept.
- [x] Phase 2: backend `preview` + `commit` endpoints with 21
      contract tests green; `/simplify` findings resolved; spec
      fold-back complete.
- [x] Phase 3: frontend overflow-menu items, import modal state
      machine, 12 vitest tests; `/simplify` 4 findings fixed +
      2 deferred to Phase 4; spec fold-back complete.
- [ ] Phase 3: frontend overflow-menu items and import modal wired.
- [ ] Phase 4: round-trip against seed file; MCP smoke;
      `make ci` green from repo root; docs fold-back.
