---
DATE: 2026-06-27
TIME: 08:56 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Apertures actions menu wiring and picker preference context.
RELATED:
  - planning/features/aperture-frame-picker-filters/phases/phase-01-menu-preferences.md
  - frontend/src/features/apertures/routes/AperturesTab.tsx
  - frontend/src/features/apertures/hooks/useManufacturerFilter.ts
  - frontend/src/features/apertures/components/FramePicker.tsx
---

# Phase 02 - Actions Menu Context

## Goal

Expose the two user controls in the existing Aperture actions menu and make the
current preferences available to `FramePicker`.

## Expected source edits

- `frontend/src/features/apertures/routes/AperturesTab.tsx`
- new `frontend/src/features/apertures/hooks/useFramePickerFilters.ts` or
  similarly named context file
- `frontend/src/features/apertures/components/FramePicker.tsx`
- focused Apertures route/component tests if an existing test harness can mount
  `AperturesTab` cheaply

## Implementation plan

1. In `AperturesTab`, call
   `useFramePickerFilterPreferences(project.id)`.
2. Add two `AppMenuCheckboxItem` rows to the existing
   `<AppMenu label="Aperture actions">`.
   - Place them near "Configure manufacturer filters" because all three affect
     picker visibility.
   - Keep HBJSON export behavior unchanged.
   - Do not hide these local display controls for viewers/locked versions.
3. Add a small context/provider for frame picker filter preferences.
   - Follow the `ManufacturerFilterProvider` shape.
   - Provider value:

```ts
type FramePickerFilterContextValue = {
  filterFramesBySide: boolean;
  filterFramesByOperation: boolean;
};
```

4. Mount the provider in `AperturesTab` near `ManufacturerFilterProvider`.
5. Add a consumer hook used by `FramePicker`.
   - Return defaults when no provider exists so isolated tests keep rendering.
6. Keep the explicit `manufacturers` prop on `FramePicker` as-is.
   - It is useful for isolated tests and should continue to override context
     manufacturer filters.

## UI labels

- `Filter frames by side`
- `Filter frames by operation`

## Edge cases

- Two browser tabs do not need live localStorage synchronization.
- Viewers can toggle preferences locally; no backend write is involved.
- The menu trigger keeps the existing `.app-menu__trigger` surface.
- This phase should not change actual picker filtering yet; it only wires
  state into the picker.

## Verification

- Component test that the menu renders both checkbox rows with default states:
  - side checked;
  - operation unchecked.
- Component/hook test that toggling rows updates localStorage under the current
  project id.
- Existing `AppMenu` tests still pass.

## Handoff acceptance

- The Aperture actions menu exposes both controls.
- `FramePicker` can read the preferences but can still render without a
  provider.
- No project document mutation fires when either checkbox is toggled.
