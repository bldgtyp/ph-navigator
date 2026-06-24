---
DATE: 2026-06-24
TIME: 16:10 EDT
STATUS: Done (2026-06-24) — seed cleaned 43→41 rows; GLAZING_TYPE_* constants added; sentinel renamed via migration 20260624_0040
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 0 — freeze the glazing option sets + fold map; clean the seed file
RELATED:
  - ../decisions.md D-1 (which fields), D-6 (the DEFAULT rows)
  - ../research.md §1 (distinct seed values), §2 (name-lossless)
  - backend/features/catalogs/_option_seeds.py (frame precedent in the same file)
  - backend/seeds/catalogs/glazing-types.v1.json (the file to clean)
---

# Phase 0 — Canonical vocab + seed cleanup

## Goal

Freeze the two canonical option sets (`manufacturer`, `brand`) and the
casing-fold map for glazing, in the same `_option_seeds.py` that holds the frame
constants; then clean `glazing-types.v1.json` so every promoted value is canonical
and the `DEFAULT` rows are resolved per D-6. This is the data foundation Phases 1
(seed), 2 (validation), and 4 (import fold) all read.

## Depends on / unblocks

- **Depends on:** nothing (D-6 resolved — drop the two `DEFAULT` rows; rename the
  sentinel `PHN-Default-Glass`).
- **Unblocks:** Phase 1 (seeds the option store from these sets), Phase 4 (folds
  legacy values using the same map).

## Work items

### 0.1 Extend `backend/features/catalogs/_option_seeds.py`

Append glazing constants alongside the existing `FRAME_TYPE_*` ones (do not touch
the frame constants). Keep all values generic / public-repo-safe.

```python
# --- Window-Glazing (window-glass-catalog-enums) --------------------------- #
# Only manufacturer + brand are promoted (D-1). `suffix` stays free text and
# feeds the composed name as a raw fragment (Phase 3).
GLAZING_TYPE_OPTION_SEEDS: Final[dict[str, list[str]]] = {
    "manufacturer": [
        "Alpen", "Internorm", "Intus", "Kawneer", "Lamilux", "Lepage",
        "Mercury", "Rehau", "smartwin", "Tishler", "Viking", "Wythe", "Zola",
    ],
    "brand": [
        # ~40 distinct glass make-up strings from the cleaned seed (research §1).
        # Enumerate the EXACT distinct brand values present after the casing fold
        # and the D-6 outcome (if DEFAULT rows are dropped, omit "1 W/m2-k" /
        # "2 W/m2-k"). Generate this list from the cleaned JSON, do not hand-type.
    ],
}

# The two promoted single-select fields (D-1).
GLAZING_TYPE_SINGLE_SELECT_FIELDS: Final[tuple[str, ...]] = ("manufacturer", "brand")

# Fold map: lower(btrim(dirty)) -> canonical, applied case-insensitively (Phase 4
# import upgrade). Casing only — glazing has no typo-class folds like frame's
# OP-TO-FIX.
GLAZING_TYPE_VALUE_FOLDS: Final[dict[str, dict[str, str]]] = {
    "manufacturer": {"intus": "Intus", "zola": "Zola"},
}

# The DEFAULT artifact rows are dropped on import (D-6) — mirrors frame's
# FRAME_TYPE_DROP_MANUFACTURERS. The single default is the PHN-Default-Glass
# sentinel (resolved by id), not a catalog manufacturer option.
GLAZING_TYPE_DROP_MANUFACTURERS: Final[frozenset[str]] = frozenset({"DEFAULT"})
```

- **Generate the `brand` list programmatically** from the cleaned seed so it
  matches exactly (`python -c` over the JSON). A `brand` label that is in the seed
  but not in the option set will fail write-validation (Phase 2) and round-trip
  (Phase 4) — the seed and the option set must agree, exactly as the frame
  module's docstring warns.
- **D-6 = drop:** the two `DEFAULT` rows are removed, so their `1 W/m2-k` /
  `2 W/m2-k` brands never appear in either set, and `DEFAULT` never enters the
  manufacturer set. No `DEFAULT`→canonical fold is needed (the rows are dropped, not
  folded) — the import upgrade drops them via the manufacturer check (Phase 4).

