---
DATE: 2026-05-14
TIME: 12:50 EDT
SCOPE: Code review of uncommitted TB-08.a work inside the TB-08 parent phase.
REVIEWER: Codex
RELATED: planning/ROADMAP.html (TB-08, TB-08.a);
         context/PRD.md (§7 Catalog bookshelf model);
         context/technical-requirements/data-model.md (§7 Catalog);
         context/user-stories/10-windows.md (US-WIN-4).
---

# TB-08 — Frame & Glazing Catalogs — Code Review

## Summary

This diff is scoped to **TB-08.a - Frame & Glazing Catalogs**, not the
full TB-08 parent. It adds the two remaining v1 envelope catalogs
(Window-Frame Elements and Window-Glazing), rebadges Material record IDs
to the uniform AirTable-style `rec` shape, and replaces the frontend
placeholder catalog routes with real plain-table catalog pages.

Against the TB-08.a roadmap row, the implementation is materially
complete. The code adds the two Alembic migrations, backend feature
submodules for frame/glazing, authenticated CRUD routes, soft-delete /
reactivate behavior, bookshelf metadata in the list/detail responses,
catalog audit logging through `user_action_log`, frontend pages and
editor modals, and tests for the catalog contract.

I did **not** review this as a complete Windows feature. TB-08.b
(document shape and table contract), TB-08.c (Windows route, picker,
bookshelf copy, override tracer), and TB-08.d (full hardening /
staging evidence) are explicitly still open in the roadmap and should
not be treated as missing from this change.

## Findings

No blocking architectural, security, or performance defects found for
the TB-08.a scope.

## Notes / Follow-Ups

### L1 - Glazing inactive-list behavior is implemented but not fully asserted

`backend/features/catalogs/glazing_types/repository.py` implements the
same `include_inactive` filter as Materials and Frame Types, but
`backend/tests/test_catalogs_glazing_types.py::test_list_filters_inactive_by_default`
only checks the default active-only list after delete. Materials and
Frame Types also assert `include_inactive=true` returns both active and
deactivated rows.

This is not a current behavior bug, but it is a cheap regression net to
add before landing. TB-08.a explicitly lists `include_inactive`
filtering as required test coverage for both new catalogs.

### L2 - Catalog CRUD duplication is acceptable for three catalogs, but it is near the limit

The split into `materials/`, `frame_types/`, and `glazing_types/` keeps
typed model surfaces clear and matches the feature-module convention.
The shared `_shared.py` correctly centralizes ID generation, base
validators, and audit logging.

The repository/service/routes layers are still mostly repeated across
the three catalogs. For the current v1 roster (exactly Materials,
Window-Frame Elements, Window-Glazing) this is acceptable and probably
clearer than a premature generic repository. If future slices revive
the deferred equipment catalogs, this should be revisited before copying
the same CRUD stack nine more times.

### L3 - Downgrade semantics for the Material ID rebadge are intentionally one-way

`20260514_0008_catalog_materials_rec_ids.py` has a no-op downgrade
because the original opaque `mat_...` IDs are not preserved. That is
reasonable for the dev-seeded TB-07 data this migration targets, but it
means downgrade will not restore the previous logical record IDs. The
migration comment explains this clearly, so no code change is required.

## PRD / Context Alignment

- The three shipped v1 catalogs now match `context/PRD.md` §7 and
  `context/technical-requirements/data-model.md` §7.0: Materials,
  Window-Frame Elements, and Window-Glazing.
- Catalog rows remain global and authenticated. ACL hardening beyond
  "any signed-in editor" remains the same deliberate post-MVP deferral
  already recorded in TB-07/TB-08.a notes.
- The API responses include the bookshelf metadata TB-08.c needs:
  `id`, `current_version_id`, `catalog_schema_version`,
  `version_label`, and `version_date`.
- In-place edit preserves `current_version_id`, matching the current
  §7.3 MVP decision that new-version-flow UI is deferred.
- Soft-delete keeps inactive rows queryable with explicit
  `include_inactive=true`, supporting historical picks and later
  refresh-from-catalog behavior.
- Frame and glazing value fields line up with the TB-08.a row and
  US-WIN-4's picker-copy direction. The actual `FrameRef` /
  `GlazingRef` project-document shape correctly remains deferred to
  TB-08.b.

## Verification Run During Review

- `cd backend && uv run pytest tests/test_catalogs.py tests/test_catalogs_frame_types.py tests/test_catalogs_glazing_types.py tests/test_catalogs_shared.py -q`
  - Result: 26 passed, 11 warnings.
- `cd frontend && npm test -- --run src/App.test.tsx src/features/catalogs/query-keys.test.ts`
  - Result: 23 passed.
- `git diff --check`
  - Result: clean.

## Reviewed Files

- `backend/alembic/versions/20260514_0008_catalog_materials_rec_ids.py`
- `backend/alembic/versions/20260514_0009_catalog_frame_and_glazing.py`
- `backend/features/catalogs/_shared.py`
- `backend/features/catalogs/materials/*`
- `backend/features/catalogs/frame_types/*`
- `backend/features/catalogs/glazing_types/*`
- `backend/main.py`
- `backend/tests/test_catalogs*.py`
- `frontend/src/features/catalogs/**/*`
- `frontend/src/app/router.tsx`
- `frontend/src/App.css`
- `frontend/src/App.test.tsx`
- `planning/ROADMAP.html`
