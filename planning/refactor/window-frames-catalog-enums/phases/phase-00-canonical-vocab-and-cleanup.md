---
DATE: 2026-06-23
TIME: 18:25 EDT
STATUS: Complete (2026-06-23) — spec frozen in code; seed cleaned and verified
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 0 — freeze the canonical option vocabularies + the seed cleanup mapping
RELATED:
  - ../research.md §1 (distinct seed values), §2 (name formula)
  - ../decisions.md D-1, D-6
  - ./phase-01-catalog-option-store.md (seeds these lists)
  - ./phase-04-import-export-v2.md (folds dirty values into these lists)
---

# Phase 0 — Canonical vocabularies + cleanup mapping (no app code)

## Goal

Produce the single source of truth for (a) the **canonical option set** of each of
the six single-select fields and (b) the **fold mapping** from every dirty seed
value to its canonical option. Phases 1 and 4 both import these tables verbatim,
so getting them right and frozen here removes ambiguity from every later phase.

## Why this is a phase, not a footnote

The decisions (D-1…D-7) are resolved, but the *values* are not yet pinned in a
form code can copy. Two independent consumers need the exact same lists:

- **Phase 1** seeds the option store with these as the initial dropdown lists.
- **Phase 4** folds legacy/typo seed values into these on import.

If the two drift, validation (Phase 2) will reject seed rows. Freeze once here.

## Key mechanical fact that shapes the whole refactor

The frame catalog is **seeded through the import pipeline**, not by migration or
direct SQL: `backend/scripts/seed_frame_catalog.py:64-78` runs
`preview_import → commit_import` over `backend/seeds/catalogs/frame-types.v1.json`.
Consequences:

- The Phase 4 import **upgrade step is the cleanup mechanism** — folding
  `OP-TO-FIX → OP-to-FX` etc. in the upgrade chain cleans the seed rows on the
  next `seed_frame_catalog.py` run, with **no in-place row-rewrite migration**
  (no deploy, no users — project CLAUDE.md Status).
- Seed rows pass through `coerce.py` (the `ERR_MISSING_NAME` gate) and
  `upgrade.py`. So Phase 3 (derived name) + Phase 4 (compute-on-import) make the
  seed file's `name` field advisory.

## Deliverable A — canonical option sets (from research §1, cleaned)

Low-cardinality controlled vocabularies (curated; rarely extended):

| field | options (label · order) |
|---|---|
| `use` | Door, Window, Lift & Slide, Curtain Wall, Skylight, Sidelite |
| `operation` | Inswing, Outswing, Casement, Fixed, Tilt-Turn, Sliding, Double-Hung |
| `location` | Head, Jamb, Sill, Mull-V, Mull-H, Any |
| `mull_type` | OP-to-OP, OP-to-FX, FX-to-FX |

High-cardinality, supplier-specific (D-1: strict single-select with frictionless
inline add via D-4; `Default`/`Mercury*` artifacts removed):

| field | options |
|---|---|
| `manufacturer` | Alpen, Curries, Internorm, Intus, Kawneer, Lamilux, Mercury, Rehau, smartwin, Tishler, Viking, Wythe, Zola |
| `brand` | Tyrol, Zenith, Mercury, HF510 - Home Pure, HS330, Supera, 1600 UT CW Alu PP, 1600 UT CW FG PP, FE, Artevo, compact, entrance, sliding, Sipo Mahogany, Innova, SW14, SW17, PremiSlide, Stuyvesant, ThermoPlus Clad II, SDH, Thermo Wood, ThermoPlus Clad III |

Notes:
- `mull_type` and most supplier fields are **nullable** — null is valid and is
  dropped from the composed name (Phase 3). Do not seed a "(none)" option.
- `material`, `prefix`, `suffix` stay **free text** — they are *not* among the
  six and are not promoted (they feed the name as code fragments).
- `brand` drops the spurious `CURRIES` value (it was the swapped-row artifact —
  see Deliverable B); `Mercury` survives as a brand.

## Deliverable B — fold mapping (dirty seed value → canonical)

