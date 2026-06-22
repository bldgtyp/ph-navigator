# Climate seed source data — NOT committed

This directory holds the **Phius / PHI climate source files** used to seed the
app-wide `climate_dataset` / `climate_dataset_location` tables for local dev.

**The source files are deliberately gitignored** (`*.txt`, `*.xlsx`, `*.json`).
`bldgtyp/ph-navigator-v2` is a **public** repo, and Phius/PHI climate data is
licensed reference data: BLDGTYP may *use* it in the app (it holds PHPP + WUFI
licenses) but must not *redistribute* it in a public repo. Only this README is
tracked.

## How to get the data locally

Drop the Phius `-mon.txt` tree under `USA/<STATE>/<STATION>-mon.txt` here (the
region code comes from the parent directory name). Ed keeps the canonical copy
locally. Set `CLIMATE_SOURCE_DIR` to point the pipeline at a tree elsewhere.

The **PHI/PHPP 10.6** library is a single licensed `.xlsx` workbook (the
embedded `Climate`-worksheet library), not a tree of files; Ed's gitignored
copy lives at
`planning/archive/climate/example_data/phi_phpp_10_6_climate_data/`. The process
step finds the `.xlsx` under whatever `--src` directory it is given.

## Two-stage pipeline (process → seed)

The seed no longer parses raw files at seed time. Source-of-truth is the
private object store (MinIO local / Cloudflare R2 prod); see
`planning/archive/climate-reference-data-seeding/` for the design.

1. **Process (admin, rare).** Parse a raw tree into a standardized
   `dataset.json` bundle and upload it to the object store:

   ```sh
   cd backend && uv run python -m features.climate.processing \
       --provider phius --version 2022 --src <raw -mon.txt tree> --upload
   # PHI: --provider phi --version 10.6 --src <dir containing the .xlsx>
   ```

   For local dev, `make seed-climate-bundle` bootstraps the bucket for **every**
   provider with a local source, like `object-store-init` does for attachments:
   Phius from this directory (or `$CLIMATE_SOURCE_DIR`) and PHI from `phi/` here
   (or `$CLIMATE_PHI_SOURCE_DIR`, e.g. Ed's gitignored
   `planning/archive/climate/example_data/phi_phpp_10_6_climate_data`). It only
   (re)builds + uploads from a local tree when that provider's source env is set
   explicitly; otherwise an existing bundle in the store is reused as-is, so a
   plain reset keeps whatever was published (it never overwrites a full bundle
   with a default slice). A fresh dev with no bundle bootstraps from the default
   slice when one is present — Phius is **required** (fails loudly if neither a
   source nor a bundle exists); PHI is **optional** (skipped gracefully, so the
   PHI picker shows its empty state until a dataset lands). To refresh from a
   default slice on purpose, point the source env at it
   (e.g. `CLIMATE_SOURCE_DIR=backend/seeds/climate`).

2. **Seed (dev + prod).** `make db-seed` pulls **every published** bundle from
   the object store (`seeding --all` semantics — today `phius/2022` +
   `phi/10.6`), seeds all stations, pins the starter project's default Phius
   source (NYC / Central Park), and attaches the nearest PHI station as the
   project's advisory PHI source. Seed directly with:

   ```sh
   cd backend && uv run python -m features.climate.seeding --all
   # or one release: --provider phi --version 10.6
   ```

With neither a local source tree nor a bundle in the object store, the climate
seed fails loudly (and the NYC default lookup cannot resolve).
