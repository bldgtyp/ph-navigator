---
DATE: 2026-06-15
TIME: -
STATUS: Phases 1, 2, and 3 ALL COMPLETE (2026-06-15) — implemented,
  unit-tested, `make ci` green, and verified end-to-end. The full Phius
  1007-station process→seed was verified locally; the PHI 10.6 bundle (1002
  datasets, 82 countries) was published + seeded locally; and Phase 3 ran the
  publish + `seeding --all` against the deployed Render (staging) environment —
  both bundles in the `ph-navigator-v2-dev` R2 bucket and seeded into the Render
  Postgres (phius/2022 = 1007, phi/10.6 = 1002, 2009 total locations). The
  feature is shipped; no open work remains.
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

**v1.0, all three phases shipped (2026-06-15).** The Climate Postgres store,
read endpoints, MCP, and a provider-agnostic `seed_dataset(...)` shipped
(2026-06-13, archived Climate feature). Phase 1 then built the *supply chain*:
the admin-only two-stage process→seed pipeline sourced from the private object
store, plus the public-repo cleanup. Phase 2 added the second provider — the
PHI/PHPP 10.6 `.xlsx` importer — which is the only new code a provider needs
(the seed path is provider-agnostic). Phase 3 added the on-demand `seeding
--all` command + the Render runbook, and the operator publish + seed ran +
verified against the deployed Render (staging) environment (2009 locations).

**Phase 3 (Render seed path), code + runbook 2026-06-15**
(`phases/phase-03-render-seed.md`):

- `features.climate.seeding` gained an **`--all`** mode: it walks the provider
  registry and seeds each provider's default version that is published in the
  object store, reporting seeded-vs-skipped and failing loudly if nothing is
  published. So the Render seed job is **one stable command that never changes
  as providers are added** (D-CS-3): `python -m features.climate.seeding --all`.
- The deploy runbook (confirm `R2_*` in Render → publish bundles with the
  process `--upload` → run `seeding --all` as a Render one-off job / Shell
  command, on publish of a new bundle, not per deploy) lives in
  `context/ENVIRONMENT.md → "Climate reference-data seed (on-demand)"`.
- Covered by `tests/test_climate_pipeline.py` (`seed_all_*`); the `FakeR2Client`
  fake was aligned to real R2's 404 `ClientError` so `has_bundle()` is testable.
  Cleanup: the duplicated `ClimateBundleStore(R2Client(settings))` build was
  extracted to `ClimateBundleStore.from_settings()` (4 call sites). `make ci` green.
- **Operator publish + seed — DONE 2026-06-15.** Ed published both bundles to
  the `ph-navigator-v2-dev` R2 bucket and ran `seeding --all` against the Render
  Postgres; verified `phius/2022` = 1007 and `phi/10.6` = 1002 (2009 total).
  Render's managed Postgres blocks external traffic by default, so the
  local-shell run required temporarily allowlisting the operator's IP under the
  DB's Networking → Inbound IP Rules (removed afterward); a future reseed can
  run `seeding --all` from the Render Shell instead.

**Phase 2 (PHI importer), shipped 2026-06-15** (`phases/phase-02-phi-importer.md`
has the full build record + the recovered column map):

- `importers/phi.py` parses the embedded PHPP `Climate`-worksheet library
  (openpyxl); `phi` is registered as a `ClimateProvider`
  (`default_version="10.6"`, `label_prefix="PHI"`). The process CLI
  (`--provider phi`) and seed path needed no other change.
- The load-bearing column map was reverse-engineered from the 10.6 workbook and
  **validated** — decoded coordinates match real cities, and physical
  invariants (dewpoint ≤ air, sky ≤ air, global ≥ directional) hold. It yields
  **1002 datasets across 82 countries**, skipping 16 empty user-template slots.
- `tests/test_climate_phi.py` golden-tests the parse path against a synthetic
  workbook built in `tmp_path` (no licensed bytes committed). `make ci` green.
- **Bundle published + seeded + verified (2026-06-15).** Ed processed the
  licensed workbook with `--upload` (→ `climate/phi/10.6/dataset.json` in local
  MinIO) and seeded it: `phi/10.6` = 1002 locations across 82 countries,
  alongside `phius/2022` = 1007. Spot-checks match the source (Rochester
  43.12/-77.68, Birmingham 33.5/-86.92); relational country/region/lat/lon
  columns are populated. Prod (Render R2 + Postgres) is Phase 3.

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

