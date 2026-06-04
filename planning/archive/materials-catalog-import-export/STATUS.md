---
DATE: 2026-06-03
TIME: 23:30 EDT
STATUS: Implemented on branch `feat/materials-catalog-import-export`.
        All four phases complete; round-trip verified; docs
        folded back. Awaiting PR + merge.
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
- **Phase 4 — Verification + Docs: Complete.**
  - Carry-over hardening from Phase 3: `useImportMutations`
    error generic tightened to `ApiRequestError`;
    `formatApiError` gained a curated copy table + plainly-
    labeled catch-all for unmapped backend `error_code`s.
  - `research/build_materials_seed.py` converts the WUFI /
    manufacturer CSV (`research/Material Data-Grid view.csv`,
    416 rows) into `working/materials-seed.json` — 408 rows
    after the 8 rows with un-mappable categories are filtered.
  - Playwright MCP round-trip on a freshly truncated catalog:
    import → preview shows new=408 / matched=0 / errored=0 /
    warnings=0; commit lands 408 rows; export via the page's
    own list endpoint produces a file whose re-import shows
    new=0 / matched=408. Three screenshots saved under
    `assets/`.
  - Context fold-back: `context/PRD.md` §6 records that catalog
    rows are portable via JSON and the `rec_*` id is the
    durable identifier; `context/GLOSSARY.md` Database-ID
    entry extended to distinguish portable catalog ids from
    project-document local PKs.
  - `/simplify` precision review on the Phase 4 cut found
    seven issues; all fixed before close — mutation error
    generic widened to `ApiRequestError | Error` (network
    failures propagate as `TypeError`, not `ApiRequestError`);
    handleConfirm's 410 path now delegates to `formatApiError`
    so the stale-token banner copy has a single source of
    truth in `ERROR_CODE_COPY`; `formatApiError`'s catch-all
    uses `statusText` instead of the synthetic
    `Request failed: …` message to avoid doubled-status
    banners on 5xx HTML responses; the `!` on
    `ERROR_CODE_COPY.catalog_import_too_large` lookup
    replaced with `??` fallback; new vitest cases cover both
    a mapped error_code and an unmapped/null-code path so the
    catch-all shape is locked; `research/build_materials_seed.py`
    gained a module-load assertion mirroring backend
    `coerce.py`'s drift guard; `context/GLOSSARY.md` Database-ID
    wording tightened to remove the "Never user-visible"
    contradiction.
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

Open PR, get review, merge. After merge:

- Optional follow-up: Frame / Glazing catalog parity (same
  pipeline, different table — defer until there's demand).
- Optional follow-up: a productionized CSV → JSON converter
  (today the seed script lives at `research/` as a one-shot).

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
- [x] Phase 4: round-trip on 408-row seed file (Playwright MCP
      smoke + 3 screenshots), Phase 3 carry-over hardening
      shipped, `context/PRD.md` + `context/GLOSSARY.md` fold-
      back, `make ci` green.
- [ ] Phase 3: frontend overflow-menu items and import modal wired.
- [ ] Phase 4: round-trip against seed file; MCP smoke;
      `make ci` green from repo root; docs fold-back.
