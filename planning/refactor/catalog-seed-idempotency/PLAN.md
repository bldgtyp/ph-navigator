---
DATE: 2026-07-28
TIME: 11:24 EDT
STATUS: Active — Phases 1–2 complete; Phase 3 next
AUTHOR: Claude with Ed May
REVIEWED: 2026-07-28 — claims re-verified against code; edge cases folded in
  (sentinel rows, id namespacing, transition cost, soft-delete re-runs).
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

This is verified against the current code, not assumed (re-checked 2026-07-28):

- id shape is `^rec[A-Za-z0-9]{14}$` (`coerce.py::_CATALOG_ID_RE`, duplicated
  identically in all three catalogs' `coerce.py`); the app mints the same shape
  via `new_catalog_record_id()` (`features/catalogs/_shared.py`, `rec` + 14
  base62).
- `catalog_materials.id` is `text NOT NULL` with **no** server default
  (`alembic/versions/20260624_0001_baseline.py`), so the id must be supplied or
  minted — which is exactly why an id-less row duplicates. There is also **no
  unique constraint on catalog names** in any of the three tables, so nothing
  at the DB layer prevents duplicates; idempotency must come from id matching.
- All three catalogs share the identical `_id_for_insert` + match-by-id design
  (materials, `frame_types`, `glazing_types`).
- **Matched rows are skip-only.** `build_preview` drops matched rows from the
  write set; commit never updates or reactivates
  (`pipeline.py` — "skip-matches policy", explicit in the code comments). Two
  consequences worth knowing: a re-seed never clobbers a dev user's edits to a
  catalog row, and a soft-deleted seed row is **not** resurrected — it matches
  (preview fetches `include_inactive=True`, `service.py::preview_import`) and
  surfaces a `matched_inactive_skip` warning. Expect that warning on re-runs
  against a catalog where rows were soft-deleted; it is correct behavior, not a
  failure.
- `CatalogFileRow` has an optional `id` field with `extra="allow"`
  (`file_format.py`), so adding `id` to the seed rows needs **no
  `schema_version` bump** and no upgrade-chain entry.
- The three seed files have **unique natural keys**: zero duplicate `name` in
  each file, zero cross-file overlap, and every name is plain ASCII. A
  name-derived id is therefore collision-free within each seed. Re-verify this
  in Phase 1 (the guard test makes it permanent).

## Id derivation (the recommended approach)

Derive each id **deterministically from the row's natural key** rather than
freezing minted-random ids. Deterministic derivation means the seed can be
regenerated from source at any time and the ids never move, so project
`catalog_origin` references stay valid across regenerations.

- Natural key: **`name` alone, for all three catalogs.** Names are unique in
  each seed file today and the Phase 1 guard test makes that permanent.
  Deliberately do **not** fold `category` into the materials key: a category
  correction (miscategorized material — a plausible seed edit) would rotate the
  id, and on an already-seeded dev DB that means the old row lingers *and* the
  corrected row inserts under a new id — a duplicate name. Keyed on name alone,
  a category fix keeps the id stable (fresh DBs get the corrected row; existing
  DBs keep the old row untouched, since matched rows are never updated — same
  as today). If two materials ever legitimately need the same name in different
  categories, the guard test fails loudly and the resolution is to
  disambiguate the name.
- **Namespace the key by catalog kind**: hash `kind + "\x1f" + name`, using
  each file's `kind` string (`ph-navigator.catalog.materials`, `.frame-types`,
  `.glazing-types`). There is zero cross-catalog name overlap today, but a
  frame and a glazing from the same manufacturer could plausibly share a
  product name someday; without the namespace they would carry the *same id
  string in two tables*. Not a correctness break (`catalog_origin` records
  `catalog_table` alongside `catalog_record_id`), but identical ids across
  tables would poison log greps and debugging forever, and the namespace is one
  line now versus never-fixable later (ids can't rotate once shipped).
- Derivation: `sha256(key.encode("utf-8"))` → interpret the digest as a big
  integer → base62-encode with `string.ascii_letters + string.digits` → take
  14 chars → prefix `rec`. Proven to satisfy `^rec[A-Za-z0-9]{14}$`. All names
  are ASCII today; have the guard test assert ASCII (or NFC-normalized) names
  so a future non-ASCII addition can't create a normalization-dependent id
  (macOS/Dropbox NFD vs NFC would otherwise be a silent id-rotation hazard).
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

## Sentinel rows — the one id family the seeds must never touch

Two catalog rows exist **outside** the seed files, with hand-picked ids baked
into code and data:

| Sentinel id | Name | Table |
| --- | --- | --- |
| `recPHNDefFrame001` | `PHN-Default-Frame` | `catalog_frame_types` |
| `recPHNDefGlazng01` | `PHN-Default-Glass` | `catalog_glazing_types` |

They are inserted by the **baseline migration**
(`alembic/versions/20260624_0001_baseline.py`), re-asserted by
`scripts/seed_dev_db.py::_reseed_aperture_default_catalog_rows`, and referenced
by id from `features/project_document/envelope_models.py`
(`APERTURE_DEFAULT_FRAME_ID` / `APERTURE_DEFAULT_GLAZING_ID`) and both
frame/glazing upgrade chains. The seed files do not contain these names today
— keep it that way. If a row named `PHN-Default-Frame` were ever added to the
frame seed, its *derived* id would differ from the sentinel id, and every
`make db-seed` would produce two rows with that name forever. The Phase 1
guard test asserts the sentinel names are absent from the seed files (a
derived-id collision with a sentinel id is cryptographically negligible; the
name check is the real guard).

## Phases

### Phase 1 — Bake deterministic ids into the seed files — COMPLETE (2026-07-28)

1. Add the shared derivation helper (`_catalog_seed_ids.py`).
2. Add a small committed generator (or a `--write-ids` mode on the helper) that
   reads each seed file, injects the derived `id` into every row, and writes it
   back with stable key ordering and formatting. Put `id` **first** in each
   row, matching the client-side export's canonical key order
   (`frontend/.../import_export/export.ts` puts `id` first "so the file's
   identity" leads) — the seeds are meant to be export-shaped documents.
3. Run it once; commit the three updated seed files
   (`materials.v1.json`, `frame-types.v1.json`, `glazing-types.v1.json`).
   No `schema_version` bump: `id` is already an optional field of
   `CatalogFileRow` in all three file formats.
4. Add a **guard test** (`tests/test_catalog_seed_ids.py`) that, for each seed
   file, asserts: every row has an `id`; every id matches `^rec[A-Za-z0-9]{14}$`;
   every id equals the value the helper derives from that row's natural key;
   all ids (and all natural keys) within a file are unique; every name is
   ASCII (or NFC-normalized); and the sentinel names `PHN-Default-Frame` /
   `PHN-Default-Glass` do not appear in any seed file (see "Sentinel rows"
   above). This makes the ids impossible to drift silently and catches a future
   added row that lacks or mismatches its id.

Exit: all three seed files carry correct derived ids; the guard test is green.

Completed with `scripts/_catalog_seed_ids.py`, which derives and validates the
ids and can rewrite all three seeds. All 638 seed rows now carry the derived id
as their first key. Verification:

```text
uv run pytest tests/test_catalog_seed_ids.py                    # 3 passed
uv run ruff check scripts/_catalog_seed_ids.py tests/test_catalog_seed_ids.py
uv run ty check scripts/_catalog_seed_ids.py tests/test_catalog_seed_ids.py
```

### Phase 2 — Make the seeders honest and idempotent — COMPLETE (2026-07-28)

1. Rework the `if preview.counts.new == 0: … return` block in all three
   scripts (option D). Note the framing shift: **after Phase 1 this guard is no
   longer unreachable — it becomes truthful** (a fully-seeded catalog genuinely
   reports `new == 0`). Keep an early return but make its message honest, e.g.
   `All 408 rows already present (matched=408); nothing to insert.` — skipping
   the commit call on a no-op keeps the output clean. What must go is the
   *implication* that the guard was ever protective before Phase 1.
2. Update the prose that documents the old behavior: the module docstring of
   `seed_materials_catalog.py` ("subsequent runs insert duplicates…") and the
   `--skip-if-not-empty` help text both state the import is not idempotent —
   after Phase 1 they are wrong. The other two scripts' docstrings likely need
   the same pass.
3. **Retire `--skip-if-not-empty`** from `seed_materials_catalog.py` and drop
   its use in `make typography-eval` (Makefile ~line 107, including its
   explanatory comment block about non-idempotency). Option A supersedes it:
   the flag skips a populated catalog wholesale (never topping up), whereas A
   inserts only genuinely-missing rows and self-heals a partially-seeded
   catalog. One behavior difference to be aware of: the flag counted only
   `deleted_at IS NULL` rows, so an all-soft-deleted catalog would re-import
   under the flag; under A it correctly stays deleted (inactive rows still
   match by id). (Keeping the flag for one release as a belt-and-suspenders is
   a defensible conservative choice — see "Decisions for the implementer".)
4. Confirm the scripts print a clear line on a no-op run (e.g.
   `Committed: inserted=0 skipped_conflict=0` with a matched count), so a re-run
   is visibly a no-op. Expect `matched_inactive_skip` warnings on re-runs where
   rows were soft-deleted; that is correct, not a failure.

Exit: running each target twice against a catalog seeded from these files leaves
the row count unchanged, with no dead code.

Completed by routing all three thin entrypoints through the shared
`run_catalog_seed()` workflow, which loads every seed through
`load_catalog_seed()`, reports matched-only counts, and skips no-op commits.
`--skip-if-not-empty` is retired, and the Typography Eval caller now uses the
normal idempotent materials seed. Verification:

```text
uv run pytest tests/test_catalog_seed_ids.py tests/test_catalog_seed_scripts.py tests/test_auth.py -q
# 31 passed
pipeline replay: materials matched=408; frames matched=189; glazings matched=41
# all three: new=0, errored=0
```

### Phase 3 — Transition, tests, and docs

1. **Transition (local/CI only — there is no production catalog to migrate).**
   The seed scripts are hard-guarded to the `ph_navigator_v2` dev database
   (`scripts/_seed_paths.py::assert_local_dev_database`); production is
   `ph_navigator_74vs` and its catalog was seeded by other means. Existing dev
   DBs hold random-id rows, so a one-time transition is needed. CI is
   unaffected (fresh DB every run). Two paths — the ship note must state the
   cost of each honestly:
   - **Full reset — `make db-seed` once.** Clean, but it truncates *every*
     app table: local users, sessions, and projects are wiped, not just
     catalogs. (This is the known "re-seed wipes your session" cost.) Right
     choice when the dev DB holds nothing worth keeping.
   - **Catalog-only reset** for a dev DB with local work worth preserving:
     delete the three catalog tables' rows **except the two sentinel ids**
     (`DELETE FROM catalog_frame_types WHERE id <> 'recPHNDefFrame001'`, same
     idea for glazings; materials has no sentinel), then run the three seed
     targets. Caveat to state plainly: any existing local project document
     that references a deleted catalog row via `catalog_origin` is left with a
     dangling `catalog_record_id` (renders as a missing/stale option in the
     UI). Acceptable for a dev DB, but it must be a knowing choice. A plain
     `TRUNCATE` is wrong here — it would also remove the sentinels, which only
     `make db-seed` (via `_reseed_aperture_default_catalog_rows`) or the
     baseline migration put back.
2. Add a focused idempotency test or a `make` check that seeds a catalog twice
   into a throwaway/empty state and asserts the second run inserts zero rows and
   the row/name counts are unchanged. If a DB-backed test is too heavy, assert
   at the pipeline level: `build_preview(seed_body, existing_ids=<ids from a
   first pass>)` yields `counts.new == 0`.
3. Docs: update the seed targets' `make help` text (while there, fix the stale
   `seed-materials … (10 rows)` count — the seed is 408 rows) and, if it
   documents seeding, `context/ENVIRONMENT.md`, to state the seeds are
   idempotent and how the transition works. Fold the resolution back per the
   planning source-of-truth rule.

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
- **A sentinel name added to a seed file.** Derived id ≠ sentinel id, so every
  fresh seed would create a permanent duplicate of `PHN-Default-Frame` /
  `PHN-Default-Glass`. The guard test asserts the sentinel names are absent
  (see "Sentinel rows").
- **Seed edits silently not reaching existing DBs.** Matched rows are
  skip-only, so correcting a *value* (conductivity, category, …) in a seed
  file updates fresh DBs but never already-seeded ones. That is today's
  behavior too — option A does not change it — but with "idempotent seeds" in
  hand someone may expect re-running to sync values. The docs pass (Phase 3)
  should state: the seed inserts missing rows; it never updates existing ones.
