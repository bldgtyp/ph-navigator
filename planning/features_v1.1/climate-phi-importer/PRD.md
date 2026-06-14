---
DATE: 2026-06-14
TIME: -
STATUS: Deferred — implementation handoff (carried over from Climate
  phase-02b, unchanged in substance).
AUTHOR: Claude (for Ed)
SCOPE: The PHI/PHPP 10.6 reference-dataset importer + seed.
RELATED:
  - README.md
  - STATUS.md
  - planning/archive/climate/phases/phase-02b-phi-phpp-importer.md
  - planning/archive/climate/PRD.md §4 (data model)
  - planning/archive/climate/decisions.md (D-CL-8, D-CL-10)
  - PHX/PHX/PHPP/sheet_io/io_climate.py (reads the ACTIVE climate only)
---

# PHI/PHPP reference importer — PRD

Parse the PHI/PHPP 10.6 climate library into the standardized
`ClimateRecord` and seed it as the second app-wide reference dataset
(`provider='phi', version='10.6'`). The storage / read / MCP / CLI layers
are provider-agnostic and already shipped; this feature is only the parser
+ its column-map validation.

## Why it was deferred (investigated 2026-06-13)

Inspection of the real workbook showed it is **not** a clean per-location
table:

- It is a live PHPP `Climate` worksheet (sheets `Sheet1` + `Climate`; the
  `Climate` sheet is 1474 rows × 166 columns).
- The dataset library is **embedded** in that worksheet — the per-dataset
  monthly data is present (a wide numeric block, ~cols S–EF, ~1000+
  populated rows ≈ the datasets) but as **~130 unlabeled, formula-driven
  columns** per location (lat/long/alt + eight 12-month series + the
  peak/design columns), interleaved with the single active-climate display
  block (cols C–U) and the cascading-dropdown helper lists (cols AA–AZ).
- `PHX/PHX/PHPP/sheet_io/io_climate.py` does **not** help: it reads only
  the *single active* climate via named ranges (`get_start_rows` is a
  `TODO` stub). There is no existing reader for the embedded library.

A mis-mapped column silently seeds wrong climate data for ~1000 locations,
so recovering the column semantics carries real correctness risk.

## Scope (when promoted)

1. **Add the dependency.** `uv add openpyxl` (runtime; reads `.xlsx`). Not
   yet a backend dep.
2. **Recover the library column map** by anchoring to ground truth:
   - Read the active climate's known monthly arrays from the left display
     block (the `Temperature outdoor` / `North` / … series rows).
   - Find the library row whose values match, and from it identify which
     12-column run is which series (temp / N / E / S / W / global /
     dewpoint / sky) and which columns hold lat / long / altitude / the
     peak-load design columns. Verify on several spot-checked datasets, not
     just one.
3. **Write `importers/phi.py`** mirroring `importers/phius.py`:
   `parse_phi_workbook(path) -> Iterable[ClimateRecord]` +
   `seed_phi_dataset(path, version='10.6', replace=True)`. Centralize the
   column→field mapping in a table (like `phius._SERIES_FIELDS`) so a PPP
   version bump is a one-place edit.
4. **Wire the CLI.** Add `phi` to the `--provider` choices + the `_seed`
   dispatch in `importers/__main__.py` (the seam is ready).
5. **Country/region.** PHPP codes are multi-country (`DE-Germany`, `US-…`);
   map to `ClimatePhppCodes` / the summary `country`/`region` columns so
   search works across countries (unlike the US-only Phius set).

## Tests

- **pytest:** parse a small committed fixture workbook (or a trimmed copy of
  the real one) → exact monthly values for a known PHPP dataset (golden);
  seed-count assertion; honeybee_ph round-trip stays lossless; route/MCP
  parity (confirm PHI rows surface).
- **`make ci`** green; hand spot-check a few seeded records before trusting
  the bulk seed.

## Exit criteria

- `provider='phi', version='10.6'` seeded, queryable by country/region +
  nearest, version-tagged; counts sanity-checked against the workbook
  (~1000+ datasets); the standardized record round-trips; `make ci` green.
- The column map is validated against ≥3 independently spot-checked datasets
  and documented in `importers/phi.py` (the load-bearing risk).
