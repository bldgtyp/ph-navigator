---
DATE: 2026-07-28
UPDATED: 2026-07-29 — local Phase 4 drill complete
TIME: 12:05 EDT
STATUS: Complete locally — private payload, applier, idempotency/change/rollback
  drill, and unmatched reporting pass; production apply remains held
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Phase 4 — prove the `db_seed` kind end-to-end with the ISO 10456 µ
  dataset, locally.
RELATED: ../PRD.md §9, ../decisions.md §D-10,
  planning/archive/dated/2026-07-29/assembly-condensation-risk/PRD.md §4/§8
---

# Phase 4 — First `db_seed` dataset: `iso10456-vapor-mu`

## Goal

The pipeline's `db_seed` path proven by its first real consumer, entirely
locally. **Ownership split:** the µ *content* (which categories/materials get
which values, the composite-stud policy §D-12 over there) and the catalog
columns it lands in belong to `assembly-condensation-risk` (its Phases 0–1).
This phase owns the *mechanics*: dataset authoring shape, applier, and the
end-to-end drill. Production apply happens on that feature's schedule, via
the Phase 3 workflow.

## Prerequisites

- Pipeline Phases 1–2 (repo + PHN feature). Phase 3 is not required for the
  local drill.
- Condensation Phase 1's catalog columns
  (`vapor_diffusion_resistance_mu` / `vapor_sd_equivalent_m`) exist.
- Condensation Phase 0's coverage probe has settled which rows get seeded
  values (including the §D-12 composite-stud call).

## Result — 2026-07-29

- The condensation feature supplied its accepted 201-row stable-id roster,
  both catalog columns, and the composite cavity/base-family policy.
- `ph-navigator-data` now holds the licensed payload, schema, provenance, and
  manifest entry. Private validation and all 8 publisher tests pass. Licensed
  values were not copied into PHN.
- PHN registers `iso10456-vapor-mu` as `db_seed` with a typed parser and an
  absolute-value applier reporting matched / updated / unchanged / unmatched.
- The local MinIO/Postgres sequence passed: pending before apply; deliberately
  unmatched before stable catalog seeding; 201/201 matched after seeding;
  clean status; zero-write forced re-apply; one-row temporary v2 update; then
  rollback to reviewed v1. Final `make datasets-status` reports no mismatches.
- Production publish/apply was not run. It remains on Ed's schedule through
  the Phase 3 production workflow.

## Work

1. **Author `datasets/iso10456-vapor-mu/` in `ph-navigator-data`**: values keyed by
   the catalog's stable row identity (§D-10 — coordinate with
   `archive/dated/2026-07-28/catalog-seed-idempotency`; the dataset's
   `PROVENANCE.md` states the match-key choice and the ISO 10456 edition).
   Schema + manifest entry.
2. **Applier + registry entry in PHN** (`db_seed`): match → update the two
   vapour columns → per-row `ApplyReport` (matched / updated / unchanged /
   **unmatched**, E-10). Absolute-value writes, so re-apply is idempotent and
   applying an older version is the rollback (E-3).
3. **The drill**, local MinIO + local DB: publish → `datasets_status` shows
   published-not-applied → apply → status clean → re-apply is a zero-write
   no-op (AC 7) → publish a v2 with one changed value → status flags pending
   → apply v2 → verify the row.

## Out of scope

Production apply; any UI; the condensation engine (its Phase 2).

## Verification

The drill transcript above, plus: an unmatched-row case deliberately staged
and loudly reported (E-10); `make ci` green; condensation's acceptance
criterion 1 spot-checked (a material untouched by the seed behaves exactly as
before).
