---
DATE: 2026-06-27
TIME: 08:56 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Add Awning and Hopper as valid frame catalog operation options.
RELATED:
  - planning/features/aperture-frame-picker-filters/phases/phase-03-picker-filter-engine.md
  - backend/features/catalogs/_option_seeds.py
  - backend/features/catalogs/frame_types/options_service.py
  - backend/tests/test_catalog_field_options.py
  - backend/tests/test_catalogs_frame_types.py
---

# Phase 05 - Catalog Option Seeds

## Goal

Make `Awning` and `Hopper` valid `frame_types.operation` single-select options
so catalog rows can be created or edited with those operation labels.

## Expected source edits

- `backend/features/catalogs/_option_seeds.py`
- `backend/tests/test_catalog_field_options.py`
- `backend/tests/test_catalogs_frame_types.py`
- possibly backend migration seed snapshots if focused tests prove they are
  intentionally duplicated there

## Implementation plan

1. Add `Awning` and `Hopper` to `FRAME_TYPE_OPTION_SEEDS["operation"]`.
   - Preserve existing capitalization.
   - Keep the option order readable, likely near the other swing-family labels.
2. Check whether any canonical count/list tests assert the old operation option
   set.
   - Update expected counts/lists.
   - Prefer exact-list assertions over loose count-only assertions if the
     existing tests already use exact lists elsewhere.
3. Confirm import/export validation accepts the new operation labels.
4. Do not mutate existing seed frame rows unless there is a separate product
   request to reclassify specific catalog records.

## Migration and local DB notes

- The canonical option-reset path goes through
  `seed_frame_type_options(conn)`, which reads `FRAME_TYPE_OPTION_SEEDS`.
- Existing local DBs may not see the new options until reset/reseed.
- Repo reset/reseed target:

```bash
make db-reset-dev
```

- If climate/object-store seeding prerequisites make `make db-reset-dev`
  expensive or blocked on a machine, the implementer can still validate the
  option code path through backend tests first and reset local dev data before
  browser smoke.

## Edge cases

- Existing imported catalog rows with `Awning` or `Hopper` should stop being
  rejected by single-select validation after this phase.
- If a migration contains a frozen copy of option seeds, update it only if it is
  part of the canonical current schema/data bootstrap. Do not back-edit old
  historical migrations casually.

## Verification

- Focused backend tests:

```bash
cd backend && DATABASE_URL="$TEST_DATABASE_URL" uv run pytest tests/test_catalog_field_options.py tests/test_catalogs_frame_types.py
```

- If tests require the test DB schema first:

```bash
make db-migrate-test
```

## Handoff acceptance

- `Awning` and `Hopper` appear as valid frame operation options.
- Existing frame catalog import/export behavior remains unchanged except for
  accepting the two new labels.
