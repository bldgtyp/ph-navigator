---
DATE: 2026-07-28
TIME: 11:24 EDT
STATUS: Complete — verified 2026-07-28
AUTHOR: Claude with Ed May
SCOPE: Final implementation, verification, and transition notes for catalog
  seed idempotency.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
---

# Status — Catalog seed idempotency

## Current state

All three phases are implemented: all 638 canonical material, glazing, and frame
rows now carry deterministic ids derived from catalog `kind` + row `name`, and
all three seeders validate those ids before preview.
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

## Implementation

- `backend/scripts/_catalog_seed_ids.py` owns derivation, validation, loading,
  and regeneration; `backend/scripts/_catalog_seed.py` owns the shared
  preview/commit CLI workflow for all three thin entrypoints.
- `make typography-eval` uses the normal idempotent materials seeder.
- No production impact. These are local/CI dev-seed scripts and
  `assert_local_dev_database()` refuses to run against production.

## Final verification

Completed 2026-07-28:

```text
make format
make ci
```

- Backend: Ruff format/lint, boundary checks, Ty, and Alembic passed;
  `1639 passed, 7 skipped`.
- Frontend: Prettier, ESLint, structural guards, `2312 passed`, production
  build, and version marker passed.
- Focused seed contract: all 638 ids re-derived; first previews insert
  `408 / 189 / 41`; second previews report those same matched counts with
  `new=0`, `errored=0`.

## Residual operational note

The user's current dev database was not reset during implementation because the
required transition is destructive. Before its next standalone catalog seed,
choose either the full `make db-seed` reset or the catalog-only reset documented
in `backend/seeds/README.md`. The latter preserves projects but deletes custom
catalog rows and can leave stale `catalog_origin` references. Seed re-runs are
insert-only: they do not synchronize value edits or reactivate soft-deleted
rows.

Independently reviewed 2026-07-28 (upstream/downstream consequence check): the
approach was confirmed correct and the plan updated in place. Additions worth
knowing: the id derivation is namespaced by catalog `kind` and keyed on `name`
alone; the guard test also excludes the `PHN-Default-*` sentinel names; the
transition ship-note now spells out both paths (`make db-seed` wipes local
users/sessions/projects; the catalog-only alternative preserves them but can
leave dangling `catalog_origin` references); and matched rows remain skip-only,
so seeds insert missing rows but never update existing ones.

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
