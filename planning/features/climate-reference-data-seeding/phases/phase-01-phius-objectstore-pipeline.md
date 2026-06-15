---
DATE: 2026-06-15
TIME: -
STATUS: COMPLETE (2026-06-15). All six work items below are done; `make ci` is
  green and the full 1007-station process→seed was verified locally from the
  licensed tree. See ../STATUS.md for what shipped + the CLIMATE_SOURCE_DIR
  operational note.
AUTHOR: Claude (for Ed)
SCOPE: The two-stage process→seed pipeline over the private object store, the
  full Phius 2022 seed, the dev reset/reseed wiring, and the public-repo
  cleanup. This is the load-bearing phase; Phase 2 (PHI) and Phase 3 (Render)
  build on the seams it creates.
RELATED:
  - ../PRD.md (§2 decisions, §4 scope — Phase 1; §3 standardized format)
  - ../README.md, ../STATUS.md
  - phase-02-phi-importer.md (the PHI process step, reuses these seams)
  - backend/features/climate/importers/phius.py (the parser to refactor)
  - backend/features/climate/service.py (seed_dataset, SeedResult)
  - backend/features/climate/record.py (ClimateRecord — the .json shape)
  - backend/features/assets/storage_r2.py (the object-store client to reuse)
  - backend/scripts/seed_dev_db.py, backend/scripts/_seed_paths.py
  - backend/seeds/README.md, backend/seeds/climate/README.md
  - Makefile (db-seed, db-reset-dev, object-store-up/init)
---

# Phase 1 — Phius process→seed over the object store

Stand up the supply chain decided in the PRD: an admin-only **process** step
that normalizes source files into a standardized `.json` bundle in the private
object store, and a provider-agnostic **seed** step that loads only that bundle
into Postgres. Land the full Phius 2022 set (1007 stations) through it and wire
the dev reset/reseed to pull from the object store.

```
 RAW .txt  ──process(admin)──▶  climate/phius/2022/dataset.json  ──seed──▶  Postgres
 (operator)                     (object store: MinIO / R2)                  (climate_dataset*)
```

## Work (in order)

> **DONE 2026-06-15.** Implemented as `backend/features/climate/{bundle,object_store,
> processing,seeding}.py` + a `ClimateProvider` registry in `importers/__init__.py`,
> with the dev bootstrap `scripts/seed_climate_bundle.py` + `make seed-climate-bundle`.
> The seed CLI is `python -m features.climate.seeding` (the old `importers/__main__`
> parse-on-seed CLI was deleted). Steps below kept for the build record.

1. **Refactor `importers/phius.py` into a pure process step.** Split the
   current parse-and-seed (`seed_phius_dataset(root)` reads `.txt` *and* writes
   the DB) into a pure `parse → list[ClimateRecord]` (no DB) plus a bundle
   writer (`records → the D-CS-4 envelope .json`). Keep a thin convenience
   wrapper for local one-shot use.
2. **Object-store source resolver.** A helper over
   `features/assets/storage_r2.py` that, given `(provider, version)`,
   uploads/downloads the bundle (and optional raw archive). Local → MinIO,
   prod → R2, same code + the existing `R2_*` settings.
3. **Process CLI (admin-only).**
   `python -m features.climate.processing --provider phius --version 2022
   --src <raw .txt tree> --out climate/phius/2022/dataset.json [--upload]` —
   parse → validate → write the bundle → optionally push to the object store.
   Not wired to any API route (backend-admin only, per D-CS-3).
4. **Seed-from-bundle (provider-agnostic).** Generalize the seed entry point to
   read a standardized `.json` bundle from `{object-store | local path}` →
   `ClimateRecord.model_validate` each → `service.seed_dataset(...)`. Keep the
   `--no-replace` idempotency. This replaces the parse-on-seed path (the parser
   has moved to step 3).
5. **Dev reset/reseed wiring.** Add `make seed-climate-bundle` to push the
   operator's local Phius bundle into MinIO once (MinIO starts empty — same
   bootstrap role as `object-store-init`); document the env var for the local
   source dir. Point `seed_dev_db.py` / `make db-seed` / `make db-reset-dev` at
   the object-store bundle, seed all 1007, and keep pinning NYC / Central Park
   as the starter project's default `project_climate_source` +
   `project_location`. **Closes the fresh-clone gap** below.
6. **Public-repo cleanup (D-CS-6).** *(partially done 2026-06-14)*
   - DONE: untrack the 24 Phius NY `-mon.txt` files (`git rm --cached`, kept on
     disk) + `.gitignore` guard on `backend/seeds/climate/`; replace the real
     MA test fixture with the synthetic `USA/ZZ/PHN_SYNTHETIC_TEST_STATION_ZZ`
     station and update `test_climate_datasets.py` goldens; document in the two
     seed READMEs.
   - REMAINING: nothing further here — the durable fix is steps 1–5 (the dev
     seed no longer needs committed source files).

## Known gap — RESOLVED 2026-06-15

Step 5 landed: `make db-seed` now pulls the bundle from the object store, so a
reset reseeds climate automatically once `make seed-climate-bundle` has pushed
it to MinIO. The remaining inherent constraint (licensed data) is unchanged: a
machine with neither a local source tree nor a bundle already in the store
fails loudly — the operator supplies the source once, and resets thereafter
work from MinIO without re-supplying the raw files.

## Tests

- **Process:** `parse → ClimateRecord` golden values for the synthetic station
  (already pinned in `test_climate_datasets.py`); bundle writer round-trips
  (`records → .json → records` equal); D-CS-4 envelope shape asserted.
- **Object-store resolver:** upload → download → parse a tiny fixture bundle
  through MinIO (a couple of stations), not the full set.
- **Seed-from-bundle:** seed a MinIO fixture bundle → assert row count + a
  golden station's monthly values; `--no-replace` is a no-op; `replace=True`
  rebuilds (reuses the existing idempotency tests).
- **Guard:** structural-guard test asserting no real climate source files are
  tracked under `backend/seeds/climate/` / `tests/fixtures/climate/`.
- `make ci` green (no schema change — no migration).

## Exit criteria

- Full Phius 2022 (1007) processes to a standardized `.json` bundle, uploads to
  the object store, and seeds into Postgres in local dev; `make db-seed` /
  `make db-reset-dev` bring climate back automatically from MinIO (fresh-clone
  gap closed).
- Admin-only **process** CLI + provider-agnostic **seed-from-bundle** path
  exist and are documented; a `make` recipe publishes a bundle to the object
  store.
- No PHI/Phius source bytes tracked at HEAD; `.gitignore` guard in place;
  synthetic test fixture; seed READMEs updated. `make ci` green.
