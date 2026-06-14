---
DATE: 2026-06-14
TIME: -
STATUS: Deferred — extends the (complete) Climate dataset store with a
  second reference provider. Independent; the seed seam is ready.
AUTHOR: Claude (for Ed)
SCOPE: Router for the PHI/PHPP reference-dataset importer
  (`provider='phi', version='10.6'`), the second app-wide climate dataset
  alongside the seeded Phius 2022 set.
RELATED:
  - PRD.md
  - STATUS.md
  - planning/archive/climate/ (the complete Climate feature this extends)
  - planning/archive/climate/phases/phase-02b-phi-phpp-importer.md
    (the original handoff this folder supersedes)
  - planning/archive/climate/phases/phase-02-reference-datasets-and-format.md
    (the store + Phius precedent)
  - backend/features/climate/importers/ (phius.py precedent; PHI lands here)
---

# Climate — PHI/PHPP reference importer

The second app-wide reference dataset: parse the PHI/PHPP 10.6 climate
library into `ClimateRecord`s and seed `provider='phi', version='10.6'`.

**Everything downstream of the parser already exists** — the storage,
the `GET /api/v1/climate/datasets…` read endpoints, the MCP tools, and the
re-runnable seed CLI are all provider-agnostic and shipped with Climate
Phase 2. Only the `.xlsx` parser is missing.

This was tracked as Climate **phase-02b** while Climate was active; it was
pulled out into its own deferred feature when Climate Phases 1–3 completed
and the feature was archived (2026-06-14).

## Read order

1. `PRD.md` — what to build, the column-recovery risk, exit criteria.
2. `STATUS.md` — gate, dependency, next step.
3. The archived precedent: `backend/features/climate/importers/phius.py`
   (the Phius `-mon.txt` importer this mirrors).

## Headline

The real workbook is on disk (gitignored) at
`planning/archive/climate/example_data/phi_phpp_10_6_climate_data/phi_phpp_10_6_climate_data.xlsx`.
It is a live PHPP `Climate` worksheet with the dataset library embedded as
~130 unlabeled, formula-driven columns × ~1000 locations — a careful,
validation-heavy reverse-engineering job, not a quick parser. That is why
it was deferred behind the Phase-3 tab.
