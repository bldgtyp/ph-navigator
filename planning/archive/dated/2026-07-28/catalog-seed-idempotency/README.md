---
DATE: 2026-07-28
TIME: 11:24 EDT
STATUS: Complete — verified 2026-07-28
AUTHOR: Claude with Ed May
SCOPE: Router for the catalog seed-script idempotency defect (materials,
  glazings, frames).
RELATED:
  - ./PRD.md
  - ./PLAN.md
  - ./STATUS.md
  - ../../../../../backend/scripts/seed_materials_catalog.py
  - ../../../../../backend/scripts/seed_glazing_catalog.py
  - ../../../../../backend/scripts/seed_frame_catalog.py
  - ../../../../../backend/features/catalogs/materials/import_export/pipeline.py
---

# Catalog seed idempotency

Before this refactor, the three canonical catalog seed scripts were **not
idempotent**, despite carrying a guard that read as though they were. Running
one twice against a populated database inserted a complete duplicate copy.

Observed 2026-07-20 during unrelated CI work: two consecutive runs of
`make seed-materials` took a local catalog from 408 rows to 1224.
Resolved 2026-07-28 with deterministic ids in all three seed files.

Read in this order:

1. `PRD.md` — symptom, verified root cause, blast radius, resolution options.
2. `PLAN.md` — completed implementation plan (option A: stable ids in the seed
   files) plus honest no-op handling.
3. `STATUS.md` — final implementation and verification evidence.

## One-line summary

Import matching is keyed on row **`id`**. Every canonical seed row now carries a
derived id, so a second preview classifies all `408 / 189 / 41` rows as matched
and inserts nothing.

## Not in scope

This packet does not propose changing user-facing catalog import semantics.
The export → edit → re-import round trip works correctly because exports carry
ids. See PRD option C for why natural-key matching is a product decision rather
than a bug fix.
