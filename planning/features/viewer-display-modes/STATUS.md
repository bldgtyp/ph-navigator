---
DATE: 2026-07-15
TIME: 20:44 EDT
STATUS: Active
AUTHOR: Claude (Opus 4.8) for Ed May
SCOPE: Disposition + phase map for viewer-display-modes.
RELATED: ./README.md; ./PRD.md
---

# STATUS — Viewer display modes

**State:** Active — captured from the 2026-07-15 UI batch. Not scoped in detail.

## Phase map (proposed)

- **Phase 1 — Spaces material fix (Item 13). ✅ DONE.** Spaces now render fully
  opaque with the exact Building shaded material (white `#ececec`). The knob was
  `baseOpacity`/`baseColor` in `lib/colors.ts` (not `lenses.ts` as first assumed).
  Verified on a render; Ed confirmed opaque + white. On branch
  `feature/spaces-opaque-material` (not yet merged to main).
- **Phase 2 — Airflow on Floor Areas (Item 14). ✅ DONE.** 2-line change
  (`themeState.ts` mode list + `themes.ts` guard); floor segments already carried
  the airflow data. Unit test + render-verified.
- **Phase 3a — ERV research (Item 15 gate). ✅ DONE — verdict: DROPPED.** The
  space→ERV assignment is room-level in HBJSON and discarded at PHN extraction
  (`_spaces_from_model` copies only airflow magnitudes; `_ventilation_systems_from_model`
  dedupes systems, dropping which spaces they serve). Details + minimal upstream
  fix in PRD Item 15.
- **Phase 3b — ERV color mode (Item 15). Backend-first, not yet started.** Needs
  the extraction carry-through (add `ventilation_unit_id` to `SpaceSchema`,
  populate in `_spaces_from_model`) before the frontend color mode. See PRD.

## Next step

Phases 1, 2, 3a done. Item 15 (Phase 3b) remains and is **backend-first**: it
needs a schema/extraction change to carry the space→ERV id before any frontend
coloring — a bigger bite than 14. Ed's call whether to take it now or defer.

## Blockers

- Item 15 (Phase 3b) needs the backend extraction carry-through first (Phase 3a
  found the mapping is DROPPED at PHN translation).

## Verification

- ✅ Item 13: Spaces lens renders solid opaque white, identical to the Building
  shaded material; interiors occluded (section plane to cut in) — confirmed on a
  render.
- ✅ Item 14: Floor Areas lens shows the Ventilation Airflow mode + Supply/Extract/
  None legend and colors floor segments — unit test + render-verified.
- (Item 15, if shipped) ERV mode colors spaces per unit with a correct legend.
- Check draw-call / FPS baseline (~14 calls @ 60 FPS on Hillandale) isn't
  regressed by new materials/modes.
