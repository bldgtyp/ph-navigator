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
- **Phase 3b — ERV color mode (Item 15). ✅ DONE.** Backend carry-through
  (`SpaceSchema.ventilation_unit_id/_name` + `_spaces_from_model`) plus the
  frontend `"ventilation-unit"` mode on both space lenses — stable hash-based
  hues (shared `hashedColor` engine), dynamic per-unit legend. Backend + frontend
  tests; render-verified. Forward-only (existing artifacts show grey until
  re-extracted; `/model_data` is immutably cached per `asset_id`).

## Next step

All items (13, 14, 15) done and committed on `feature/spaces-opaque-material`.
Ready to merge to `main` (note: `main` no longer auto-deploys prod — deploys are
now a manual workflow, so merging is safe). Item 15 is forward-only: to color
existing production models, their `/model_data` artifacts must be re-extracted.

## Blockers

- None. (Item 15 is forward-only by design — see Next step.)

## Verification

- ✅ Item 13: Spaces lens renders solid opaque white, identical to the Building
  shaded material; interiors occluded (section plane to cut in) — confirmed on a
  render.
- ✅ Item 14: Floor Areas lens shows the Ventilation Airflow mode + Supply/Extract/
  None legend and colors floor segments — unit test + render-verified.
- ✅ Item 15: Ventilation Unit mode colors spaces/floor segments per ERV with a
  per-unit hashed-color legend — backend + frontend tests + render-verified.
- Check draw-call / FPS baseline (~14 calls @ 60 FPS on Hillandale) isn't
  regressed by new materials/modes.