| field | dirty value (seed cite) | canonical |
|---|---|---|
| `mull_type` | `OP-TO-FIX` (`frame-types.v1.json:2808`) | `OP-to-FX` |
| `manufacturer`/`brand` | row `Mercury \| CURRIES` (`:1340`) — fields transposed | set `manufacturer = Curries`, `brand = Mercury` (matches the correct `Curries \| Mercury` row at `:352`) |
| `source` | `manufacturer` lowercase (`:3216`) | `Manufacturer` (title-case; `source` is not one of the six — fold casing only) |
| `manufacturer` | `Default` artifact row | **remove the row** — distinct from the `PHN-Default-Frame` sentinel (`recPHNDefFrame001`); D-5 makes that sentinel the real default, so `Default` must not survive as an option |

Apply folds **case-insensitively on trimmed input** (so `tilt-turn `, `Tilt-Turn`
both map to `Tilt-Turn`). The fold table is the only place casing/typo knowledge
lives; everything downstream sees canonical labels.

## Deliverable C — where these live in code (handoff to Phase 1/4)

- **Canonical sets** → a module-level constant the Phase 1 seed migration reads
  (proposed `backend/features/catalogs/_option_seeds.py`,
  `FRAME_TYPE_OPTION_SEEDS: dict[str, list[str]]`). Public-repo-safe generic
  reference data only (per `project_public_repo_licensed_data` memory).
- **Fold map** → a constant consumed by the Phase 4 upgrade step
  (proposed `FRAME_TYPE_VALUE_FOLDS: dict[str, dict[str, str]]`, keyed
  `field → lower(trimmed) → canonical`), plus the swapped-row and `Default`-row
  special cases handled explicitly in the upgrade function.
- **Seed JSON** → additionally hand-fix `frame-types.v1.json` so the committed
  reference file is itself clean (remove the `Default` row, fix the transposed
  Mercury row, fold `OP-TO-FIX`). The upgrade step is still the load-bearing
  guard for *user* imports; the file fix keeps the public artifact honest.

## Out of scope

- No glazing/materials option work (D-7 — frame-types only this refactor).
- No app code — this phase only freezes the spec.

## Exit criteria

- Deliverables A and B reviewed against the live seed (re-derive distinct values
  with `jq` over `frame-types.v1.json` and diff against the tables above; resolve
  any new value found).
- No PHI/PHPP/licensed values in either list (public-repo gate).
- Ed confirms the `manufacturer`/`brand` option sets are acceptable to manage
  (D-1 flagged the ~13/~24 cardinality as a conscious choice).

## Verification

```bash
# distinct values actually present in the seed, per field:
cd backend && for f in use operation location mull_type manufacturer brand; do
  echo "== $f =="; jq -r "[.rows[].$f] | map(select(. != null)) | unique[]" seeds/catalogs/frame-types.v1.json
done
```

Diff the output against Deliverable A; every value must either appear as a
canonical option or have a Deliverable B fold. Unmapped value ⇒ spec is
incomplete, fix before Phase 1.

## Completion (2026-06-23)

- **Spec frozen in code:** `backend/features/catalogs/_option_seeds.py` —
  `FRAME_TYPE_OPTION_SEEDS` (Deliverable A), `FRAME_TYPE_VALUE_FOLDS` +
  `FRAME_TYPE_SWAPPED_MANUFACTURER_BRAND` + `FRAME_TYPE_DROP_MANUFACTURERS`
  (Deliverable B), and `FRAME_TYPE_SINGLE_SELECT_FIELDS`. Phases 1 (seed) and 4
  (import upgrade) consume these verbatim.
- **Seed cleaned:** `backend/seeds/catalogs/frame-types.v1.json` — dropped 1
  `Default` row, swapped 3 `Mercury | CURRIES` rows → `Curries | Mercury`, folded
  1 `OP-TO-FIX` → `OP-to-FX`, title-cased 4 lowercase `source` values, and
  recomposed `name` on the 4 rows whose parts changed. 190 → 189 rows.
- **Verified:** every distinct seed value per field is now canonical (no EXTRA
  values vs `FRAME_TYPE_OPTION_SEEDS`); `manufacturer` seed=12 ⊂ canon=13
  (`Mercury` is a curated option not used as a manufacturer in any row — fine).
- **Public-repo gate:** option lists are generic manufacturer/brand/use vocab —
  no PHI/PHPP/licensed values.
- **Note on D-1 sign-off:** the ~13/~24 cardinality is the resolved decision
  (D-1 locked per STATUS.md); not re-litigated here.
