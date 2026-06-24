---
DATE: 2026-06-14
TIME: -
STATUS: COMPLETE (2026-06-15) — `importers/phi.py` written, the column map
  reverse-engineered + validated against the 10.6 workbook, unit-tested, and
  `make ci` green; the real bundle was published to local MinIO, seeded, and
  verified end-to-end (1002 datasets across 82 countries, alongside Phius's
  1007). Render seeding shipped as Phase 3 (COMPLETE 2026-06-15). Migrated here from the
  former standalone `planning/features_v1.1/climate-phi-importer/` feature, which
  Ed folded into this pipeline (2026-06-14): the PHI importer is just the
  **process** step for `provider='phi'`.
AUTHOR: Claude (for Ed)
SCOPE: The PHI/PHPP 10.6 process step — parse the PHPP `Climate` worksheet into
  standardized `ClimateRecord` `.json`, then reuse the Phase-1 bundle + object-
  store + seed path unchanged.
RELATED:
  - ../PRD.md (§2 decisions, §4 scope — Phase 2)
  - ../README.md
  - backend/features/climate/importers/phius.py (the parser this mirrors)
  - PHX/PHX/PHPP/sheet_io/io_climate.py (reads the ACTIVE climate only — not the library)
  - planning/archive/climate/phases/phase-02b-phi-phpp-importer.md (original handoff)
---

# Phase 2 — PHI/PHPP 10.6 process step

Parse the PHI/PHPP 10.6 climate library into standardized `ClimateRecord`s and
publish `provider='phi', version='10.6'` as the second app-wide reference
dataset alongside Phius 2022.

**Only the parser is new.** Everything downstream — the `.json` bundle writer,
the object-store upload/download, and the provider-agnostic seed path — is built
in Phase 1 (D-CS-3/D-CS-4). The PHI parser is just another **process** input:
`.xlsx → list[ClimateRecord] → bundle → object store → seed`.

## Done — 2026-06-15

`backend/features/climate/importers/phi.py` parses the embedded PHPP `Climate`
library; `phi` is registered as a `ClimateProvider`
(`default_version="10.6"`, `label_prefix="PHI"`, `parse_tree=iter_phi_records`),
so the process CLI (`--provider phi`) and the provider-agnostic seed path
required **no other changes** (altitude confirmed in `/simplify`). Covered by
`backend/tests/test_climate_phi.py` (synthetic-workbook golden built in
`tmp_path` — no licensed bytes committed).

**Recovered column map (validated, documented in `phi.py`'s docstring).** The
library lives in the `Climate` worksheet, rows 243+, one dataset per row where
column `K` ("anzeigen?") is `"x"` — which excludes the `aktuell:`
active-selection echo and the import placeholders. Per row: `I` = PHPP picker
key → `station_id`; `N`/`O`/`P` = country/region/name; `S`/`T`/`U`/`V` =
lat/lon/elevation/summer-swing; eight consecutive 12-month series from column
`W` (air, N/E/S/W/global radiation, dewpoint, sky); then four peak/design
conditions (`DO…DT`, `DU…DZ` heating; `EA…EG`, `EH…EN` cooling, the cooling
pair carrying a trailing dewpoint). Trailing MIN/MAX/wind/PER columns are PHPP
bookkeeping and ignored.

**Validation (the load-bearing risk — closed).** Decoded coordinates match the
real cities (Birmingham AL → 33.5°N/-86.92°, Rochester NY → 43.12°N/-77.68°);
all rows satisfy dewpoint ≤ air, sky ≤ air, and global ≥ directional radiation
in summer. The parser yields **1002 datasets across 82 countries** (US 152, CA
89, FR 64, …); it skips 16 empty `ud---NN` user-template slots, defaults absent
sky/dewpoint series to zeros (27/24 rows), and zero-fills the design conditions
the source leaves blank (42 rows lack heating design). Source quirks (a few
datasets repeat December from November in dewpoint/sky, marginally pushing
dewpoint above air) are imported verbatim, not "corrected". The honeybee_ph
bridge round-trips losslessly.

**Operator publish — DONE 2026-06-15.** The real bundle was processed with
`--upload` (→ `climate/phi/10.6/dataset.json` in local MinIO) and seeded;
verified `phi/10.6` = 1002 locations / 82 countries with spot-checks matching
the source (Rochester 43.12/-77.68, Birmingham 33.5/-86.92). The exact local
recipe (incl. the in-env `R2_*` creds the CLIs need) is in
`../STATUS.md → Manual work`. Prod (Render) seeding is Phase 3.

## Why this is the hard part (investigated 2026-06-13)

The PHI sample is **not** a clean per-location table. It is a live PHPP
`Climate` worksheet (~1474 rows × 166 cols):

- The dataset library is **embedded** as **~130 unlabeled, formula-driven
  columns** per location (lat/long/alt + eight 12-month series + the
  peak/design columns), interleaved with the single active-climate display
  block (cols C–U) and the cascading-dropdown helper lists (cols AA–AZ).
- `PHX/PHX/PHPP/sheet_io/io_climate.py` does **not** help: it reads only the
  *single active* climate via named ranges (`get_start_rows` is a `TODO` stub).
  There is no existing reader for the embedded library.

A mis-mapped column silently seeds wrong climate for ~1000 locations — so
recovering the column semantics carries real correctness risk. This is the only
load-bearing risk in the phase.

## Scope

1. **Add the dependency.** `uv add openpyxl` (runtime; reads `.xlsx`).
2. **Recover the library column map** by anchoring to ground truth:
   - Read the active climate's known monthly arrays from the left display block
     (the `Temperature outdoor` / `North` / … rows).
   - Find the library row whose values match; from it, identify which 12-column
     run is which series (temp / N / E / S / W / global / dewpoint / sky) and
     which columns hold lat / long / altitude / the peak-load design columns.
   - **Validate on ≥3 independently spot-checked datasets**, not just one.
     Document the recovered map in `importers/phi.py` (the load-bearing risk).
3. **Write `importers/phi.py`** mirroring `importers/phius.py`:
   `parse_phi_workbook(path) -> Iterable[ClimateRecord]`. Centralize the
   column→field mapping in a table (like `phius._SERIES_FIELDS`) so a PPP
   version bump is a one-place edit. **No seed code** — it emits
   `ClimateRecord`s into the Phase-1 bundle writer.
4. **Country/region.** PHPP codes are multi-country (`DE-Germany`, `US-…`); map
   to `ClimatePhppCodes` + the summary `country`/`region` so search works across
   countries (unlike the US-only Phius set).
5. **Wire the process CLI.** Add `phi` to the `--provider` choices + dispatch in
   the Phase-1 process CLI. The seed path already accepts any standardized
   bundle.

## Tests

- Parse a small committed **synthetic / trimmed** fixture workbook → exact
  monthly values for a known dataset (golden); honeybee_ph round-trip stays
  lossless; bundle round-trip; route/MCP parity confirms PHI rows surface.
  (Do **not** commit a real PHPP workbook — licensed; see D-CS-6. Use a
  fabricated minimal `.xlsx` fixture.)
- `make ci` green; hand spot-check a few seeded records before trusting the
  bulk seed.

## Exit criteria

- `provider='phi', version='10.6'` processes to a standardized `.json` bundle,
  uploads to the object store, and seeds into Postgres; queryable by
  country/region + nearest; version-tagged; counts sanity-checked against the
  workbook (~1000+ datasets); the standardized record round-trips.
- The column map is validated against ≥3 spot-checked datasets and documented
  in `importers/phi.py`. `make ci` green.