**Operational note — `seed-climate-bundle` no longer clobbers (Phase-1.1 fix,
2026-06-15):** `seed-climate-bundle` only rebuilds + uploads from a local tree
when `CLIMATE_SOURCE_DIR` is set **explicitly**. Without it, an existing bundle
in MinIO is **reused as-is**, so a plain `make db-seed` / `make db-reset-dev`
keeps whatever was published (e.g. the full 1007-station set) instead of
overwriting it with the default 24-station NY slice at `backend/seeds/climate/`.
A fresh dev with no bundle yet still bootstraps from that default slice, so there
is always something to seed. Practical flow: publish the full set once with
`CLIMATE_SOURCE_DIR=<full tree>` (on Ed's machine the gitignored copy is at
`planning/archive/climate/example_data/phius_2022_climate_data`); later resets
reuse it with no env var. To deliberately refresh from the default slice, set
`CLIMATE_SOURCE_DIR=backend/seeds/climate`.

> Phase-1.1 (the former "default-clobbers-full" sharp edge) — **DONE 2026-06-15.**
> Fixed in `ensure_bundle` (`scripts/seed_climate_bundle.py`): the overwrite is
> gated on an explicit `CLIMATE_SOURCE_DIR`. Covered by
> `tests/test_seed_climate_bundle.py`.

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
- **Phase 2 (PHI)** — importer DONE (2026-06-15); `phases/phase-02-phi-importer.md`.
  The load-bearing ~130-column workbook map is reverse-engineered, validated,
  and documented; `importers/phi.py` + the `_PROVIDERS` entry + unit tests are
  in, and the bundle is published to local MinIO + seeded + verified. Prod
  (Render) seed is Phase 3.
- **Phase 3 (Render)** — COMPLETE (2026-06-15). The `--all` seed command + the
  Render runbook in `context/ENVIRONMENT.md` shipped, and the operator publish +
  seed ran against the deployed Render (staging) environment: both `phius/2022`
  and `phi/10.6` bundles in the `ph-navigator-v2-dev` R2 bucket, seeded into the
  Render Postgres (2009 locations) and read back through the app repository.

## Next step

### Manual work (operator — Ed) — DONE 2026-06-15

The full 1007-station run was completed on Ed's machine and verified
(`make seed-climate-bundle` → 1007 uploaded; `make db-seed` → 1007 locations
seeded, NYC default resolved). To (re)publish the full set from the local tree,
export `CLIMATE_SOURCE_DIR` once; afterwards a plain `make db-seed` reuses the
published bundle (the Phase-1.1 fix — no env var needed on later resets):

```sh
export CLIMATE_SOURCE_DIR="…/planning/archive/climate/example_data/phius_2022_climate_data"
make object-store-init      # bootstrap MinIO bucket (idempotent)
make db-seed                # builds + uploads the 1007 bundle, then reseeds the dev DB
```

### Manual work (operator — Ed) — Phase 2 PHI bundle — DONE 2026-06-15

Done on Ed's machine and verified. Reproduce a local publish + reseed with
(the CLIs need the local MinIO creds in-env because `backend/.env` leaves the
`R2_*` values blank for the make recipes to inject):

```sh
make object-store-init                         # bring MinIO up + ensure the bucket (idempotent)
export R2_ENDPOINT_URL=http://localhost:9000
export R2_ACCESS_KEY_ID=phn_minio
export R2_SECRET_ACCESS_KEY=phn_minio_local_only
export R2_BUCKET=ph-navigator-v2-dev
cd backend
uv run python -m features.climate.processing \
    --provider phi --version 10.6 \
    --src ../planning/archive/climate/example_data/phi_phpp_10_6_climate_data \
    --upload                                   # → climate/phi/10.6/dataset.json (1002 datasets)
uv run python -m features.climate.seeding --provider phi --version 10.6
```

Idempotent per `(provider, version)`; re-running is safe. Verified seed:
`phi/10.6` = 1002 locations / 82 countries, spot-checks match the source.

### Manual work (operator — Ed) — Phase 3 Render seed — DONE 2026-06-15

Completed against the deployed Render (staging) environment, which reads the
`ph-navigator-v2-dev` R2 bucket. Full runbook: `context/ENVIRONMENT.md →
"Climate reference-data seed (on-demand)"`. What ran:

1. Exported the real Cloudflare R2 creds for `ph-navigator-v2-dev`; verified
   connectivity.
2. Published both bundles: `processing --provider phius --version 2022 …
   --upload` (1007) and `--provider phi --version 10.6 … --upload` (1002).
3. Temporarily allowlisted the operator's IP under the DB's Networking →
   Inbound IP Rules (Render blocks external Postgres traffic by default), then
   ran `seeding --all` with `DATABASE_URL` pointed at the Render external URL →
   `phi 10.6 — 1002 locations`, `phius 2022 — 1007 locations`. Verified 2009
   total via the app repository; IP rule removed afterward.

A future reseed can skip the IP allowlist by running `seeding --all` from the
Render Shell (internal DB URL, env already set).

## Blockers

- None. The feature is shipped: Phases 1–3 complete, `make ci` green, and the
  full library (2009 locations) is seeded + verified in the deployed Render
  (staging) environment.
