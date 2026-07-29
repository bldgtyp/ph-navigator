---
DATE: 2026-07-28
TIME: 22:52 EDT
STATUS: Ready after Phase 0 — the field work (Part A) could even start in
  parallel with the probe; the seed (Part B) needs Phase 0's roster
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Phase 1 — the µ/sd material fields end-to-end, then the
  `iso10456-vapor-mu` seed through the licensed-data pipeline (its Phase 4).
RELATED: ../PRD.md §4, ../decisions.md §D-4/§D-7/§D-15a,
  planning/features/licensed-data-pipeline/phases/phase-04-mu-dataset-dry-run.md,
  planning/archive/dated/2026-07-26/assembly-membrane-layers/ (the worked
  example: `air_permeance_l_s_m2_at_75pa`)
---

# Phase 1 — Material vapour fields + the µ seed

## Goal

Materials can carry `vapor_diffusion_resistance_mu` (µ, ≥ 1) and
`vapor_sd_equivalent_m` (sd [m], ≥ 0) everywhere a material lives — catalog,
project document, drift, editors, IP/SI — and the ISO 10456 values reach a
local database through the licensed-data pipeline's `db_seed` path. No
calculation yet.

**The map is the shipped `air_permeance_l_s_m2_at_75pa` precedent** — one
nullable material field threaded end-to-end. Diff that field's landing commit
and walk the same files.

## Prerequisites

- Phase 0's roster and the §D-12 composite-stud call (Part B only).
- Licensed-data pipeline Phases 1–2 (implemented 2026-07-28; Phase 3's
  production cutover is **not** required for the local drill).

## Work

### Part A — the fields, end-to-end (this repo)

1. **Document model** (`backend/features/project_document/envelope_models.py`):
   both fields on `ProjectMaterial` as `float | None = None` with constraints
   (µ ≥ 1, sd ≥ 0, `allow_inf_nan=False`) — additive amendment, **no
   `schema_version` bump** (the air-permeance precedent, PRD §4.2).
   Regenerate the table fingerprint and corpus snapshot. E-1: vapour-tight is
   `sd ≥ 1500 m`, never ∞ — document on the field.
2. **Catalog** — Alembic migration: two nullable `double precision` columns on
   `catalog_materials`; thread through `backend/features/catalogs/materials/`
   (models, repository, service, `import_export/` incl. `coerce.py` and
   `file_format.py`).
3. **Drift/refresh** — add both keys to `PROJECT_MATERIAL_CATALOG_FIELDS` /
   `ProjectMaterialDriftFieldKey` (`envelope/drift.py`,
   `envelope/material_fields.py`, `envelope/commands/materials.py`,
   `project_document/tables/contracts.py`); the existing drift, override, and
   take-catalog/keep-mine machinery then covers them.
4. **Frontend** — a "Vapour" field group in the catalog editor
   (`catalogs/materials/fieldDefs.ts`) and the project material editor
   (`envelope/components/ProjectMaterialEditor.tsx`), plus `MaterialDrift.tsx`,
   `SegmentMaterialFacts.tsx`, and `types.ts`. **IP presentation**: perms
   (↔ sd, `sd ≈ 3.496 / perms`) and perm·in (↔ µ, `µ ≈ 137.6 / perm·in`) —
   accept IP input and convert; storage is SI-canonical (`research.md` §6).
5. **Explicit non-changes** (guarded by tests): `thermal_input_hash`
   unchanged; HBJSON and PHPP exports unchanged; HBJSON import ignores the
   fields it doesn't know.

### Part B — the seed (joint milestone with pipeline Phase 4)

Ownership split per that phase's doc: **this feature owns the content**
(Phase 0's roster, which rows get which values); **the pipeline owns the
mechanics** (dataset shape, applier, drill).

6. **Author `datasets/iso10456-vapor-mu/` in `ph-navigator-data`** (values
   transcribed *there*, never here): payload keyed by the deterministic
   catalog row ids (`catalog-seed-idempotency`), `schema.json`,
   `PROVENANCE.md` naming the ISO 10456 edition and the match-key choice.
7. **Applier + registry entry in PHN** (`db_seed` kind,
   `backend/features/datasets/registry.py`): match rows → write the two
   vapour columns as absolute values → per-row `ApplyReport`
   (matched / updated / unchanged / **unmatched**, loudly).
8. **The local drill** per the pipeline's phase-04 doc: publish to MinIO →
   `make datasets-status` shows published-not-applied → apply → clean →
   re-apply is a zero-write no-op → v2 with one changed value → re-apply →
   verify. Production apply stays on Ed's schedule via the Phase 3 workflow.

## Out of scope

Any calculation or chip; `condensation_settings`; the `moisture_behavior`
enum (v1.1, §D-9); production apply.

## Verification

- Focused tests for model constraints, drift keys, catalog import/export
  round-trip, IP↔SI conversion (pin the 6-mil-poly sanity check:
  `sd = 50 m` ↔ ≈ 0.07 perm), and the explicit non-changes (AC 1).
- An existing saved document loads untouched (AC 2's first half).
- The Part B drill transcript, including a deliberately staged unmatched row.
- `make ci` green; **no licensed values in this repo** (AC 7) — synthetic
  values only in fixtures.
