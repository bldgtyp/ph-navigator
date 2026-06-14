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
locally; the eventual workflow pulls a standardized bundle from the private
object store (MinIO local / Cloudflare R2 prod).

See `planning/features/climate-reference-data-seeding/` for the two-stage
process→seed pipeline and the object-store source-of-truth design.

`backend/scripts/seed_dev_db.py` walks this directory through
`features.climate.importers.phius` to seed the `phius`/`2022` dataset and pin
the starter project's default climate source (NYC / Central Park). With this
directory empty, `make db-seed` cannot seed climate until you supply the files
or the object-store seeding lands.
