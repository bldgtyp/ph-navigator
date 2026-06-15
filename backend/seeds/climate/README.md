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

   For local dev, `make seed-climate-bundle` bootstraps the bucket from this
   directory (or `$CLIMATE_SOURCE_DIR`), like `object-store-init` does for
   attachments. It only (re)builds + uploads from a local tree when
   `CLIMATE_SOURCE_DIR` is set explicitly; otherwise an existing bundle in the
   store is reused as-is, so a plain reset keeps whatever was published (it does
   not overwrite a full bundle with the default 24-station slice). A fresh dev
   with no bundle yet bootstraps from the default slice. To refresh from the
   default slice on purpose, set `CLIMATE_SOURCE_DIR=backend/seeds/climate`.

2. **Seed (dev + prod).** `make db-seed` pulls `phius/2022` from the object
   store, seeds all stations, and pins the starter project's default climate
   source (NYC / Central Park). Seed directly with:

   ```sh
   cd backend && uv run python -m features.climate.seeding --provider phius --version 2022
   ```

With neither a local source tree nor a bundle in the object store, the climate
seed fails loudly (and the NYC default lookup cannot resolve).
