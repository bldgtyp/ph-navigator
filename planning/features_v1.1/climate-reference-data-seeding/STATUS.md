---
DATE: 2026-06-14
TIME: -
STATUS: Planned — ready to build. Phase 1 is independent and buildable now;
  Phase 2 is gated on `climate-phi-importer`; Phase 3 is a deploy task.
AUTHOR: Claude (for Ed)
SCOPE: Status + gate for the climate reference-data ingest + seed pipeline.
RELATED:
  - README.md
  - PRD.md
  - planning/features_v1.1/climate-phi-importer/STATUS.md
---

# Climate reference-data ingest + seed — Status

## Current state

**Planned, no code written.** The Climate Postgres store, read endpoints, MCP,
and a provider-agnostic `seed_dataset(...)` shipped (2026-06-13, archived
Climate feature). This feature adds the *supply chain*: an admin-only
process→seed pipeline sourced from the private object store, full Phius
coverage, the PHI path, and removal of licensed source data from the PUBLIC
repo.

Decisions are locked (PRD §2, with Ed 2026-06-14): Postgres runtime;
object-store source-of-truth; two-stage process→seed; standardized
`ClimateRecord` `.json`; PH-Nav-V2-only; remove committed files from HEAD
without history rewrite; on-demand idempotent prod seed.

## Live exposure to clean up (do-now, low-risk)

25 real Phius source files are tracked at HEAD in the public repo:
- `backend/seeds/climate/USA/NY/*-mon.txt` (24)
- `backend/tests/fixtures/climate/phius/USA/MA/WORCHESTER_REGIONAL_ARPT_MA-mon.txt` (1)

Per D-CS-6: `git rm` from the tree (no history rewrite), `.gitignore` guard,
synthetic replacement fixture. This can land ahead of the rest of Phase 1 —
**flagged for Ed; not executed yet** (kept out of the current unrelated
working-tree WIP).

## Gate / depends on

- **Phase 1** — independent. Needs the object-store client (exists:
  `features/assets/storage_r2.py`), the Phius parser (exists:
  `importers/phius.py`), and the operator's canonical Phius 2022 source dir
  (Ed has it locally; gitignored copy at
  `planning/archive/climate/example_data/phius_2022_climate_data/`).
- **Phase 2 (PHI)** — gated on `climate-phi-importer` (the `.xlsx` parser +
  ~130-column map validation). No other blocker; seed path is provider-
  agnostic.
- **Phase 3 (Render)** — deploy task; needs `R2_*` confirmed in Render (the
  object store already serves attachments there).

## Next step

Phase 1, in order: (1) refactor `importers/phius.py` into a pure
parse → `list[ClimateRecord]` + bundle writer; (2) object-store resolver over
`storage_r2.py`; (3) admin process CLI; (4) provider-agnostic seed-from-bundle;
(5) wire `make seed-climate-bundle` + `db-seed` to MinIO and seed all 1007;
(6) public-repo cleanup (D-CS-6). Then `make format` + `make ci`.

## Blockers

- None for Phase 1. Phase 2 waits on the PHI parser by priority, not by a hard
  blocker.
