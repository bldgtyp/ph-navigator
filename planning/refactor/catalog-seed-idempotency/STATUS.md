---
DATE: 2026-07-28
TIME: 11:24 EDT
STATUS: Active — Phases 1–2 complete; Phase 3 next
AUTHOR: Claude with Ed May
SCOPE: Current mitigation state and remaining work for catalog seed
  idempotency.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
---

# Status — Catalog seed idempotency

## Current state

Phases 1–2 are complete: all 638 canonical material, glazing, and frame rows now
carry deterministic ids derived from catalog `kind` + row `name`, and all three
seeders validate those ids before preview.
`tests/test_catalog_seed_ids.py` guards the derivation, id shape, uniqueness,
ASCII names, first-key ordering, and exclusion of the two aperture-default
sentinels.

| Catalog | Rows | Re-run behavior |
| --- | --- | --- |
| Materials | 408 | `new=0`, `matched=408`; commit skipped |
| Glazings | 41 | `new=0`, `matched=41`; commit skipped |
| Frames | 189 | `new=0`, `matched=189`; commit skipped |

The obsolete materials-only `--skip-if-not-empty` mitigation is removed.
Partially seeded catalogs now insert genuinely missing rows instead of skipping
the entire operation.

## What was already done

- `backend/scripts/_catalog_seed_ids.py` owns derivation, validation, loading,
  and regeneration; `backend/scripts/_catalog_seed.py` owns the shared
  preview/commit CLI workflow for all three thin entrypoints.
- `make typography-eval` uses the normal idempotent materials seeder.
- No production impact. These are local/CI dev-seed scripts and
  `assert_local_dev_database()` refuses to run against production.

## Next step

Implement Phase 3 of `PLAN.md`: add the committed pipeline-level idempotency
test and document re-seeding behavior plus the one-time stale-dev-database
transition.

Independently reviewed 2026-07-28 (upstream/downstream consequence check): the
approach was confirmed correct and the plan updated in place. Additions worth
knowing: the id derivation is namespaced by catalog `kind` and keyed on `name`
alone; the guard test also excludes the `PHN-Default-*` sentinel names; the
transition ship-note now spells out both paths (`make db-seed` wipes local
users/sessions/projects; the catalog-only alternative preserves them but can
leave dangling `catalog_origin` references); and matched rows remain skip-only,
so seeds insert missing rows but never update existing ones.

No deadline. Nothing is blocked on this; the failure mode only bites someone who
runs a standalone catalog seed target against an already-populated database.

## Recovery recipe, if someone duplicates a catalog

Duplicates are identifiable by insertion date, since the canonical seed lands in
one batch. Confirm nothing references the rows before deleting them:

```sql
-- 1. See the damage, grouped by insertion date.
SELECT created_at::date, count(*) FROM catalog_materials GROUP BY 1 ORDER BY 1;

-- 2. Confirm the suspect rows are unreferenced by any project document
--    (catalog_origin.catalog_record_id) before removing them.

-- 3. Delete only the batch that should not exist.
DELETE FROM catalog_materials WHERE created_at::date = DATE '<the-bad-date>';
```

Verify afterwards that no `name` has more than one live row. This is exactly the
procedure used to restore the local catalog from 1224 rows back to its original
408 on 2026-07-20.

## Verification for whoever picks this up

- Run each catalog seed target twice against a populated database; row counts
  must not change on the second run.
- Run `make db-seed` and confirm exactly one copy of each catalog.
- Confirm matched-only runs report their counts and skip commit.
