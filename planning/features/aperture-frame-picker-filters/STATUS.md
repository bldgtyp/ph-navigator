---
DATE: 2026-06-27
TIME: 08:56 EDT
STATUS: Active - Phase 01 implemented
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

State: **Active.** Research, PRD, high-level plan, and detailed phase handoff
files are drafted. Phase 00 decisions are confirmed. Phase 01 source work is
implemented and verified with focused frontend tests.

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

## Next step

Continue with `phases/phase-02-actions-menu-context.md`.

## Verification so far

Phase 01 focused verification:

```bash
cd frontend && pnpm exec vitest run src/shared/ui/__tests__/AppMenu.test.tsx
cd frontend && pnpm exec vitest run src/features/apertures/__tests__/useFramePickerFilterPreferences.test.ts
```

Both commands passed on 2026-06-27.
