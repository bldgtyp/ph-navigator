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
**no code written yet**. Cleared to start `PLAN.md` Phase 1.

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

Detailed per-phase plans now exist under `phases/` (see README phase map). Start
with `phases/phase-00-canonical-vocab-and-cleanup.md` (freeze the option sets +
fold map — a short data spec), then execute
`phases/phase-01-catalog-option-store.md`: migration for `catalog_field_options`,
shared repository (`backend/features/catalogs/_options_repository.py`), service +
routes under frame_types, Pydantic models, and the option seed. Reuse
`SingleSelectOption` + `project_document/options.py` `validate_option_list` /
`mint_option_id` (document accessors are **not** reusable — the catalog store is
relational).

**Note discovered while planning:** the frame catalog is seeded *through the
import pipeline* (`scripts/seed_frame_catalog.py:64-78`), so the Phase 4 import
upgrade step is the data-cleanup mechanism — **no in-place row migration needed**
(no deploy/no users). See phase-00 and phase-04.

## Blockers

- None. All decisions resolved; all required primitives exist. The only net-new
  build is the catalog option store (Phase 1).

## Verification ledger

- (pending implementation)
