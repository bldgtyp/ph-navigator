---
DATE: 2026-08-03
TIME: 09:16 EDT
STATUS: In review
AUTHOR: Claude with Ed May
SCOPE: State ledger for the shared segmented-control extraction.
RELATED:
  - ./README.md
  - ./PRD.md
---

# STATUS — Shared segmented control

## Current state

`In review`. All five migration/design-system steps are complete: the generic native-radio
`SegmentedControl<T>` exists in `shared/ui`, and `MaterialDriftDialog` consumes
it with its feature CSS removed. `ModalUnitToggle` now delegates to the same
primitive, and its duplicated CSS is gone. The reuse review found and
inventoried a fifth implementation in `StatusItemModal`. Both compact unit
toggles and both content-scale single-select groups now use the shared
primitive. True tablist consumers remain separate.

## Next step

Run the implement-loop final completion cleanup: mark the packet complete,
archive it, update planning indexes, and verify no stale active links remain.

## Blockers

None.

## Sequencing note

`planning/refactor/aperture-catalog-drift-ux-parity/` will want a segmented
control for its refresh dialog. If both are scheduled, land this one first so
apertures consumes the primitive instead of copying `.drift-choice` and making
a sixth implementation.

## Verification recipe

Every migration step is a pure visual refactor, so the bar is "no unintended
pixel change":

1. Screenshot each affected control **before** touching it —
   `cd frontend && node scripts/agent-browser.mjs <route> --out /tmp/before-<n>.png`
   (see `context/USING_A_WEB_BROWSER.md`; `make agent-browser-ready` first).
2. Migrate one implementation.
3. Screenshot the same routes and diff by eye.
4. `make ci` — `check:typography` and `check:css-vars` catch off-system values
   the eye misses; `make typography-eval` covers the rendered sweep for the
   topbar toggle, which appears on every page.

## Log

- **2026-08-03** — Packet created. Four implementations inventoried; API,
  migration order, and three open questions recorded in `PRD.md`.
- **2026-08-03** — Step 1 complete. Added the generic shared primitive, native
  radio/disabled-state tests, and migrated `MaterialDriftDialog`; removed 59
  lines of `.drift-choice` CSS. Locked Q1-Q3 decisions. Reuse review found the
  project-status Edit/Preview switch as a fifth migration target and caught a
  global class collision before commit; the shared BEM root is now namespaced
  `.phn-segmented-control`. Verification: focused Vitest (2 tests), `tsc -b`,
  `pnpm run check:all`, and `make frontend-dev-check` all passed. A topbar
  baseline screenshot was saved at
  `/tmp/shared-segmented-control-before-topbar.png`; the seeded fixture has no
  project materials, so it could not expose the drift dialog for a baseline.
- **2026-08-03** — Step 2 complete. `ModalUnitToggle` now delegates to the
  shared primitive with its existing ids and accessible labels preserved;
  deleted the `.modal-unit-toggle` selector family. Focused tests, `tsc -b`,
  and `pnpm run check:all` passed. The mounted Segment Properties dialog kept
  the same 56×30 geometry, selected SI state, and visual appearance; screenshots:
  `/tmp/shared-segmented-control-before-modal-unit.png` and
  `/tmp/shared-segmented-control-after-modal-unit.png`.
- **2026-08-03** — Step 3 complete. `TopbarUnitToggle` now uses the shared
  32px equal-width variant; removed the old selector family except for the
  topbar parent's narrow `order: 2` layout rule. Mounted verification preserved
  70×38 geometry, flex order, SI selection, and appearance; screenshots:
  `/tmp/shared-segmented-control-before-topbar.png` and
  `/tmp/shared-segmented-control-after-topbar.png`. `make typography-eval`
  collected 22/22 states and held at 28/29 site-wide variants. Native radio
  labels extended an already-blessed variant into the inferred label role, so
  the documented role-reach budget moved 5→6; the evaluator and static guards
  pass. Simplify's reuse review suggested a unit-specific wrapper for the two
  two-option configurations; this was deliberately not added because the
  controlled modal and preference-owned topbar adapters have different
  id/title/size contracts and share all behavior through `SegmentedControl`.
- **2026-08-03** — Step 4 complete. Migrated the condensation profile-axis
  selector and status Description Edit/Preview switch to the shared `md`
  variant; deleted their pressed-button CSS. Kept `CondensationRiskModal` and
  `SegmentMaterialPicker` on `.pill-tab` because both expose tablists and
  tabpanels. Focused Vitest: 9/9 passed across the primitive, condensation
  panels, and new status-modal coverage; `tsc -b` and `pnpm run check:all`
  passed. Mounted status verification switched Preview in a 140×32 native
  radiogroup and revealed the preview panel. The seeded assembly lacks climate
  data, so the profile-axis control was verified through its focused mounted
  component test rather than the live route.
- **2026-08-03** — Step 5 complete. Registered `SegmentedControl` in
  `context/DESIGN_SYSTEM.md` and `shared/ui/SegmentedControl.css` in the style
  ownership table; normalized feature consumers to the documented `shared/ui`
  barrel. Full `make ci` passed after updating one stale `aria-checked`
  assertion to the native-radio `toBeChecked()` contract: backend 1,822 passed
  / 7 skipped; frontend 2,396 passed; production build and all static gates
  passed. `graphify update .` completed. Final grep leaves `.pill-tab` only in
  `CondensationRiskModal` and `SegmentMaterialPicker`, both true tablists.
