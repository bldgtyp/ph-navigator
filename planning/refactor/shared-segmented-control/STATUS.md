---
DATE: 2026-08-03
TIME: 09:16 EDT
STATUS: Active
AUTHOR: Claude with Ed May
SCOPE: State ledger for the shared segmented-control extraction.
RELATED:
  - ./README.md
  - ./PRD.md
---

# STATUS — Shared segmented control

## Current state

`Active`. Migration steps 1-2 are complete: the generic native-radio
`SegmentedControl<T>` exists in `shared/ui`, and `MaterialDriftDialog` consumes
it with its feature CSS removed. `ModalUnitToggle` now delegates to the same
primitive, and its duplicated CSS is gone. The reuse review found and
inventoried a fifth implementation in `StatusItemModal`.

## Next step

Execute migration step 3: move `TopbarUnitToggle` onto the shared primitive,
then run the rendered typography sweep because it appears on every page.

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
