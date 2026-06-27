---
DATE: 2026-06-27
TIME: 10:12 EDT
STATUS: Complete - Phase 06 verified
AUTHOR: Codex
SCOPE: Current state of the Apertures frame-picker filter controls planning
  packet.
RELATED:
  - planning/features/aperture-frame-picker-filters/README.md
  - planning/features/aperture-frame-picker-filters/PRD.md
  - planning/features/aperture-frame-picker-filters/PLAN.md
  - planning/features/aperture-frame-picker-filters/research.md
  - planning/features/aperture-frame-picker-filters/phases/
---

# Status - Aperture Frame Picker Filters

## Current state

State: **Complete.** Research, PRD, high-level plan, and detailed phase handoff
files are drafted. Phase 00 decisions are confirmed. Phases 01 through 06 source
work and verification are complete.

## Findings

- Current frame-picker operation filtering is exact-string filtering against the
  backend frame catalog `operation` column.
- Existing catalog rows use detailed operation labels such as `Casement`,
  `Tilt-Turn`, `Inswing`, `Outswing`, and `Sliding`, so `operation=Swing` and
  `operation=Slide` are too narrow.
- Existing assignments are not invalidated when operation changes; only the
  frontend warning logic reacts.
- `AppMenu` has normal and radio items, but no checkbox item yet.
- `tables.manufacturer_filters` is the closest persisted Apertures pattern, but
  it is versioned document state. The new toggles are display preferences, so
  local project-keyed preference is the recommended first implementation unless
  Ed wants server-backed per-user project settings.

## Confirmed decisions

1. Persistence:
   - localStorage keyed by project id;
   - display preference, not project-document truth.
2. `location=Any` appears in all side-filtered frame dropdowns.
3. `Double-Hung` appears in both Swing and Slide operation filters.
4. `Awning` and `Hopper` are added to frame catalog operation option seeds.
5. Local dev DB reset/reseed is acceptable if needed after the seed change.

## Closeout note

Phase 06 exposed one additional implementation requirement: changing the
single Alembic baseline does not update a dev/test DB that is already stamped at
`20260624_0001`, so the final implementation includes forward migration
`20260627_0002_add_awning_hopper_frame_operations.py`.

## Verification so far

Phase 01 focused verification:

```bash
cd frontend && pnpm exec vitest run src/shared/ui/__tests__/AppMenu.test.tsx
cd frontend && pnpm exec vitest run src/features/apertures/__tests__/useFramePickerFilterPreferences.test.ts
```

Both commands passed on 2026-06-27.

Phase 02 focused verification:

```bash
cd frontend && pnpm exec vitest run src/shared/ui/__tests__/AppMenu.test.tsx src/features/apertures/__tests__/FramePickerFilterMenuItems.test.tsx src/features/apertures/__tests__/useFramePickerFilters.test.tsx src/features/apertures/__tests__/useFramePickerFilterPreferences.test.ts
```

The command passed on 2026-06-27.

Phase 03 focused verification:

```bash
cd frontend && pnpm exec vitest run src/features/apertures/__tests__/picker-filters.test.ts src/features/apertures/__tests__/FramePickerFilterEngine.test.tsx src/features/apertures/__tests__/PickerPortal.test.tsx
```

The command passed on 2026-06-27.

Phase 04 focused verification:

```bash
cd frontend && pnpm exec vitest run src/features/apertures/__tests__/operation-frame-match.test.ts src/features/apertures/__tests__/picker-filters.test.ts src/features/apertures/__tests__/ApertureElementCardStack.test.tsx
```

The command passed on 2026-06-27.

Phase 05 focused verification:

```bash
cd backend && DATABASE_URL="postgresql://phn:phn_local_only@localhost:5433/ph_navigator_v2_test" uv run pytest tests/test_catalog_field_options.py tests/test_catalogs_frame_types.py
```

The command passed on 2026-06-27.

Phase 06 verification:

```bash
make db-reset-dev
make seed-agent-user
make seed-agent-browser
cd backend && uv run alembic upgrade head
cd frontend && pnpm exec vitest run src/shared/ui/__tests__/AppMenu.test.tsx src/features/apertures/__tests__/picker-filters.test.ts src/features/apertures/__tests__/operation-frame-match.test.ts src/features/apertures/__tests__/PickerPortal.test.tsx src/features/apertures/__tests__/FramePickerFilterEngine.test.tsx src/features/apertures/__tests__/FramePickerFilterMenuItems.test.tsx src/features/apertures/__tests__/useFramePickerFilterPreferences.test.ts src/features/apertures/__tests__/useFramePickerFilters.test.tsx
cd backend && DATABASE_URL="postgresql://phn:phn_local_only@localhost:5433/ph_navigator_v2_test" uv run pytest tests/test_catalog_field_options.py tests/test_catalogs_frame_types.py
make frontend-dev-check
make ci
```

All commands passed on 2026-06-27. Browser smoke passed against
`http://localhost:5173/projects/258e3617-f6a9-4ab5-b89b-9452c282f5f1/apertures`
with `codex@example.com`; screenshot:
`/tmp/phn-aperture-frame-picker-smoke.png`.
