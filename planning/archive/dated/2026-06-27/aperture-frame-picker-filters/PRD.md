---
DATE: 2026-06-27
TIME: 08:35 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Product and behavior contract for Apertures Builder frame-picker filter
  controls.
RELATED:
  - planning/features/aperture-frame-picker-filters/research.md
  - planning/features/aperture-frame-picker-filters/PLAN.md
---

# PRD - Aperture Frame Picker Filters

## Goal

Make the frame assignment dropdowns easier to use without hiding valid catalog
choices by default. Side filtering remains helpful and stays on by default.
Operation filtering becomes optional and off by default because the catalog
operation taxonomy is more detailed than the aperture element's simple
Fixed/Swing/Slide model.

## Behavior contract

### D1 - Add "Filter frames by side"

Add a checkbox-style item to the existing Aperture actions `AppMenu`:

- Label: `Filter frames by side`
- Default: checked/on.
- Persistence: per project, per current persistence decision.
- Tooltip: explain that top rows show Head frames, bottom rows show Sill
  frames, and left/right rows show Jamb frames.

When on:

| Aperture side | Catalog location filter |
|---|---|
| top | Head plus Any |
| right | Jamb plus Any |
| bottom | Sill plus Any |
| left | Jamb plus Any |

When off, do not apply a catalog `location` filter. All active frame catalog
locations can appear, including Mull-H, Mull-V, and Any.

Decision: `location=Any` frames appear under every side even when side filtering
is on.

### D2 - Add "Filter frames by operation"

Add a checkbox-style item to the existing Aperture actions `AppMenu`:

- Label: `Filter frames by operation`
- Default: unchecked/off.
- Persistence: per project, per current persistence decision.
- Tooltip: explain that this narrows frame choices to the element's operation
  family; assigned frames are not cleared if the operation changes.

When off, do not apply any frame catalog operation filter.

When on, filter by operation family:

| Element operation | Matching catalog operations |
|---|---|
| Fixed (`operation=null`) | Fixed |
| Swing | Swing, Inswing, Outswing, Casement, Awning, Hopper, Tilt-Turn, Double-Hung |
| Slide | Slide, Sliding, Double-Hung |

The matcher should normalize case, whitespace, hyphen/space variants where
reasonable, and preserve existing catalog labels. This is a display filter, not
a catalog migration.

Decision: Double-Hung appears in both Swing and Slide operation filters.

### D3 - Existing selections remain valid and visible

Changing either filter must not clear `element.frames.top/right/bottom/left`.
Changing an element from Swing to Fixed must not clear assigned frames.

If the selected frame does not match current filters, the picker still shows the
selected row so the user can see and change the assignment. This preserves the
existing `FramePicker` behavior.

### D4 - Warning logic uses the same operation-family matcher

The operation mismatch warning must stop using exact string equality for
catalog operations that are intentionally grouped by the new operation-family
filter.

Examples:

- Swing element + Casement frame: no mismatch.
- Swing element + Tilt-Turn frame: no mismatch.
- Fixed element + Casement frame: mismatch warning.
- Slide element + Sliding frame: no mismatch.
- Slide element + Fixed frame: mismatch warning.

The warning remains a nudge, not enforcement.

### D5 - Filter composition

Frame picker options compose these filters:

1. manufacturer filters from `tables.manufacturer_filters`;
2. side filter, when enabled;
3. operation-family filter, when enabled.

The picker option description must continue to show manufacturer, location, and
operation so users can understand what they are selecting, especially when side
or operation filtering is off.

### D6 - Persistence recommendation

Recommended first implementation:

- Store these toggles as local browser preferences keyed by `project.id`.
- Do not write them into `body.tables`.
- Do not mark the draft dirty.
- Do not hide them from Viewers, because they are local display controls.

Reason: the settings are user display preferences, not project model state.
The repo's documented `user_project_preferences` table/API is not implemented
yet. If server-backed per-user/per-project persistence is desired, build that
infrastructure first and route this hook through it.

Alternative if Ed wants shared/versioned behavior:

- Add a new document section such as `tables.aperture_picker_filters`.
- Add an aperture command such as `setAperturePickerFilters`.
- Treat changes as draft mutations and hide/disable writes for Viewer/locked
  states.

That alternative is intentionally not the recommended first step.

## Edge cases

- Current selected frame hidden by filters: keep it visible and selected.
- Manufacturer filters plus new filters produce zero rows: show a filter-aware
  empty state or hint, not only "No catalog frames available."
- `location=Any`: include in every side-filtered dropdown.
- Mullion rows: when side filtering is off, Mull-H/Mull-V rows can appear even
  though the side slots are Head/Jamb/Sill assignments.
- Operation taxonomy drift: imported catalogs may contain labels not in the
  seed list. Unknown labels should be excluded only when operation filtering is
  on, and visible when operation filtering is off.
- Awning/Hopper catalog creation: add both labels to `FRAME_TYPE_OPTION_SEEDS`
  and tests.
- Double-Hung family: include in both Swing and Slide filters.
- Multiple browser tabs: localStorage changes do not need real-time sync for
  this feature.
- SSR/test environments: hooks must tolerate `window` absence and fall back to
  defaults.

## Non-goals

- No backend validity rule that frame operation must match element operation.
- No automatic replacement of "wrong" frames.
- No U-value recalculation caused by filter toggles.
- No rewrite of manufacturer filter modal behavior.
