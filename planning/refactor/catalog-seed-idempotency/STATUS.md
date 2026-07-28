---
DATE: 2026-07-20
TIME: 08:27 EDT
STATUS: Deferred
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

Diagnosed and partially mitigated. Found incidentally on 2026-07-20 while
repairing the Typography Eval workflow (commit `e54b19db`), not through a
dedicated investigation.

| Catalog | Rows | Guard today |
| --- | --- | --- |
| Materials | 408 | `--skip-if-not-empty` flag added; used by `make typography-eval` |
| Glazings | 41 | **None** — unguarded |
| Frames | 189 | **None** — unguarded |

The materials mitigation is opt-in: a bare `make seed-materials` on a populated
database still duplicates. Only callers that pass the flag are protected.

## What was already done

- `backend/scripts/seed_materials_catalog.py` gained `--skip-if-not-empty`,
  which exits when the catalog has any live rows. Its help text states plainly
  that the import is not idempotent.
- `make typography-eval` passes that flag (it needs a non-empty catalog on a
  fresh CI database, and would otherwise duplicate on every local run).
- No production impact. These are local/CI dev-seed scripts and
  `assert_local_dev_database()` refuses to run against production.

## Next step

Implement `PLAN.md`, which now specifies the real fix (option A: deterministic
ids baked into the three seed files) plus retiring the dead guard (option D).
The plan supersedes the earlier "B + D" holding recommendation: with stable ids
the import is idempotent by design, so the `--skip-if-not-empty` flag is retired
rather than extended to the other two scripts. Verified in the plan against the
current pipeline — no import-semantics change, and the transition is local/CI
only (there is no production catalog to migrate; the scripts are hard-guarded to
the dev database).

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
- Confirm no `counts.new == 0` guard remains in any of the three scripts.
