---
DATE: 2026-06-27
TIME: 08:56 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Shared checkbox menu primitive and local project-keyed preference hook.
RELATED:
  - planning/features/aperture-frame-picker-filters/phases/phase-00-decisions-and-readiness.md
  - frontend/src/shared/ui/AppMenu.tsx
  - frontend/src/shared/ui/__tests__/AppMenu.test.tsx
  - frontend/src/styles/base.css
  - frontend/src/features/apertures/hooks/useApertureDimFormat.ts
---

# Phase 01 - Menu Preferences

## Goal

Add the reusable menu checkbox primitive and the Apertures-specific
localStorage hook, without wiring the controls into the Apertures page yet.

## Expected source edits

- `frontend/src/shared/ui/AppMenu.tsx`
- `frontend/src/shared/ui/__tests__/AppMenu.test.tsx`
- `frontend/src/styles/base.css`
- new `frontend/src/features/apertures/hooks/useFramePickerFilterPreferences.ts`
- optional new
  `frontend/src/features/apertures/__tests__/useFramePickerFilterPreferences.test.ts`

## Implementation plan

1. Add `AppMenuCheckboxItem` next to `AppMenuRadioItem`.
   - Use `role="menuitemcheckbox"`.
   - Set `aria-checked={checked}`.
   - Render a check/square state in `.app-menu__item-icon`.
   - Reuse `.app-menu__item` layout.
   - Accept normal button props including `title`, `data-tooltip`, and
     `aria-description`.
   - Add `closeOnSelect?: boolean`; default to `false` for checkbox rows so
     both toggles can be changed while the menu is open.
2. Add minimal CSS for the checkbox mark.
   - Keep the existing 16px icon column stable.
   - Avoid widening the menu or changing existing radio item layout.
3. Add `useFramePickerFilterPreferences(projectId)`.
   - localStorage key: `phn.apertures.frame_picker_filters.v1`.
   - Stored shape:

```json
{
  "project-id": {
    "filterFramesBySide": true,
    "filterFramesByOperation": false
  }
}
```

4. Hook defaults:
   - `filterFramesBySide: true`
   - `filterFramesByOperation: false`
5. Hook failure behavior:
   - Missing storage -> defaults.
   - Invalid JSON -> defaults and overwrite only on the next explicit user
     change.
   - Missing project id -> defaults, no write.
   - `window` unavailable in tests/SSR -> defaults, no throw.

## Tooltip copy

Use concise copy that is still explicit:

- Side filter:
  `Show Head frames for top, Jamb frames for left/right, and Sill frames for bottom. Any-location frames stay visible.`
- Operation filter:
  `Show frames matching the element operation family. Existing frame assignments are not cleared.`

## Edge cases

- localStorage from an older shape must not crash the Apertures page.
- Toggling a checkbox must not close the whole Apertures action menu unless the
  implementer deliberately changes `closeOnSelect`.
- Keyboard activation should mirror button click behavior.

## Verification

- `cd frontend && pnpm exec vitest run src/shared/ui/__tests__/AppMenu.test.tsx`
- Hook test coverage:
  - defaults are side on / operation off;
  - values persist under one project id;
  - another project id gets defaults;
  - invalid JSON does not throw.

## Handoff acceptance

- `AppMenuCheckboxItem` is reusable and tested independently.
- The preference hook can be imported by `AperturesTab` without pulling in
  project-document mutation code.

## Completion evidence

Implemented on 2026-06-27:

- Added `AppMenuCheckboxItem` with `role="menuitemcheckbox"`, `aria-checked`,
  forwarded button props, and default `closeOnSelect=false`.
- Added stable shared CSS for the checkbox marker without changing the existing
  menu grid.
- Added `useFramePickerFilterPreferences(projectId)` with localStorage key
  `phn.apertures.frame_picker_filters.v1`, side-on/operation-off defaults, and
  no writes when the project id is missing.

Verification passed:

```bash
cd frontend && pnpm exec vitest run src/shared/ui/__tests__/AppMenu.test.tsx
cd frontend && pnpm exec vitest run src/features/apertures/__tests__/useFramePickerFilterPreferences.test.ts
```
