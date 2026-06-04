---
DATE: 2026-06-03
TIME: 23:55 EDT
STATUS: Implemented on branch — backend (phases 1 + 2) and frontend
        (phase 3) landed on `feat/materials-catalog-datatable`. Phase 4
        (Playwright MCP smoke + final closeout) outstanding.
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
- **Phase 3 (frontend) landed**: shared `<DataTable>` replaces the
  hand-rolled table + modal; built-in nine-field FieldDefs with locks +
  fixed `numberUnits` for density / specific_heat / conductivity;
  twelve-option Category single_select; REST→WriteOp
  `useMaterialsCatalogController`; specific_heat added to the
  `NUMBER_UNIT_TYPES` registry; ProjectMaterial / CatalogOrigin /
  drift type reshape across envelope + tests;
  `frontend-viewer-units.md` §11.5.5 fold-back.
- `make ci` from repo root: green (1003 tests, frontend build OK).

## Next step

Phase 4 — verification + final docs closeout. See
`phases/phase-04-verification-docs.md`. Open the PR once Playwright MCP
smoke captures.

## Blockers

None.

## Verification

- [x] PRD documents the nine-field contract and category options.
- [x] PRD documents drift comparator changes.
- [x] Backend implementation landed; `uv run pytest` green.
- [x] Frontend implementation landed.
- [x] `make ci` from repo root green.
- [x] Context doc fold-back: `data-model.md`,
      `frontend-viewer-units.md`.
- [ ] Playwright MCP smoke captured (Phase 4).
- [ ] PR opened.
