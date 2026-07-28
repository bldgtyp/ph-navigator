---
DATE: 2026-07-28
TIME: 11:11 EDT
STATUS: Ready to implement
AUTHOR: Claude with Ed May
SCOPE: Implementation plan for the remaining catalog seed idempotency work,
  centered on the real fix (stable ids in the seed files).
RELATED:
  - ./README.md
  - ./PRD.md
  - ./STATUS.md
  - ../../../backend/scripts/seed_materials_catalog.py
  - ../../../backend/scripts/seed_glazing_catalog.py
  - ../../../backend/scripts/seed_frame_catalog.py
  - ../../../backend/features/catalogs/materials/import_export/pipeline.py
  - ../../../backend/features/catalogs/materials/import_export/service.py
---

# Plan — Catalog seed idempotency

Implements PRD **option A** (stable ids in the seed files) as the real fix, plus
**option D** (retire the dead guard). This is the plan Ed asked for on
2026-07-28.

## Goal

Make `make seed-materials`, `make seed-glazing`, and `make seed-frames`
idempotent **by design**, not by luck: running any of them twice against a
populated catalog changes nothing. Do it without touching user-facing import
semantics.

## Why option A, and why it is low-risk

The import pipeline already has two mechanisms that make a re-import a no-op —
they are simply **inert** today:

1. `build_preview` classifies a row `matched` (and drops it from the write set)
   when `coerced.id in existing_ids`
   (`features/catalogs/*/import_export/pipeline.py`).
2. Commit wraps each insert in a per-row `SAVEPOINT` and, on a primary-key
   `UniqueViolation`, rolls back that row and records it `skipped_conflict`
   (`.../import_export/service.py::commit_import` + `_id_for_insert`).

Both key on the row **id**. The three catalog seed files carry no ids, so
`_id_for_insert` mints a fresh random `rec…` id for every row on every run —
nothing ever matches, nothing ever collides, and the whole catalog re-inserts.

**Option A changes only the seed data**, not the pipeline: give each seed row a
stable, well-formed `rec…` id. Then mechanism (1) skips already-present rows at
preview time and mechanism (2) is a backstop if the preview snapshot is stale.
The export → edit → re-import round trip is unaffected (exports already carry
ids). Because no pipeline code changes, the blast radius is the seed files and
the seed scripts only.

This is verified against the current code, not assumed:

- id shape is `^rec[A-Za-z0-9]{14}$` (`coerce.py::_CATALOG_ID_RE`); the app mints
  the same shape via `new_catalog_record_id()`
  (`features/catalogs/_shared.py`, `rec` + 14 base62).
- `catalog_materials.id` is `text NOT NULL` with **no** server default
  (`alembic/versions/20260624_0001_baseline.py`), so the id must be supplied or
  minted — which is exactly why an id-less row duplicates.
- All three catalogs share the identical `_id_for_insert` + match-by-id design
  (materials, `frame_types`, `glazing_types`).
- The three seed files have **unique natural keys**: zero duplicate `name`
  (and, for materials, zero duplicate `(name, category)`). A name-derived id is
  therefore collision-free within each seed. Re-verify this in Phase 1.

## Id derivation (the recommended approach)

Derive each id **deterministically from the row's natural key** rather than
freezing minted-random ids. Deterministic derivation means the seed can be
regenerated from source at any time and the ids never move, so project
`catalog_origin` references stay valid across regenerations.

- Natural key: materials → `name` + `\x1f` + `category`; frames/glazings →
  `name` (those tables have no `category`). The key must stay unique — the
  Phase 1 test enforces it.
- Derivation: `sha256(key)` → interpret the digest as a big integer →
  base62-encode with `string.ascii_letters + string.digits` → take 14 chars →
  prefix `rec`. Proven to satisfy `^rec[A-Za-z0-9]{14}$`.
- Put the derivation in **one shared helper** (e.g.
  `backend/scripts/_catalog_seed_ids.py`) imported by all three seeders and by
  the generator/test below, so there is a single definition.

Caveat to document in the helper: the id is a function of the natural key, so
**renaming a seed row rotates its id** — the renamed row seeds as a new logical
record and the old id is simply absent from future seeds. That is the correct
behavior for a catalog seed and is rare, but it must be stated so nobody treats
these ids as stable across a rename.

**Alternative considered — freeze minted-random ids into the files once.**
Simpler (no derivation code), but the ids are then unreproducible: any
regeneration of a seed from upstream source loses them. Rejected as the primary
approach for that reason; acceptable only if these seeds will never be
regenerated.

## Phases

### Phase 1 — Bake deterministic ids into the seed files

1. Add the shared derivation helper (`_catalog_seed_ids.py`).
2. Add a small committed generator (or a `--write-ids` mode on the helper) that
   reads each seed file, injects the derived `id` into every row, and writes it
   back with stable key ordering and formatting.
