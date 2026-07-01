---
DATE: 2026-07-01
TIME: 16:20 EDT
STATUS: Complete; implemented, verified, and docs-pass folded back.
AUTHOR: Claude (for Ed)
SCOPE: Status ledger for the MEP element-selection feature.
RELATED: README.md, PRD.md, PLAN.md, phases/
---

# Model Viewer — MEP Element Selection & Length Reporting — Status

## Current state

`Complete.` PRD authored 2026-07-01 from a
full read of the current Ventilation/Hot Water lens implementation
(`frontend/src/features/model_viewer/`), the backend `model_viewer`
schemas/extraction, and the upstream `honeybee_phhvac` source
(`ducting.py`, `hot_water_piping.py`, `hot_water_system.py`). Ed
reviewed and accepted the PRD same-day, including a refinement to the
row/segment interaction model (PRD §6 — hover in 3D syncs to the
table row transiently; clicking a table row sets a sticky 3D focus)
that was worked through in conversation and folded back into the PRD.

Five implementation phases authored in `phases/`, each a self-
contained subagent handoff (required reading, work breakdown with
file:line references, verification gate, exit criteria) mirroring the
archived MVP model-viewer feature's phase-doc format:

1. `phase-01-backend-total-length.md` — backend `length` fields.
2. `phase-02-element-selection-highlight.md` — element-level
   selection/highlight/camera + base inspector card.
3. `phase-03-row-segment-focus-linking.md` — the row↔3D focus
   behavior + four-tier highlight color model.
4. `phase-04-dimension-lines.md` — optional/cuttable dimension-line
   overlays.
5. `phase-05-verification-closeout.md` — full cross-lens
   verification + repo closeout (runs regardless of Phase 4).

Phase 1 code changes are implemented and verified:

- `backend/features/model_viewer/schemas/ladybug_geometry.py` exposes
  a non-serialized `LineSegment3DSchema.vector_length` helper.
- `backend/features/model_viewer/schemas/honeybee_phhvac.py` exposes
  cached Pydantic computed `length` fields for duct segments and duct
  elements, and declares the upstream hot-water pipe element aggregate
  fields (`length`, `water_temp`, `daily_period`, `material_name`,
  `diameter`).
- `frontend/src/features/model_viewer/types.ts` mirrors the new wire
  fields.
- `backend/tests/test_model_viewer_extraction.py` now asserts duct
  segment/element lengths, pipe element aggregate fields for trunk /
  branch / fixture / recirc, and Hillandale-scale MEP length coverage
  when the licensed local fixture is present.
- `frontend/src/features/model_viewer/__tests__/viewerCore.test.ts`
  fixture DTOs now carry the required fields.

**Known-good finding baked into Phase 1:** pipe element total length
is already computed by `honeybee_phhvac` and already present in the
extraction dict — `extraction.py` already calls
`to_dict(_include_properties=True)` for hot water, and the flag was
verified (by reading `hot_water_system.py`, `hot_water_piping.py`'s
Branch/Trunk `to_dict` methods) to propagate through every tree depth
(trunk/branch/fixture/recirc). It's dropped today only because
`PhHvacPipeElementSchema` doesn't declare a `length` field. Duct
element length has no upstream serialization at all; Phase 1
recommends computing it locally in PHN via a Pydantic `@computed_field`
rather than blocking on an upstream `honeybee_ph` release.

Phase 2 code changes are implemented and verified:

- `frontend/src/features/model_viewer/lib/selection.ts` exposes
  `elementIdForSegmentId`, deriving stable parent element IDs from
  duct/pipe segment renderable IDs while returning `null` for other
  object families.
- `frontend/src/features/model_viewer/loaders/lineElements.ts`
  builds duct/pipe segment renderables and one `ElementSummary` per
  MEP element, preserving source segment order in `segmentIds`.
- `frontend/src/features/model_viewer/loaders/building.ts` now exposes
  `BuildingModel.elementsById` beside `metaById`.
- `frontend/src/features/model_viewer/scene/BuildingLens.tsx` resolves
  duct/pipe segment clicks and double-click zooms to the parent
  element ID. Selected/hovered state applies to every segment in that
  element while retaining the literal hovered segment ID for Phase 3.
- `frontend/src/features/model_viewer/scene/CameraRig.tsx` zooms
  element selections to union bounds across all segment vertices.
- `frontend/src/features/model_viewer/components/ElementInspectorPanel.tsx`
  renders the base element card: header, copy ID, zoom, Total Length,
  ordered segment table, and click-to-expand segment detail using the
  existing duct/pipe segment field configs.
- `frontend/src/features/model_viewer/components/InspectorPanel.tsx`
  shares the field-row renderer with element row details.
