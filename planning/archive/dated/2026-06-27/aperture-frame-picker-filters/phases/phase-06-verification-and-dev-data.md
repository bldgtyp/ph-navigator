---
DATE: 2026-06-27
TIME: 10:12 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Focused tests, browser smoke, local dev data refresh, and final gates.
RELATED:
  - planning/features/aperture-frame-picker-filters/phases/phase-01-menu-preferences.md
  - planning/features/aperture-frame-picker-filters/phases/phase-02-actions-menu-context.md
  - planning/features/aperture-frame-picker-filters/phases/phase-03-picker-filter-engine.md
  - planning/features/aperture-frame-picker-filters/phases/phase-04-operation-warning.md
  - planning/features/aperture-frame-picker-filters/phases/phase-05-catalog-option-seeds.md
---

# Phase 06 - Verification and Dev Data

## Goal

Verify the implementation end to end without overstating what was tested.

## Focused automated gates

Frontend:

```bash
cd frontend && pnpm exec vitest run src/shared/ui/__tests__/AppMenu.test.tsx
cd frontend && pnpm exec vitest run src/features/apertures/__tests__/picker-filters.test.ts
cd frontend && pnpm exec vitest run src/features/apertures/__tests__/operation-frame-match.test.ts
cd frontend && pnpm exec vitest run src/features/apertures/__tests__/PickerPortal.test.tsx
```

Backend:

```bash
make db-migrate-test
cd backend && DATABASE_URL="$TEST_DATABASE_URL" uv run pytest tests/test_catalog_field_options.py tests/test_catalogs_frame_types.py
```

Fast frontend gate:

```bash
make frontend-dev-check
```

Final closeout gate when implementation is complete:

```bash
make ci
```

## Local dev data

If the browser smoke needs the new `Awning`/`Hopper` operation options in the
local catalog option store, reset and reseed local dev data:

```bash
make db-reset-dev
```

This wipes local dev/test Postgres volumes per the Makefile target contract, so
run it only when that is acceptable for the current worktree/session.

## Browser smoke baseline

Use the repo-standard local stack:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Agent login: `codex@example.com` / `password`

Before browser work:

```bash
curl -i http://localhost:8000/api/v1/auth/session
```

Expected signed-out health response: `401` with `not_authenticated`.

## Browser smoke checklist

1. Open the Apertures Builder route for the seeded project.
2. Open the Aperture actions menu.
   - `Filter frames by side` is checked by default.
   - `Filter frames by operation` is unchecked by default.
3. Open a top frame picker with side filtering on.
   - Head rows are visible.
   - Any-location rows are visible if present.
   - Jamb/Sill/Mull rows are hidden.
4. Open right/left frame pickers with side filtering on.
   - Jamb rows are visible.
   - Any-location rows are visible if present.
5. Turn side filtering off.
   - Head/Jamb/Sill/Mull-H/Mull-V/Any rows can appear in any side picker,
     subject to manufacturer filters.
6. With operation filtering off, set an element to Swing.
   - Fixed, Casement, Tilt-Turn, Sliding, and other operation rows can still
     appear, subject to side/manufacturer filters.
7. Turn operation filtering on for a Swing element.
   - Swing-family rows appear: Inswing, Outswing, Casement, Awning, Hopper,
     Tilt-Turn, and Double-Hung.
   - Fixed and Sliding-only rows are hidden.
8. Switch the element to Slide.
   - Sliding and Double-Hung rows appear.
9. Assign a swing-family frame, then change the element to Fixed.
   - The frame assignment remains.
   - The selected row remains visible.
   - The warning appears because the frame no longer matches Fixed.
10. Turn operation filtering off again.
    - The assignment remains.
    - Broader operation rows return to the picker.

## Graph update

After source code changes, run:

```bash
graphify update .
```

This follows the repo rule to keep `graphify-out/` current after code edits.

## Handoff acceptance

- Focused frontend and backend tests pass.
- Browser smoke confirms defaults, toggle persistence, Any-location visibility,
  Double-Hung dual-family behavior, and no assignment clearing.
- Final response names any gates that were not run.

## Completion Evidence

Local dev data was reset and seeded:

```bash
make db-reset-dev
make seed-agent-user
make seed-agent-browser
```

`make db-reset-dev` inserted 189 frame catalog rows. `make seed-agent-browser`
created/repaired `AGENT-BROWSER` at
`http://localhost:5173/projects/258e3617-f6a9-4ab5-b89b-9452c282f5f1/apertures`.
`curl -i http://localhost:8000/api/v1/auth/session` returned the expected
signed-out `401` / `not_authenticated` health response.

The live smoke initially exposed that an already-migrated dev DB did not receive
`Awning` and `Hopper` from the edited baseline alone. Added and applied forward
migration `20260627_0002_add_awning_hopper_frame_operations.py`, then verified
the live option-store labels through the authenticated frontend proxy:

```text
Inswing, Outswing, Casement, Awning, Hopper, Fixed, Tilt-Turn, Sliding, Double-Hung
```

Browser smoke passed against the seeded project with `codex@example.com`:

- Actions menu defaults: side filter checked; operation filter unchecked.
- Top picker with side filter: `Head` and `Any` visible; `Sill` hidden.
- Right picker with side filter: `Jamb` and `Any` visible; `Head` hidden.
- Side filter off: `Head`, `Jamb`, `Sill`, and `Any` visible in the top picker.
- Operation filter off on Swing: broad rows including `Fixed`, `Sliding`, and
  `Casement` remain visible.
- Operation filter on for Swing: `Inswing`, `Outswing`, `Casement`,
  `Tilt-Turn`, and `Double-Hung` visible; `Fixed` and `Sliding` hidden.
- Operation filter on for Slide: `Sliding` and `Double-Hung` visible;
  `Casement` hidden.
- A selected `Casement` frame remains assigned and visible after changing the
  element to Fixed, and the operation warning appears.
- Turning operation filtering off restores broad rows without clearing the
  assignment.
- The frame-type operation option store exposes `Awning` and `Hopper`.

Screenshot: `/tmp/phn-aperture-frame-picker-smoke.png`.

Focused gates passed:

```bash
cd frontend && pnpm exec vitest run src/shared/ui/__tests__/AppMenu.test.tsx src/features/apertures/__tests__/picker-filters.test.ts src/features/apertures/__tests__/operation-frame-match.test.ts src/features/apertures/__tests__/PickerPortal.test.tsx src/features/apertures/__tests__/FramePickerFilterEngine.test.tsx src/features/apertures/__tests__/FramePickerFilterMenuItems.test.tsx src/features/apertures/__tests__/useFramePickerFilterPreferences.test.ts src/features/apertures/__tests__/useFramePickerFilters.test.tsx
cd backend && DATABASE_URL="postgresql://phn:phn_local_only@localhost:5433/ph_navigator_v2_test" uv run pytest tests/test_catalog_field_options.py tests/test_catalogs_frame_types.py
```

Results: 38 frontend tests passed; 29 backend tests passed.

Final gates passed:

```bash
make frontend-dev-check
make ci
```

`make frontend-dev-check` passed with existing fast-refresh lint warnings only.
`make ci` passed: backend `1112 passed, 2 skipped`; frontend `204 passed` test
files / `1939 passed` tests; production build passed.
