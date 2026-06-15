# Local dev seed data

Single source of truth for the data that populates the local Docker
Postgres dev database. Every seed script under `backend/scripts/`
resolves its data file from here via `scripts/_seed_paths.py`.

## Layout

```
backend/seeds/
  user.json                       # default editor account
  catalogs/
    materials.v1.json             # Materials catalog (10 rows)
    glazing-types.v1.json         # Glazing Types catalog (~42 rows)
    frame-types.v1.json           # Frame Types catalog (~190 rows)
  project/
    project.json                  # starter project metadata
    assemblies.json               # 2 assemblies + referenced project materials
    apertures.json                # 1 default 1000 mm x 1000 mm aperture
    rooms.json                    # 5 rooms + floor/zone options
    thermal-bridges.json          # 5 thermal bridges + type options
    pumps.json                    # 5 pumps + device-type options
    fans.json                     # 5 fans + type options
    ventilators.json              # 5 ventilators (ERVs/HRVs) + inside/outside options
    hot-water-heaters.json        # 5 hot-water heaters + type options
    hot-water-tanks.json          # 5 hot-water tanks + type options
    electric-heaters.json         # 5 heaters
    appliances.json               # 5 appliances + type / energy-star options
    heat-pumps.json               # 5 outdoor-equip + 5 indoor-equip + 5 outdoor-units + 5 indoor-units (cross-linked)
  climate/
    README.md                     # source data is gitignored (licensed); supply locally
    USA/<ST>/*-mon.txt            # Phius station files — NOT committed (see climate/README.md)
  model/
    ph_nav_v2_example.hbjson      # small example model for the Model tab
```

`climate/` is the local home for the Phius 2022 `-mon.txt` station files, but
the source data is **gitignored and not committed** — it is licensed Phius/PHI
reference data and this is a **public** repo (see `climate/README.md` and
`planning/archive/climate-reference-data-seeding/`). Supply the files locally
under `climate/USA/<STATE>/<STATION>-mon.txt` (or set `CLIMATE_SOURCE_DIR`); the
region code comes from the parent directory name. The seed runs a two-stage
pipeline: `make seed-climate-bundle` *processes* that tree into a standardized
`dataset.json` bundle and uploads it to the object store (MinIO), then
`seed_dev_db.py` *seeds* by pulling that bundle back from the store, seeding the
app-wide `phius`/`2022` dataset and pinning NYC / Central Park as the starter
project's **default** `project_climate_source` plus a matching
`project_location`. With neither a local tree nor a bundle in the store, the
climate seed fails loudly (and the NYC default lookup cannot resolve). See
`climate/README.md` for the admin process/seed CLIs.

`model/ph_nav_v2_example.hbjson` is linked into the project's Model tab by
`scripts/seed_hbjson_model.py`. That seed rides the real asset backbone
(MinIO object store → `project_assets` → `project_hbjson_files`) and runs
the geometry-extraction job, so it needs the object store up
(`make object-store-init`).

Catalog files use the canonical import envelope
(`{kind, schema_version, exported_at, rows}`) so they round-trip
through the same preview → commit pipeline the import UI uses.

Most project-document files use a simpler shape:

```jsonc
{
  "options": { "<option_key>": [{ "id", "label", "color", "order" }, ...] },
  "rows": [/* one Row dict matching the Pydantic Row model */]
}
```

`seed_dev_db.py` validates every row through the actual Pydantic models
(`RoomRow`, `PumpRow`, etc.) before assembling the project document, so
a typo here surfaces as a clear validation error at seed time.
Pump `device_type`, Hot-water heater `type`, and Appliance `type`
options intentionally keep the WUFI category numbers embedded in their
labels; do not renumber or sort them numerically when editing the seed
lists.

`project/assemblies.json` seeds Assembly Builder directly with
`{project_materials, assemblies}` because assemblies reference
project-owned material rows by `project_material_id`. The seed script
validates those rows through `ProjectMaterial`, `Assembly`, and the full
project document validator.

`project/apertures.json` names the starter aperture row. The seed script
builds the full 1000 mm x 1000 mm aperture through the same default
aperture factory used by the UI, so it bookshelf-copies
`PHN-Default-Frame` and `PHN-Default-Glazing`.

## Reset & reseed (one command)

```sh
make db-seed
```

That runs, in order:

1. `seed-dev-data` — depends on `seed-climate-bundle` (processes the local
   `climate/` tree into a bundle in MinIO), then `scripts.seed_dev_db --reset`
   truncates every application table (except `alembic_version`), creates the
   default editor account, inserts one project whose document body is assembled
   from `project/*.json`, and seeds the `phius`/`2022` climate dataset (pulled
   from the object store) plus the project's default climate source + location.
2. `seed-materials` — `scripts.seed_materials_catalog`
3. `seed-glazing` — `scripts.seed_glazing_catalog`
4. `seed-frames` — `scripts.seed_frame_catalog`
5. `seed-hbjson` — `scripts.seed_hbjson_model` (links `model/*.hbjson`
   into the Model tab; brings up + initializes the MinIO object store).

The Postgres volume is left intact. Use `make db-reset-dev` for the
heavier reset (drop the Docker volume, re-migrate, then seed).

## Default user

```
email:    ed@example.com
password: password
```

Edit `user.json` to change defaults across every seed script.

## Adding a new seed file

1. Drop the JSON under `catalogs/` or `project/`.
2. Add a `*_SEED_PATH` constant to `backend/scripts/_seed_paths.py`.
3. Either extend `seed_dev_db.py` (project-doc tables) or add a new
   `scripts/seed_<thing>.py` that mirrors `seed_materials_catalog.py`
   (catalogs).
4. Wire the new script into `make db-seed`.
