---
DATE: 2026-07-20
TIME: 08:27 EDT
STATUS: Deferred
AUTHOR: Claude with Ed May
SCOPE: Router for the catalog seed-script idempotency defect (materials,
  glazings, frames).
RELATED:
  - ./PRD.md
  - ./STATUS.md
  - ../../../backend/scripts/seed_materials_catalog.py
  - ../../../backend/scripts/seed_glazing_catalog.py
  - ../../../backend/scripts/seed_frame_catalog.py
  - ../../../backend/features/catalogs/materials/import_export/pipeline.py
---

# Catalog seed idempotency

The three canonical catalog seed scripts are **not idempotent**, despite
carrying a guard that reads as though they are. Running one twice against a
populated database inserts a complete duplicate copy of the catalog.

Observed 2026-07-20 during unrelated CI work: two consecutive runs of
`make seed-materials` took a local catalog from 408 rows to 1224.

Read in this order:

1. `PRD.md` — symptom, verified root cause, blast radius, resolution options.
2. `STATUS.md` — what is mitigated today and what remains.

## One-line summary

Import matching is keyed on row **`id`**, the catalog seed files carry **no
ids**, so every seed row is always classified `new` and the scripts'
`if counts.new == 0: nothing to commit` guard can never fire.

## Not in scope

This packet does not propose changing user-facing catalog import semantics.
The export → edit → re-import round trip works correctly because exports carry
ids. See PRD option C for why natural-key matching is a product decision rather
than a bug fix.
