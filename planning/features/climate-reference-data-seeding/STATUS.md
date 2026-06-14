---
DATE: 2026-06-14
TIME: -
STATUS: Planned (v1.0). Phase 1 partially started (public-repo cleanup
  executed); the object-store process→seed pipeline is the next build. Phase 2
  (PHI) is `phases/phase-02-phi-importer.md`; Phase 3 is a deploy task.
AUTHOR: Claude (for Ed)
SCOPE: Status + gate for the climate reference-data ingest + seed pipeline.
RELATED:
  - README.md
  - PRD.md
  - phases/phase-02-phi-importer.md
---

# Climate reference-data ingest + seed — Status

## Current state

**v1.0, in progress.** The Climate Postgres store, read endpoints, MCP, and a
provider-agnostic `seed_dataset(...)` shipped (2026-06-13, archived Climate
feature). This feature adds the *supply chain*: an admin-only process→seed
pipeline sourced from the private object store, full Phius coverage, the PHI
path, and removal of licensed source data from the PUBLIC repo. The former
`climate-phi-importer` candidate was folded in as Phase 2 (Ed, 2026-06-14).

Decisions are locked (PRD §2): Postgres runtime; object-store source-of-truth;
two-stage process→seed; standardized `ClimateRecord` `.json`; PH-Nav-V2-only;
remove committed files from HEAD without history rewrite; on-demand idempotent
prod seed.

## Public-repo cleanup (D-CS-6) — DONE 2026-06-14

The 25 real Phius files tracked at HEAD have been dealt with:

- **24 NY seed files** (`backend/seeds/climate/USA/NY/*-mon.txt`) —
  `git rm --cached` (untracked, **kept on disk** so local `make db-seed` still
  works) + `.gitignore` guard on `backend/seeds/climate/` data files. No test
  reads these (`test_seed_dev_db.py` only covers the pure
  `_starter_project_document`), so CI stays green.
- **1 MA test fixture** — replaced with a committed **synthetic** station
  (`tests/fixtures/climate/phius/USA/ZZ/PHN_SYNTHETIC_TEST_STATION_ZZ-mon.txt`,
  fabricated round numbers); `test_climate_datasets.py` golden assertions
  updated to match. The real `WORCHESTER_REGIONAL_ARPT_MA` fixture is removed.
- `backend/seeds/climate/README.md` + `backend/seeds/README.md` updated to say
  the data is not committed and (eventually) comes from the object store.

**Still open in Phase 1:** a fresh clone has no local climate data, so
`make db-seed` cannot seed climate until the object-store dev-seeding swap
below lands. Ed's machine is unaffected (files kept on disk).

## Gate / depends on

- **Phase 1 (object-store process→seed)** — independent. Needs the object-store
  client (exists: `features/assets/storage_r2.py`), the Phius parser (exists:
  `importers/phius.py`), and the operator's canonical Phius 2022 source dir (Ed
  has it locally; gitignored copy at
  `planning/archive/climate/example_data/phius_2022_climate_data/`).
- **Phase 2 (PHI)** — `phases/phase-02-phi-importer.md`. Gated by priority, not
  a hard blocker; the seed path is provider-agnostic. Load-bearing risk is the
  ~130-column workbook map.
- **Phase 3 (Render)** — deploy task; needs `R2_*` confirmed in Render (the
  object store already serves attachments there).

## Next step

Phase 1, in order: (1) refactor `importers/phius.py` into a pure
parse → `list[ClimateRecord]` + a `.json` bundle writer; (2) object-store
resolver over `storage_r2.py`; (3) admin process CLI; (4) provider-agnostic
seed-from-bundle; (5) wire `make seed-climate-bundle` + `db-seed` to pull from
MinIO and seed all 1007 (closes the fresh-clone gap above). Then
`make format` + `make ci`.

## Blockers

- None for Phase 1. Phase 2 waits on the PHI parser by priority, not by a hard
  blocker.
