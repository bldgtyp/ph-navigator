---
DATE: 2026-07-20
TIME: 08:27 EDT
STATUS: Deferred
AUTHOR: Claude with Ed May
SCOPE: Defect analysis and resolution options for non-idempotent catalog seed
  scripts.
RELATED:
  - ./README.md
  - ./STATUS.md
---

# Catalog seed idempotency — analysis

## Symptom

Running a catalog seed target twice against a populated database inserts the
entire seed a second time. There is no error, no warning, and no conflict
report — the second run looks identical to the first.

Reproduced 2026-07-20 on a local dev database:

```
$ make seed-materials      # (via scripts.seed_materials_catalog)
Preview: new=408 matched=0 errored=0 warnings=0
Committed: inserted=408 skipped_conflict=0

$ make seed-materials      # again, immediately
Preview: new=408 matched=0 errored=0 warnings=0
Committed: inserted=408 skipped_conflict=0

catalog_materials rows: 1224      # 408 pre-existing + 816 inserted
names with duplicates:  408
```

The duplicated rows were removed by deleting on `created_at::date` after
confirming nothing referenced them. See STATUS for the recovery recipe.

## Root cause (verified)

Catalog import classifies an incoming row as already-present **only by `id`**:

- `features/catalogs/materials/import_export/service.py` (`preview_import`)
  builds `existing_ids` as `{str(row["id"]): is_active}` over the current
  catalog.
- `features/catalogs/materials/import_export/pipeline.py` (`build_preview`)
  classifies a row `matched` when
  `coerced.id is not None and coerced.id in existing_ids`, and `new` otherwise.

The canonical catalog seed files carry **no ids at all**:

| Seed file | Rows | Rows carrying an `id` |
| --- | --- | --- |
| `materials.v1.json` | 408 | **0** |
| `frame-types.v1.json` | 189 | **0** |
| `glazing-types.v1.json` | 41 | **0** |

Every other seed file in `backend/seeds/` *does* carry ids — the three catalog
seeds are the only ones that do not.

Consequently `counts.new` is always the full row count, `counts.matched` is
always `0`, and the guard each script relies on —

```python
if preview.counts.new == 0:
    print("Nothing new to commit; exiting.")
    return
```

— is unreachable. It reads as idempotency protection while providing none.
That misleading appearance is the most dangerous part of the defect: a reader
(human or agent) reasonably concludes the script is safe to re-run.

## This is not necessarily a pipeline bug

For the feature the pipeline was built for — export the catalog, edit it,
re-import — exported files **do** carry ids, so matching works as designed and
re-import correctly reports `matched` and skips.

The defect is that the seed scripts assume an idempotency contract the pipeline
never offered them, for hand-authored id-less files. Fixing this by changing
pipeline matching would alter real user-facing import behavior (see option C).

## Blast radius

Affected targets, all three sharing the identical dead guard:

- `make seed-materials` → `scripts/seed_materials_catalog.py` (408 rows)
- `make seed-glazing` → `scripts/seed_glazing_catalog.py` (41 rows)
- `make seed-frames` → `scripts/seed_frame_catalog.py` (189 rows)

**`make db-seed` is safe.** It chains `seed-dev-data` first, which truncates
every public table (`scripts/seed_dev_db.py::_truncate_application_tables`), so
the catalogs are seeded exactly once into an empty database.

**The standalone targets are the hazard**, plus any automation that calls them
on a database that may already be populated.

Two properties make the damage easy to miss:

- Catalog data is **global**, not project-scoped, so a duplicated catalog
  affects every project and every user at once.
- The catalogs are large (408 / 189 / 41 rows), so duplicates do not stand out
  in the UI the way a duplicated short list would.

## Resolution options

### A — Give the seed files stable ids (the real fix)

Add a deterministic id per row (e.g. UUIDv5 over a natural key such as
`name` + `category`), making each seed a proper export-shaped document. Import
matching then works exactly as designed, with no pipeline change.

- **Pro:** fixes the cause, not the symptom; seeds become genuinely re-runnable;
  no change to user-facing import semantics.
- **Con:** existing databases hold rows with random ids, so the first run after
  the change inserts one more full copy before becoming stable forever. Needs
  pairing with a one-time de-dupe, or restricting to fresh databases.

### B — Add `--skip-if-not-empty` to the remaining two scripts (cheap consistency)

`seed_materials_catalog.py` already gained this flag on 2026-07-20; glazings and
frames did not.

- **Pro:** minutes of work; removes the footgun for automated callers.
- **Con:** all-or-nothing. A partially populated catalog (say 5 of 408 rows
  present) is skipped entirely rather than topped up. Mitigates rather than
  fixes.

### C — Natural-key matching for id-less rows (needs a product decision)

Match on `name` + `category` when a row has no id.

- **Pro:** fixes seeds *and* hand-authored import files.
- **Con:** changes real import semantics. A user importing a genuinely new
  material that happens to share a name with an existing one would have it
  silently skipped. This is a product decision about import behavior, **not** a
  bug fix, and should not be made as part of a seeding cleanup.

### D — Replace the dead guard with an honest one

Whatever else is chosen, the `if counts.new == 0` block in all three scripts
should be removed or replaced with a real check. Leaving unreachable code that
looks like a safety net is worse than having no net at all.

## Recommendation

1. **B + D now** — small, safe, consistent, and removes the misleading guard.
2. **A when someone owns it** — the actual fix, if these seeds are meant to be
   re-runnable rather than fresh-database-only.
3. **Do not do C** without an explicit decision on catalog import behavior.

## Acceptance criteria

- Running any catalog seed target twice in a row against a populated database
  leaves the row count unchanged.
- No script retains a guard that cannot fire.
- `make db-seed` still produces exactly one copy of each catalog.
- The chosen behavior is documented where the seed targets are discovered
  (`make help` text and/or `context/ENVIRONMENT.md`).
