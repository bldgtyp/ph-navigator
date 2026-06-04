---
DATE: 2026-06-03
TIME: 22:30 EDT
STATUS: Complete (doc-only). No code changes shipped; the existing
        `catalog_materials.id` already satisfies the requirements
        a parallel `external_id` would have provided.
AUTHOR: Claude (Opus 4.7)
SCOPE: Resolve the import match-key question and record the
        decision so downstream phases reference a single
        identifier.
RELATED:
  - ../PRD.md
  - ../PLAN.md
  - ../../../../backend/features/catalogs/_shared.py
  - ../../../../backend/features/catalogs/materials/models.py
  - ../../../../backend/alembic/versions/20260514_0007_catalog_materials.py
---

# Phase 1 — Match-Key Decision (no-op)

## Outcome

The import pipeline keys off the existing `catalog_materials.id`
column. **No schema change.** No new column, no migration, no
backfill.

## Why

The original PRD proposed a new `external_id` column on
`catalog_materials`. On closer review of the existing schema, that
column would have been redundant:

- `catalog_materials.id` is already declared `sa.Text() not null`
  (initial migration
  `20260514_0007_catalog_materials.py:28`) — not a
  database-internal UUID.
- The value is minted server-side at insert time by
  `new_catalog_record_id()`
  (`backend/features/catalogs/_shared.py:39-42`) as
  `rec` + 14 base62 characters — the AirTable record-ID shape kept
  on purpose so V1 / AirTable imports drop in unmodified.
- That format is opaque, immutable after insert, and the keyspace
  (62¹⁴ ≈ 1.2 × 10²⁵) makes cross-database collisions effectively
  impossible. Renames don't change it.

Adding a second identifier (`external_id`) parallel to `id` would
have created an ambiguity ("which one is canonical?") with no
behavioral payoff. The import pipeline (Phase 2) treats `id` as
the dedup match key directly.

## Scope changes folded back

- **PRD.md** — file-format example uses `id`; the "match key" and
  "Resolved Decisions §1" sections rewritten to point at `id`; the
  acceptance round-trip phrased against `id`.
- **PLAN.md** — sequencing rationale, phase map, and the
  `external_id` backfill risk removed.
- **Phase 2 / Phase 3 / Phase 4 docs** — `external_id` references
  swept to `id`.

## Work performed

Doc revisions only:

1. PRD field exclusion list rewritten.
2. PRD match-key section rewritten with a "malformed `id` is
   errored" rule (so the importer never invents a valid id from a
   bad one).
3. PLAN sequencing + risks updated.
4. Phase 2 spec swept (file format, coerce rules, dedup section,
   tests).
5. Phase 3 spec swept (export key order, types, tests).
6. Phase 4 spec swept (seed-file script emits no `id`, round-trip
   assertion uses `id`).

## What this phase does NOT include

- No backend code changes. The existing `id` field already flows
  through `CatalogMaterialPublic` (`models.py:59`) and `MaterialRow`
  on the frontend — both phases that consume it (Phase 2 backend,
  Phase 3 frontend) can reach for it without prep work here.

## Verification

- `make ci` from repo root remained green throughout (no code
  touched — only docs in `planning/`).
- Downstream phase docs reference `id` consistently; a
  `grep -r "external_id" planning/features/materials-catalog-import-export/`
  returns only historical context (this file's "Why" section).
