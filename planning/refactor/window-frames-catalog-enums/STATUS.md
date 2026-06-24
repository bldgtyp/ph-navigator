---
DATE: 2026-06-23
TIME: 17:51 EDT
STATUS: Active
AUTHOR: Claude (Opus 4.8)
SCOPE: window-frames-catalog-enums
RELATED: ./README.md, ./research.md, ./decisions.md, ./PLAN.md
---

# STATUS — window-frames-catalog-enums

**State:** `Active` — research complete; **all decisions resolved (2026-06-23)**;
**Phases 0–3 complete (2026-06-23)** — canonical vocab + clean seed (P0); catalog
option store (P1); strict write-validation (P2); derived read-only `name` +
default-frame/glazing-by-id + option-rename name recompute (P3). All CI-green.
**Next: Phase 4** (import/export v2).

**Decisions locked:** D-1 all six strict single-select (incl. `brand`, to group
on it) · D-2 new catalog app-scoped option store, label-string storage · D-3
`name` computed server-side per the formula, read-only · D-4 inline add-option ·
D-5 default frame/glazing resolved by id · D-6 clean up seed artifacts · D-7
frame-types only, store built generic for glazing/materials reuse.

## Done

- Mapped current data shape, the seed values, and the data-quality defects that
  motivate the change (research §1).
- Confirmed NAME-as-formula is lossless and the **formula engine needs no
  change** — `IF`/`&`/AirTable-truthiness already exist (research §2).
- Identified the core tension: catalogs have **no option store**; the extensible
  machinery is project-document-only (research §3).
- Full downstream-consumer map; verified the three high-risk sites
  (default-frame lookup, import gate, drift keys) at file:line (research §4).
- Drafted phased PLAN and open DECISIONS with recommendations.

## Next step

Phases 0–3 are done. Execute `phases/phase-04-import-export-v2.md`: bump the
catalog file `schema_version` 1→2; add `_upgrade_v1_to_v2` (fold legacy/typo
values via `_option_seeds.FRAME_TYPE_VALUE_FOLDS` + the swapped-Mercury / drop-
`Default` special cases); resolve the six to known options on import (auto-add vs
flag — D-4 sub-policy still open, see phase-04 §4.3); drop `ERR_MISSING_NAME` and
compute `name` via `compose_frame_name`; wire `_validate_single_selects` into the
import commit so imports obey the same rule as create/patch. The committed seed is
already clean (P0), so this mainly serves user-supplied v1 files + the seed
re-load path.

**Note discovered while planning:** the frame catalog is seeded *through the
import pipeline* (`scripts/seed_frame_catalog.py:64-78`), so the Phase 4 import
upgrade step is the data-cleanup mechanism — **no in-place row migration needed**
(no deploy/no users). See phase-00 and phase-04.

## Blockers

- None. All decisions resolved; all required primitives exist. The only net-new
  build is the catalog option store (Phase 1).

## Verification ledger

- **Phase 0 (2026-06-23):** `_option_seeds.py` created; `frame-types.v1.json`
  cleaned (190→189 rows: −1 `Default`, 3 swapped, 1 `OP-TO-FIX` folded, 4 `source`
  cased). Cross-check script confirms every distinct seed value per field is
  canonical (no EXTRA vs `FRAME_TYPE_OPTION_SEEDS`).
- **Phase 1 (2026-06-23):** migrations `20260623_0037` (table+index) /
  `20260623_0038` (seed); `_options_repository.py`; `frame_types/options_service.py`;
  3 option models; `GET/PUT …/options` routes. `tests/test_catalog_field_options.py`
  (10 tests). Full backend suite **978 passed, 2 skipped**; single alembic head.
- **Phase 2 (2026-06-23):** `_validate_single_selects` in `frame_types/service.py`
  wired into create/patch (`catalog_option_unknown` 422); existing frame/roster
  test fixtures moved to canonical values + autouse option-reset; 4 new validation
  tests. Full backend suite **982 passed, 2 skipped**. Import path still bypasses
  validation (deferred to Phase 4).
- **Phase 3 (2026-06-23):** derived `compose_frame_name`; `name` removed from
  write models; backfill `20260623_0039`; default lookup → by id
  (`default_refs` + `APERTURE_DEFAULT_FRAME_ID`/`_GLAZING_ID`); option-rename →
  `repository.recompute_names`; drift `_FRAME_KEYS` drops `name`. 4-agent simplify
  confirmed the 3 compose implementations agree. Full backend suite **986 passed,
  2 skipped**; head `20260623_0039`.
- Phases 4–6: pending implementation.
