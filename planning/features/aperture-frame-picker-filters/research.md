---
DATE: 2026-06-27
TIME: 08:35 EDT
STATUS: Research complete for planning
AUTHOR: Codex
SCOPE: Existing Apertures frame-picker filtering, app menu primitives,
  operation warning behavior, and available persistence patterns.
RELATED:
  - frontend/src/features/apertures/components/FramePicker.tsx
  - frontend/src/features/apertures/hooks/useFrameCatalog.ts
  - frontend/src/features/apertures/picker-filters.ts
  - frontend/src/features/apertures/operation-frame-match.ts
  - frontend/src/features/apertures/hooks/useApertureDimFormat.ts
  - frontend/src/features/apertures/components/ManufacturerFiltersModal.tsx
  - backend/features/project_document/aperture_commands/handlers/manufacturer_filters.py
---

# Research

## Current frame-picker behavior

`FramePicker` currently always computes:

- `location` from side via `locationForSide(side)`;
- `operation` from the element operation via `operationForElement(operation).type`;
- manufacturer allow-list from `useManufacturerFilter("frame_types")`.

It then calls `useFrameCatalog({ location, operation, manufacturers })`.
`useFrameCatalog` forwards those values to `listFrameTypes`, and the backend
frame-types endpoint applies exact case-insensitive `location` and `operation`
column filters with `AND` semantics.

This means the current operation filter is exact, not semantic:

- Fixed element -> `operation=Fixed`.
- Swing element -> `operation=Swing`.
- Slide element -> `operation=Slide`.

Seeded frame catalog rows use labels like `Fixed`, `Casement`, `Tilt-Turn`,
`Inswing`, `Outswing`, `Sliding`, and `Double-Hung`; `Swing` and `Slide` are not
the main seeded operation labels. That is the source of the observed dropdown
narrowing problem.

The picker already protects current selections: it fetches all rows in a second
query and prepends the selected row if active filters would otherwise hide it.

## Current compatibility behavior

Changing an aperture element operation does not clear frames and does not make
them backend-invalid. The backend `setElementOperation` handler only updates
`element.operation`; `pickFrame` only requires a catalog-sourced `FrameRef`.

The only operation compatibility behavior is frontend warning logic in
`operation-frame-match.ts`. That logic is currently exact-string matching
against `formatOperation(element.operation)`. If the dropdown starts treating
`Casement` and `Tilt-Turn` as Swing-family matches, this warning must be updated
to the same family matcher or the UI will allow a row and immediately warn that
it mismatches.

## Existing menu primitive

The Apertures header already uses shared `AppMenu` in `AperturesTab`:

- `DisplayFormatMenuGroup` uses an `AppMenu` with `AppMenuRadioItem`.
- `Aperture actions` uses `AppMenuItem` for HBJSON export and "Configure
  manufacturer filters".

`AppMenu` supports normal items and radio items. It does not currently expose a
checkbox menu item. The least invasive UI primitive is an `AppMenuCheckboxItem`
that reuses `.app-menu__item`, adds `role="menuitemcheckbox"`, and renders a
checkmark/square icon in the existing icon column.

The shared `[data-tooltip]` CSS already exists. `AppMenuItem` forwards button
props, so checkbox items can support `data-tooltip`, `title`, and
`aria-description`.

## Existing persistence patterns

Nearby patterns are not equivalent:

1. `tables.manufacturer_filters`
   - Lives in the project document.
   - Versioned with the draft/saved body.
   - Shared by all users who open that version/draft.
   - Mutated through the aperture command pipeline.
   - Server-validates that in-use manufacturers cannot be stranded.

2. `users.units_preference`
   - Server-backed per-user preference.
   - Exposed through `/api/v1/auth/preferences`.
   - Also mirrored to localStorage for signed-out/bootstrap fallback.

3. Aperture dimension display format
   - `useApertureDimFormat` uses localStorage only.
   - The file explicitly says the intended server user-preference store only
     exists for SI/IP today, so localStorage avoids backend schema work.

4. `user_project_preferences`
   - Documented in context as the intended home for personal per-project
     dashboard preferences.
   - Not implemented in the current backend/alembic/features code searched in
     this checkout.

## Persistence recommendation

The new frame-picker filter toggles are display controls, not project model
truth. Toggling them should not dirty the project document, should not require a
Save, and should not be affected by version lock state.

Recommended first implementation:

- localStorage-backed hook keyed by `project.id`;
- defaults: `filterFramesBySide=true`, `filterFramesByOperation=false`;
- state owned in `AperturesTab` and provided to `FramePicker` through a small
  context/hook, matching the existing manufacturer-filter provider shape.

If cross-browser persistence is required, implement `user_project_preferences`
first and move this hook behind that API. If team-shared/versioned behavior is
required, add a new project-document command, but that is a different product
contract because toggling a picker preference would become a draft mutation.

## Operation-family candidates

Current catalog operations include:

- `Fixed`
- `Inswing`
- `Outswing`
- `Casement`
- `Tilt-Turn`
- `Sliding`
- `Double-Hung`

Requested additions include `Awning` and `Hopper`, which are not currently in
the seeded operation option list. Decision: add both labels to the frame-type
operation option seeds so users can create/edit catalog rows with those
operation labels in the UI.
