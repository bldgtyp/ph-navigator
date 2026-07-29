---
DATE: 2026-07-28
UPDATED: 2026-07-29 — both policy recommendations explicitly accepted by Ed
TIME: 07:17 EDT
STATUS: Complete
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Phase 0 — measure µ/sd coverage, produce the seed target roster, and
  land the two policy calls (composite studs §D-12, Q-8).
RELATED: ../PRD.md §8, ../decisions.md §D-12/Q-8, ../research.md §7,
  planning/features/licensed-data-pipeline/phases/phase-04-mu-dataset-dry-run.md
---

# Phase 0 — Catalog coverage probe

## Goal

The one number that decides whether this feature ships as a calculation or as
a data-entry push: **after an ISO 10456 category-level seed, what fraction of
layers in real assemblies resolve to a µ or sd value?** Plus the two policy
calls that can only be made while looking at that data, and the **seed target
roster** that becomes the `iso10456-vapor-mu` dataset's row list.

No application code. No schema changes. Read-only analysis.

## Prerequisites

None. (The licensed-data pipeline is not needed here — this phase produces
the roster the pipeline's Phase 4 will consume, not the dataset itself.)

## Work

1. **Build the category → ISO 10456 mapping table** (`research.md` §7 source
   list). For each `catalog_materials` category and, where a category is
   heterogeneous (e.g. `insulation` holds mineral wool µ≈1 and XPS µ≈150),
   for each name-matchable row family: which ISO 10456 Table 3/4/5 entry
   applies, or `sd`-direct (sheet goods), or *no defensible value*. The
   mapping names ISO entries — it carries **no licensed values** and is safe
   to commit here as the probe report.
2. **Measure coverage against the catalog.** Run against a local DB seeded
   from `backend/seeds/catalogs/materials.v1.json` — the
   `catalog-seed-idempotency` refactor (638 deterministic guarded ids) makes
   local row identity production-equivalent. Report rows and, more
   importantly, expected *layer* coverage classes: `air_*` exempt (§D-12 read:
   44 % of rows), cleanly mappable, composite-stud (per the policy below),
   membrane/proprietary (never seeded — per-product data entry), unmappable.
3. **Weight by real assemblies.** Catalog-row coverage is the wrong
   denominator; layers-in-live-assemblies is the number that decides. Pull
   the assemblies from the live projects (read-only; production access is
   Ed-gated — the dev-seed project plus any project documents Ed exports are
   an acceptable proxy if a prod read is inconvenient) and compute: per
   assembly, would it fully resolve / block on N materials / not be screened
   (`ground`, `unconditioned_space`)? The go/no-go metric: **% of
   outdoor-air/ventilated assemblies that compute after the seed plus
   per-product membrane entry.**
4. **Ed's two calls, made against the evidence:**
   - **Composite studs (§D-12):** recommendation (i) — seed the cavity's µ
     plus an uncertainty caveat, with segment re-modelling as the encouraged
     path. Confirm or switch to (ii) block.
   - **Q-8:** `unconditioned_space` not screened in v1 (recommendation
     stands); `adjacent_temp_factor` deferred to v1.1.
5. **Emit the seed target roster**: `catalog_row_id → ISO 10456 entry name`
   (or `sd`-direct marker), including the composite-stud rows per the call
   above. This roster — not the values — is the input to authoring
   `datasets/iso10456-vapor-mu/` in `ph-navigator-data` during Phase 1.

## Deliverable

`phases/phase-00-report.md`: the mapping, the coverage numbers (rows and
assembly-weighted), the two recorded decisions, the roster, and the go/no-go.

## Out of scope

Writing any µ/sd value anywhere; schema or model changes; the dataset itself.

## Verification

The report's numbers are reproducible from the stated queries; the roster
covers every non-exempt, non-membrane catalog row or names it unmappable; both
policy calls carry Ed's explicit sign-off; **zero licensed values appear in
this repo** (the report contains category/entry names, stable row ids, and
counts, but no licensed values — AC 7's rule applies to probe artifacts too).

Evidence and the go recommendation were completed 2026-07-28 in
`phase-00-report.md`; Ed explicitly accepted both policies on 2026-07-29.