- `frontend/src/features/model_viewer/lib/debugHook.ts` exposes
  `elementIds` and maps debug selection helpers to parent element IDs
  for duct/pipe segment renderables.
- `frontend/tests/e2e/model-viewer-lenses.spec.ts` asserts that
  Ventilation and Hot Water segment selection resolves to an
  `element:*` selection ID and renders the new element inspector.

Phase 3 code changes are implemented and verified:

- `frontend/src/features/model_viewer/store.ts` adds
  `focusedSegmentId` and `toggleFocusedSegment`, clearing focus on the
  same teardown paths that clear selection.
- `frontend/src/features/model_viewer/lib/selection.ts` adds
  `resolveLineHighlightTier` for the default / hover-element /
  selected-soft / hover-segment / focused line tiers.
- `frontend/src/features/model_viewer/scene/BuildingLens.tsx` threads
  `ViewerTokens` into line renderables and uses the resolver for
  token-aware line color/width tiers.
- `frontend/src/features/model_viewer/components/ElementInspectorPanel.tsx`
  replaces local row expansion with store-backed focused segment
  state, syncs row hover to `hoverId`, and scrolls 3D-hovered rows
  into view.
- `frontend/src/features/model_viewer/lib/debugHook.ts` exposes
  `focusedSegmentId`, segment IDs by element, row-hover helpers,
  focus toggling, and line-tier inspection for browser tests.
- `frontend/src/features/model_viewer/__tests__/viewerElements.test.ts`
  covers tier precedence, including focused-over-hover and hovering
  another element while a different element is selected.
- `frontend/src/features/model_viewer/__tests__/viewerFocusStore.test.ts`
  covers focus toggling and reset semantics.
- `frontend/tests/e2e/model-viewer-lenses.spec.ts` asserts hovered
  row class, sticky focused segment, focused tier, and focus
  persistence through a canvas orbit.

Phase 4 code changes are implemented and verified:

- `frontend/src/features/model_viewer/lib/dimensionLines.ts` adds
  pure dimension-line geometry construction, a stable head-on offset
  fallback, offset-distance tuning, and selected-segment primitive
  counts.
- `frontend/src/features/model_viewer/scene/DimensionOverlay.tsx`
  renders selection-scoped extension lines, dimension lines, end
  ticks, and canvas-scoped unit-aware labels.
- `frontend/src/features/model_viewer/scene/BuildingLens.tsx` mounts
  the overlay only for selected Ventilation/Hot Water elements.
- `frontend/src/features/model_viewer/model_viewer.css` adds the
  quieter `.model-dimension-label` style.
- `frontend/src/features/model_viewer/__tests__/dimensionLines.test.ts`
  covers normal geometry, degenerate head-on geometry, offset tuning,
  and selected-element primitive-count scaling.
- `frontend/tests/e2e/model-viewer-lenses.spec.ts` asserts dimension
  labels render for the selected pipe element and disappear on lens
  switch.

Phase 5 closeout is complete:

- Segment dict insertion order was verified against both canonical and
  Hillandale fixtures. It is **not** a reliable start-to-end physical
  path order: canonical has 2 broken multi-segment elements out of 3;
  Hillandale has 61 broken multi-segment elements out of 94. The `#`
  column now ships/documented as stable display order only.
- `frontend/src/features/model_viewer/loaders/lineElements.ts`
  records the stable-display-order invariant where `segmentIds` are
  built.
- `PRD.md` §13 was moved from open question to settled note; the
  remaining role-chip / dimension-label tuning items stay explicit
  follow-up questions.
- `context/user-stories/40-model-viewer.md` and
  `context/GLOSSARY.md` were amended with the shipped MEP element /
  MEP segment behavior.

## Next step

Ready to archive after merge per `planning/.instructions.md`.

## Acceptance criteria

PRD §14 closeout, recorded 2026-07-01:

1. Pass — Ventilation duct segment click selects/highlights the full
   duct element.
2. Pass — Hot Water pipe segment click selects/highlights the full
   pipe element; backend coverage includes trunk, branch, fixture, and
   recirc length fields.
3. Pass — pre-selection segment hover previews the whole MEP element.
4. Pass — inspector shows element type, display name, and active-unit
   Total Length without scrolling.
5. Pass — inspector shows a stable per-segment table with display
   index and length; full segment fields remain reachable by row
   expand.
6. Pass — selected-element 3D hover syncs to the table row; hovering
   another element does not affect the open table.
7. Pass — row click sets sticky segment focus, expands detail, and
   persists through camera orbit; same-row click clears and another
   row swaps focus.
8. Pass — `focusedSegmentId` resets on selection/file/lens teardown.
9. Pass — Zoom to and copy-ID resolve the element, not one segment.
10. Pass — duct element length is computed from segment geometry and
    verified against fixture math.
