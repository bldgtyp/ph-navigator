---
DATE: 2026-06-14
TIME: -
STATUS: Planned (Phase 2) — gated only by priority; the seed/bundle/object-store
  seams from Phase 1 are what it plugs into. Migrated here from the former
  standalone `planning/features_v1.1/climate-phi-importer/` feature, which Ed
  folded into this pipeline (2026-06-14): the PHI importer is just the
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
