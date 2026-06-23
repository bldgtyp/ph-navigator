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
**Phases 0–1 complete (2026-06-23)** — canonical vocab frozen + seed cleaned
(P0); catalog option store (table, repo, service, routes, models, seed, 10
tests) landed and CI-green (P1). **Next: Phase 2** (strict write-validation).

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

Phases 0–1 are done. Execute `phases/phase-02-write-validation.md`: add
`_validate_single_selects` (reads the option store) and wire it into
`create_frame_type` / `update_frame_type`; reject unknown values with
`catalog_option_unknown` (422). **Heads-up:** the existing
`test_catalogs_frame_types.py` payloads use non-canonical values
(`manufacturer="Skyline"`, `brand="Ridge"`) — Phase 2 must switch them to
canonical option labels (or add the options) or strict validation will fail
them. Phase 4 will call the same `_validate_single_selects` after the import
upgrade resolves labels.

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
- Phases 2–6: pending implementation.