11. Pass — pipe element length is wired from upstream aggregate
    fields and verified at trunk/branch/fixture/recirc depths.
12. Pass — dimension lines render only for selected MEP element
    segments, follow active units, and tear down on lens switch.
13. Pass — `make ci` green and full model-viewer Chromium sweep green.

## Verification evidence

Passed 2026-07-01:

- `cd backend && uv run ruff format --check . && uv run ruff check . &&
  uv run ty check`
- `cd backend && uv run python - <<'PY' ...` canonical
  `ph_nav_v2_example.hbjson` extraction smoke confirming duct and pipe
  length fields serialize in `model_dump(mode="json", by_alias=True)`.
- `cd frontend && pnpm exec prettier --check
  src/features/model_viewer/__tests__/viewerCore.test.ts
  src/features/model_viewer/types.ts`
- `cd frontend && pnpm exec tsc -b --pretty false && pnpm exec vitest
  run src/features/model_viewer/__tests__/viewerCore.test.ts`
- `make format`
- `make ci`:
  - backend: 1250 passed, 7 skipped, 1 warning
  - frontend: 216 test files passed, 1989 tests passed; production
    build completed
- `cd frontend && pnpm exec tsc -b --pretty false`
- `cd frontend && pnpm exec vitest run
  src/features/model_viewer/__tests__/viewerCore.test.ts
  src/features/model_viewer/__tests__/viewerElements.test.ts`
- `cd frontend && pnpm run check:all`
- `cd frontend && pnpm exec playwright test
  tests/e2e/model-viewer-lenses.spec.ts --project=chromium`
- `make format`
- `make ci`:
  - backend: 1250 passed, 7 skipped, 1 warning
  - frontend: 217 test files passed, 1991 tests passed; production
    build completed
- `graphify update .`
- `cd frontend && pnpm exec tsc -b --pretty false`
- `cd frontend && pnpm exec vitest run
  src/features/model_viewer/__tests__/viewerElements.test.ts
  src/features/model_viewer/__tests__/viewerFocusStore.test.ts`
- `cd frontend && pnpm run lint` (0 errors, existing 15 warnings)
- `cd frontend && pnpm run check:all`
- `cd frontend && pnpm exec playwright test
  tests/e2e/model-viewer-lenses.spec.ts --project=chromium`
- `make format`
- `make ci`:
  - backend: 1250 passed, 7 skipped, 1 warning
  - frontend: 218 test files passed, 2003 tests passed; production
    build completed
- `graphify update .`
- `cd frontend && pnpm exec tsc -b --pretty false`
- `cd frontend && pnpm exec vitest run
  src/features/model_viewer/__tests__/dimensionLines.test.ts`
- `cd frontend && pnpm run lint` (0 errors, existing 15 warnings)
- `cd frontend && pnpm run check:all`
- `cd frontend && pnpm exec playwright test
  tests/e2e/model-viewer-lenses.spec.ts --project=chromium`
- `make format`
- `make ci`:
  - backend: 1250 passed, 7 skipped, 1 warning
  - frontend: 219 test files passed, 2007 tests passed; production
    build completed
- `graphify update .`
- `cd frontend && pnpm exec playwright test
  tests/e2e/model-viewer-files.spec.ts
  tests/e2e/model-viewer-lenses.spec.ts
  tests/e2e/model-viewer-themes.spec.ts
  tests/e2e/model-viewer-measure.spec.ts
  tests/e2e/model-viewer-site-sun.spec.ts --project=chromium`
  - 6 passed
- Browser screenshot walkthrough saved:
  - `assets/phase-05-duct-element-selection.png`
  - `assets/phase-05-pipe-fixture-selection.png`
  - `assets/phase-05-focused-segment-row.png`
  - `assets/phase-05-dimension-lines.png`
- `make format`
- `make ci`:
  - backend: 1250 passed, 7 skipped, 1 warning
  - frontend: 219 test files passed, 2007 tests passed; production
    build completed
- `graphify update .`

## Blockers

None.

## Note on an in-session file-loss incident (2026-07-01)

Partway through authoring `PLAN.md`/`phases/`, this folder's four
top-level files (`README.md`, `PRD.md`, `STATUS.md`, `PLAN.md`) were
found deleted from disk mid-session — only `phases/` (already written)
survived. No git history, no Dropbox conflicted-copy file, nothing
renamed; `git status` showed the whole folder as a single untracked
entry both before and after. Cause not determined — flagged to Ed as
consistent with this repo's known concurrent-editing pattern
(see agent memory `feedback_concurrent_committer`), but the selective
nature (four files gone, one subfolder untouched) doesn't cleanly
match a `git clean`-style explanation either. All four files were
recreated verbatim from conversation context with no content loss.
If this happens again, it's worth investigating with `fs_usage` or
Dropbox's own event history rather than assuming it won't recur.