### 0.2 Clean `backend/seeds/catalogs/glazing-types.v1.json`

The seed is a `bldgtyp:airtable-export`, `schema_version: 1`, 43 rows. Apply:

1. **Manufacturer casing:** `INTUS` → `Intus` (10 rows), `ZOLA` → `Zola` (1 row).
2. **`DEFAULT` rows (D-6 = drop):** remove the two `manufacturer == "DEFAULT"` rows
   (43 → 41 rows). The single default is the sentinel (0.3).
3. **`name`:** leave as-is in the file — it is recomputed by the Phase 3 backfill
   migration and by the importer (Phase 4), so the stored seed name does not need
   hand-editing. (Optionally regenerate it to the canonical `manufacturer | brand
   | suffix` for tidiness; not required.)

Keep `schema_version: 1` in the file — the **importer upgrades v1 → v2** (Phase 4);
the seed stays a v1 document. (Frame kept `frame-types.v1.json` at its export
version too.)

> **Brand is left untouched** beyond the D-6 drop — the ~40 near-unique values are
> the legitimate vocabulary (D-1). Do not attempt to "tidy" glass make-up strings.

### 0.3 Rename the default-glazing sentinel → `PHN-Default-Glass` (D-6)

Ed wants the single default to read in parallel with `PHN-Default-Frame`. Because
defaults resolve by **id** (D-5), this is a display-label-only change:

- Change the **value** of `APERTURE_DEFAULT_GLAZING_NAME` (`envelope_models.py:30`)
  from `"PHN-Default-Glazing"` to `"PHN-Default-Glass"`. **Keep the constant
  name** and `APERTURE_DEFAULT_GLAZING_ID` (`recPHNDefGlazng01`) unchanged.
- Add a one-line migration (next free rev — can ride with the Phase 1 seed
  migration or stand alone): `UPDATE catalog_glazing_types SET name =
  'PHN-Default-Glass' WHERE id = 'recPHNDefGlazng01'`. (`downgrade` sets it back.)
- Update any test/fixture asserting the literal `"PHN-Default-Glazing"` and the
  `20260605_0018` seed/downgrade references if they hard-code the old label.
- `recompute_names` skips the sentinel by **id** (Phase 3), so the rename is
  unaffected by the derived-name logic.
- Code identifiers stay `*_GLAZING_*` (table `catalog_glazing_types`, feature
  `glazing_types`, `GlazingRef`) — only the human-facing label changes.

## Verification

- Script-check: every distinct `manufacturer` and `brand` value in the cleaned
  JSON appears in `GLAZING_TYPE_OPTION_SEEDS` (no EXTRA, mirroring the frame Phase 0
  cross-check). Example:
  ```
  uv run python -c "import json; from features.catalogs._option_seeds import GLAZING_TYPE_OPTION_SEEDS as S; \
  d=json.load(open('seeds/catalogs/glazing-types.v1.json')); rows=d['rows']; \
  [print('EXTRA', f, repr(r[f])) for r in rows for f in ('manufacturer','brand') if r.get(f) and r[f] not in S[f]]"
  ```
  (run from `backend/`) prints nothing.
- No `INTUS`/`ZOLA`/`DEFAULT` literals remain in the manufacturer column (unless
  D-6 = keep).

## Exit criteria

- Two `DEFAULT` rows dropped from the seed; `INTUS`/`ZOLA` folded; sentinel
  renamed `PHN-Default-Glass` (constant value + migration).
- `_option_seeds.py` has the three glazing constants; the `brand` list is generated
  from (and equals) the cleaned seed's distinct brands.
- Cross-check script is clean. `ruff`/`ty` green on the module.

## Risks / notes

- **Seed ↔ option-set agreement is load-bearing** (Phase 2 will reject a row whose
  value isn't an option). Generate, don't hand-type, the brand list.
- This is **public-repo seed data** — keep it generic; no PHI/PHPP/licensed values.
- No backfill of existing dev rows here — the dev DB reseeds from the cleaned file
  on `make db-reset-dev`; the Phase 3 migration recomputes names for any rows that
  predate it.