3. Run it once; commit the three updated seed files
   (`materials.v1.json`, `frame-types.v1.json`, `glazing-types.v1.json`).
4. Add a **guard test** (`tests/test_catalog_seed_ids.py`) that, for each seed
   file, asserts: every row has an `id`; every id matches `^rec[A-Za-z0-9]{14}$`;
   every id equals the value the helper derives from that row's natural key;
   and all ids (and all natural keys) within a file are unique. This makes the
   ids impossible to drift silently and catches a future added row that lacks or
   mismatches its id.

Exit: all three seed files carry correct derived ids; the guard test is green.

### Phase 2 — Make the seeders honest and idempotent

1. Remove the unreachable `if preview.counts.new == 0: … return` block from all
   three scripts (option D). With Phase 1, a fully-seeded catalog now genuinely
   reports `new == 0`, so if a guard is wanted it can be re-added as a truthful
   post-preview check — but prefer simply reporting the counts and letting the
   matched-skip do the work.
2. **Retire `--skip-if-not-empty`** from `seed_materials_catalog.py` and drop
   its use in `make typography-eval`. Option A supersedes it: the flag skips a
   populated catalog wholesale (never topping up), whereas A inserts only
   genuinely-missing rows and self-heals a partially-seeded catalog. (Keeping
   the flag for one release as a belt-and-suspenders is a defensible
   conservative choice — see "Decisions for the implementer".)
3. Confirm the scripts print a clear line on a no-op run (e.g.
   `Committed: inserted=0 skipped_conflict=0` with a matched count), so a re-run
   is visibly a no-op.

Exit: running each target twice against a catalog seeded from these files leaves
the row count unchanged, with no dead code.

### Phase 3 — Transition, tests, and docs

1. **Transition (local/CI only — there is no production catalog to migrate).**
   The seed scripts are hard-guarded to the `ph_navigator_v2` dev database
   (`scripts/_seed_paths.py::assert_local_dev_database`); production is
   `ph_navigator_74vs` and its catalog was seeded by other means. Existing dev
   DBs hold random-id rows, so the ship note is: **run `make db-seed` once**
   (it truncates first) to rebuild the dev catalog with deterministic ids;
   thereafter the standalone targets are idempotent. CI is unaffected (fresh DB
   every run).
2. Add a focused idempotency test or a `make` check that seeds a catalog twice
   into a throwaway/empty state and asserts the second run inserts zero rows and
   the row/name counts are unchanged. If a DB-backed test is too heavy, assert
   at the pipeline level: `build_preview(seed_body, existing_ids=<ids from a
   first pass>)` yields `counts.new == 0`.
3. Docs: update the seed targets' `make help` text and, if it documents seeding,
   `context/ENVIRONMENT.md`, to state the seeds are idempotent and how the
   transition works. Fold the resolution back per the planning source-of-truth
   rule.

Exit: idempotency is enforced by a test, and the behavior is documented where
the seed targets are discovered.

## Explicitly out of scope

- **Option C (natural-key matching in the pipeline).** Rejected in the PRD: it
  changes user-facing import behavior and could silently skip a legitimately new
  record that shares a name. Not part of this refactor. Option A deliberately
  keeps the pipeline untouched.
- Any change to how the **production** catalog is managed. This packet is about
  local/CI dev seeds.

## Decisions for the implementer

1. **Id source — derived vs frozen-random.** Recommended: derived from the
   natural key (reproducible across regeneration). Choose frozen-random only if
   these seeds will never be regenerated from an upstream source.
2. **`--skip-if-not-empty` — retire vs keep one release.** Recommended: retire,
   and rely on `make db-seed` for the transition. Keep it only if you want a
   conservative safety belt while dev DBs still hold random-id rows.
3. **Idempotency test level — DB-backed vs pipeline-level.** Either satisfies
   the acceptance criteria; pick the lighter one that runs in `make ci`.

## Acceptance criteria (from the PRD, made concrete)

- Running each of `make seed-materials`, `make seed-glazing`, `make seed-frames`
  twice against a catalog seeded from these files leaves row and active-name
  counts unchanged on the second run.
- No script retains a guard that cannot fire.
- `make db-seed` still produces exactly one copy of each catalog.
- Every seed row has a derived `id` matching `^rec[A-Za-z0-9]{14}$`, enforced by
  a committed test that re-derives and compares.
- The chosen behavior and the one-time transition step are documented where the
  seed targets are discovered.

## Risks and how the plan handles them

- **Transition double-insert on a stale dev DB.** A standalone target run before
  `make db-seed` still duplicates once (old random-id rows do not match the new
  derived ids). Handled by the ship note; optionally by keeping
  `--skip-if-not-empty` for one release.
- **A seed row edited without regenerating ids.** The Phase 1 guard test fails
  if any id does not equal its derived value, forcing regeneration.
- **Natural-key collision from a future seed addition.** The guard test asserts
  uniqueness of keys and ids per file and fails on a collision.
