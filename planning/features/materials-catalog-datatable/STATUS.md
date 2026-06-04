---
DATE: 2026-06-04
TIME: 00:55 EDT
STATUS: Ready for review on `feat/materials-catalog-datatable`. All
        four phases complete; Phase 4 follow-ups resolved before
        marking the PR ready.
AUTHOR: Claude (Opus 4.7)
SCOPE: Status ledger for the Materials Catalog DataTable migration.
RELATED:
  - README.md
  - PRD.md
  - PLAN.md
---

# STATUS — Materials Catalog DataTable

## Current state

- Branch: `feat/materials-catalog-datatable`.
- Planning packet committed (`200dcbf`).
- **Phases 1 + 2 (backend) merged into one commit** (`763b7d5`):
  destructive Alembic; CatalogOrigin nullable version slots;
  ProjectMaterial reshape; envelope drift collapsed to field-value
  comparison; `data-model.md` §7.2 / §7.4 folded.
- **Phase 3 (frontend) landed** (`1c7d17d`): shared `<DataTable>`
  replaces the hand-rolled table + modal; built-in nine-field FieldDefs
  with locks + fixed `numberUnits` for density / specific_heat /
  conductivity; twelve-option Category single_select; REST→WriteOp
  `useMaterialsCatalogController`; specific_heat added to the
  `NUMBER_UNIT_TYPES` registry; ProjectMaterial / CatalogOrigin / drift
  type reshape across envelope + tests;
  `frontend-viewer-units.md` §11.5.5 fold-back.
- **Phase 4 verification + follow-ups complete**:
  - Initial Playwright MCP smoke surfaced four gaps. Two turned out
    to be smoke-methodology artifacts (synthetic clicks not firing
    React's synthetic events) once seven new controller unit tests
    (`frontend/src/features/catalogs/materials/__tests__/controller.test.tsx`)
    proved cell / paste / fill / rowInsert / rowDelete all translate
    to the right REST calls. Two were real wiring gaps and got
    fixed:
    - `MaterialsCatalogPage` now passes `buildEmptyRow` so
      Shift-Enter on an empty grid POSTs a placeholder row the user
      can edit in place (controller's `buildCreatePayload` fills
      `name: "New material"` / `category: "insulation"` when the
      grid hands over empty `fieldDefaults`).
    - `WorkspaceTopbar` now hosts `<TopbarUnitToggle>`, so the
      SI/IP toggle is visible on every authenticated page (Dashboard,
      ProjectShell, all three catalog managers). Fold-back in
      `UI_UX.md` §2 and `frontend-viewer-units.md` §11.5.2.
  - `make ci` from repo root: green (1010 frontend tests, 440 + 1
    skipped backend tests).

## Next step

Mark PR #6 ready for review.

## Blockers

None.

## Verification

- [x] PRD documents the nine-field contract and category options.
- [x] PRD documents drift comparator changes.
- [x] Backend implementation landed; `uv run pytest` green.
- [x] Frontend implementation landed.
- [x] `make ci` from repo root green (final).
- [x] Context doc fold-back: `data-model.md`,
      `frontend-viewer-units.md`, `UI_UX.md`.
- [x] Playwright MCP smoke captured; both real gaps closed; two
      false positives explained by controller unit tests.
- [x] PR opened (#6, currently draft pending the ready flip).
