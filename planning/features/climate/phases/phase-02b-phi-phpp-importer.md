---
DATE: 2026-06-13
TIME: -
STATUS: Deferred (Ed 2026-06-13 — behind the Phase-3 tab). Investigated:
  the workbook is on disk and parseable in principle, but it is a
  ~130-column reverse-engineering job, not a quick parser. Extends Phase 2
  (reference-dataset store); plugs into the existing provider-agnostic
  `seed_dataset(...)` + `--provider` CLI seam.
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff — the PHI/PHPP reference-dataset importer
  (`provider='phi', version='10.6'`), the second app-wide climate dataset
  alongside Phius 2022.
RELATED:
  - phase-02-reference-datasets-and-format.md (the store + Phius precedent)
  - ../PRD.md §4 (data model), ../decisions.md (D-CL-8, D-CL-10)
  - backend/features/climate/importers/ (phius.py precedent; PHI lands here)
  - PHX/PHX/PHPP/sheet_io/io_climate.py (reads the ACTIVE climate only)
---

# Climate Phase 2b — PHI/PHPP reference importer (deferred)

The second app-wide reference dataset: parse the PHI/PHPP 10.6 climate
library into `ClimateRecord`s and seed `provider='phi', version='10.6'`.
Everything downstream of the parser already exists — the storage,
read endpoints, MCP tools, and the seed CLI are provider-agnostic. Only
the parser is missing.

## Why deferred (investigated 2026-06-13)

The real workbook is on disk
(`planning/features/climate/example_data/phi_phpp_10_6_climate_data/phi_phpp_10_6_climate_data.xlsx`,
gitignored). Inspection showed it is **not** a clean per-location table:

- It is a live **PHPP `Climate` worksheet** (sheets `Sheet1` + `Climate`;
  the `Climate` sheet is 1474 rows × 166 columns).
- The dataset library is **embedded** in that worksheet — the per-dataset
  monthly data is present (a wide numeric block, ~cols S–EF, ~1000+
  populated rows ≈ the datasets) but as **~130 unlabeled, formula-driven
  columns** per location (lat/long/alt + eight 12-month series + the
  peak/design columns), interleaved with the single active-climate display
  block (cols C–U) and the cascading-dropdown helper lists (cols AA–AZ).
- `PHX/PHX/PHPP/sheet_io/io_climate.py` does **not** help: it reads only
  the *single active* climate via named ranges (`get_start_rows` is a
  `TODO` stub). There is no existing reader for the embedded library.

So recovering the column semantics is careful reverse-engineering with
real correctness risk (a mis-mapped column silently seeds wrong climate
data for ~1000 locations). It is a full, validation-heavy session — out of
scope while the Phase-3 tab is the focus.

## Scope (when promoted)

1. **Add the dependency.** `uv add openpyxl` (runtime; the importer reads
   `.xlsx`). It is not yet a backend dep.
2. **Recover the library column map** by anchoring to ground truth:
   - Read the active climate's known monthly arrays from the left display
     block (the `Temperature outdoor` / `North` / … series rows).
   - Find the library row whose values match, and from it identify which
     12-column run is which series (temp / N / E / S / W / global /
     dewpoint / sky) and which columns hold lat / long / altitude / the
     peak-load design columns. Verify the mapping on several spot-checked
     datasets, not just one.
3. **Write `importers/phi.py`** mirroring `importers/phius.py`:
   `parse_phi_workbook(path) -> Iterable[ClimateRecord]` +
   `seed_phi_dataset(path, version='10.6', replace=True)`. Centralize the
   column→field mapping in a table (like `phius._SERIES_FIELDS`) so a PPP
   version bump is a one-place edit.
4. **Wire the CLI.** Add `phi` to the `--provider` choices and the
   `_seed` dispatch in `importers/__main__.py` (the seam is ready).
5. **Country/region.** PHPP codes are multi-country (`DE-Germany`,
   `US-…`); map to the `ClimatePhppCodes` / summary `country`/`region`
   columns so search works across countries (unlike the US-only Phius set).

## Tests

- **pytest:** parse a small committed fixture workbook (or a trimmed copy
  of the real one) → exact monthly values for a known PHPP dataset
  (golden); seed count assertion; the honeybee_ph round-trip stays
  lossless; route/MCP parity (already covered generically — confirm PHI
  rows surface).
- **`make ci`** green; spot-check a few seeded records against the
  workbook by hand before trusting the bulk seed.

## Exit criteria

- `provider='phi', version='10.6'` seeded, queryable by country/region +
  nearest, version-tagged; counts sanity-checked against the workbook
  (~1000+ datasets); the standardized record round-trips; `make ci` green.
- The column map is validated against ≥3 independently spot-checked
  datasets and documented in `importers/phi.py` (the load-bearing risk).
