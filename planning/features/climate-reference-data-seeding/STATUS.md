---
DATE: 2026-06-15
TIME: -
STATUS: Phase 1 COMPLETE (2026-06-15) — implemented, unit-tested, `make ci`
  green, and the full 1007-station process→seed verified locally end-to-end.
  Phase 2 (PHI, `phases/phase-02-phi-importer.md`) and Phase 3 (Render,
  `phases/phase-03-render-seed.md`) are not started.
AUTHOR: Claude (for Ed)
SCOPE: Status + gate for the climate reference-data ingest + seed pipeline.
RELATED:
  - README.md
  - PRD.md
  - phases/phase-01-phius-objectstore-pipeline.md
  - phases/phase-02-phi-importer.md
---

# Climate reference-data ingest + seed — Status

## Current state

**v1.0, Phase 1 complete (2026-06-15).** The Climate Postgres store, read
endpoints, MCP, and a provider-agnostic `seed_dataset(...)` shipped
(2026-06-13, archived Climate feature). Phase 1 then built the *supply chain*:
the admin-only two-stage process→seed pipeline sourced from the private object
store, plus the public-repo cleanup. Phase 2 (PHI) and Phase 3 (Render) are
still open.

What shipped in Phase 1 (`backend/features/climate/`):

- `bundle.py` — the standardized `ClimateBundle` envelope (D-CS-4): the one
  artifact the seed step consumes.
- `object_store.py` — `ClimateBundleStore` over the shared `AssetStorage`
  (R2/MinIO); key layout `climate/<provider>/<version>/dataset.json`.
- `importers/__init__.py` — a `ClimateProvider` registry; `importers/phius.py`
  is now a pure parser (the parse↔seed coupling was removed).
- `processing.py` — admin **process** CLI (`python -m features.climate.processing`):
  parse → bundle → write/upload. Not wired to any route (D-CS-3).
- `seeding.py` — provider-agnostic **seed** CLI
  (`python -m features.climate.seeding`): bundle (object store | file) →
  `seed_dataset`. Replaces the deleted `importers/__main__` parse-on-seed CLI.
- `scripts/seed_climate_bundle.py` + `make seed-climate-bundle` — dev bootstrap
  that pushes the operator's local Phius tree into MinIO; `make db-seed` /
  `seed_dev_db.py` now pull the bundle from the object store.
- Tests: `tests/test_climate_pipeline.py` (bundle round-trip, object-store
  resolver, seed-from-bundle idempotency, no-licensed-data guard).

Verified 2026-06-15: unit suite green; `make ci` green; and the **full
1007-station** process→seed run end-to-end on Ed's machine —
`make seed-climate-bundle` uploaded 1007 stations to MinIO and `make db-seed`
seeded 1007 locations with NYC / Central Park resolving as the starter
project's default source. Phase 1 is fully closed.

**Operational note (non-obvious — get this right):** `seed-climate-bundle`
rebuilds + uploads the bundle from a local source tree whenever one is present,
and the *default* tree is the 24-station NY slice kept on disk at
`backend/seeds/climate/`. Because `make db-seed` / `make db-reset-dev` run
`seed-climate-bundle` as a dependency, a plain run (no `CLIMATE_SOURCE_DIR`)
rebuilds the bundle from those 24 files and seeds **only 24** — overwriting any
1007-station bundle already in MinIO. So to seed the full set you must export
`CLIMATE_SOURCE_DIR` on **every** full reseed — on Ed's machine the gitignored
copy is at `planning/archive/climate/example_data/phius_2022_climate_data`. (The
"reuse the bundle already in MinIO" branch only triggers when *no* local source
exists at all — e.g. a dev who never had the NY slice.)

> Possible Phase-1.1 follow-up: this default-clobbers-full wrinkle is a sharp
> edge. Options if it bites: make `seed-climate-bundle` not a hard `db-seed`
> dependency (reuse whatever bundle is in MinIO), or default `CLIMATE_SOURCE_DIR`
> to the full archive tree. Deferred — not blocking.

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

**Resolved 2026-06-15:** the object-store dev-seeding swap landed, so
`make db-seed` now pulls the bundle from MinIO instead of needing committed
source. The operator pushes the bundle once via `make seed-climate-bundle`
(from their local tree); resets thereafter reseed climate without re-supplying
the raw files.

## Gate / depends on

- **Phase 1 (object-store process→seed)** — DONE + verified (2026-06-15). Built
  on the object-store client (`features/assets/storage_r2.py` + `AssetStorage`)
  and the Phius parser (`importers/phius.py`); the full 1007-station seed ran
  end-to-end on Ed's machine from the gitignored canonical tree at
  `planning/archive/climate/example_data/phius_2022_climate_data/`.
- **Phase 2 (PHI)** — `phases/phase-02-phi-importer.md`. Gated by priority, not
  a hard blocker; the seed path is provider-agnostic and the registry seam is
  in place (add `importers/phi.py` + one `_PROVIDERS` entry). Load-bearing risk
  is the ~130-column workbook map.
- **Phase 3 (Render)** — deploy task; needs `R2_*` confirmed in Render (the
  object store already serves attachments there).

## Next step

### Manual work (operator — Ed) — DONE 2026-06-15

The full 1007-station run was completed on Ed's machine and verified
(`make seed-climate-bundle` → 1007 uploaded; `make db-seed` → 1007 locations
seeded, NYC default resolved). Reproduce a full local reseed with (note the
required env var — see the operational note in "Current state"):

```sh
export CLIMATE_SOURCE_DIR="…/planning/archive/climate/example_data/phius_2022_climate_data"
make object-store-init      # bootstrap MinIO bucket (idempotent)
make db-seed                # rebuilds the 1007 bundle + reseeds the dev DB
```

### Next dev step — Phase 2 (PHI), `phases/phase-02-phi-importer.md`

The registry seam is ready, so this is the planned shape:

1. Add `backend/features/climate/importers/phi.py` with
   `iter_phi_records(root) -> Iterator[ClimateRecord]` (the load-bearing
   ~130-column `.xlsx` workbook map — the real risk; see the phase doc).
2. Register it: one `ClimateProvider` entry in `importers/__init__.py`
   (`label_prefix="PHI"`, `default_version="10.6"`, `parse_tree=iter_phi_records`).
3. Publish `climate/phi/10.6/dataset.json` via the existing process CLI
   (`python -m features.climate.processing --provider phi --version 10.6 --src
   <xlsx tree> --upload`). **No seed-side changes** — the seed path is already
   provider-agnostic.

### Later — Phase 3 (Render), `phases/phase-03-render-seed.md`

Wire the on-demand prod seed job: confirm `R2_*` in Render, then run
`python -m features.climate.seeding --provider <p> --version <v>` against R2 +
the Render Postgres on publish of a new bundle (not per deploy).

## Blockers

- None for Phase 1 (implemented). Phase 2 waits on the PHI parser by priority,
  not by a hard blocker.
