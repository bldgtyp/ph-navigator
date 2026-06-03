---
DATE: 2026-06-03
TIME: 23:30 EDT
STATUS: Implemented on branch — backend (phases 1 + 2) merged into a
        single commit on `feat/materials-catalog-datatable`. Frontend
        phase 3 has not started.
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
- Planning packet drafted and committed (`200dcbf`).
- **Phases 1 + 2 merged into one backend commit.** Reason: the Alembic
  migration drops `current_version_id` / `catalog_material_versions`,
  which breaks the envelope pick + drift code at runtime. The two
  phases had to land together to keep the backend green and `make ci`
  passable. PRD scope is unchanged; only the commit boundary moved.
- Backend tests: 440 passed, 1 skipped (full repo suite). ruff + ty
  clean.
- `context/technical-requirements/data-model.md` updated with a §7.2
  callout describing the flat materials shape, a §7.4 note that
  materials drift is field-only, and a JSON example showing
  `catalog_version_id: null` on material origins.

## Next step

Begin **Phase 3 — Frontend DataTable**. See
`phases/phase-03-frontend-datatable.md`.

## Blockers

None.

## Verification (planning packet)

- [x] PRD documents the nine-field contract and category options.
- [x] PRD documents drift comparator changes.
- [x] Backend implementation landed; `uv run pytest` green.
- [x] Context doc fold-back complete for the backend contract changes.
- [ ] Frontend implementation begun.
- [ ] `make ci` from repo root run for the final closeout.
- [ ] Playwright MCP smoke captured.
