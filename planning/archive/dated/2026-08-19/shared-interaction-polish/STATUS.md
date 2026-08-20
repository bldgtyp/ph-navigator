---
DATE: 2026-08-19
TIME: 20:47 EDT
STATUS: Complete — implemented, verified, and archived
AUTHOR: Codex
SCOPE: Current state of shared interaction polish
RELATED:
  - planning/archive/dated/2026-08-19/shared-interaction-polish/PRD.md
---

# STATUS — Shared Interaction Polish

**State:** `Complete`; implementation, verification, docs pass, and archive
cleanup finished on `codex/shared-interaction-polish`.

## Outcome

- `SegmentedControlOption<T>` now accepts explicit tooltip content. Small,
  equal-width controls fall back to `ariaLabel ?? label`, use the shared medium
  delay, and paint an obvious tokenized hover background without layout shift.
- Shared `Tooltip` positioning now uses a Radix anchor instead of a trigger, so
  native radios receive `aria-describedby` without acquiring popover/dialog
  ARIA or losing their native keyboard contract.
- The reported ReportTable notch was not reproducible. Mounted Envelope
  Materials and Aperture U-Values consumers measured a `0px` sibling seam and
  `0px` left/right edge deltas. First, middle, and last rows all matched; the
  800px viewport smoke retained opaque sticky lanes after `scrollLeft = 260`.
  No ReportTable CSS was changed.
- A Vite-served Playwright fixture mounts the production `ReportTable` and
  preserves the geometry, row-action/no-action, horizontal-scroll, and nested
  non-sticky contracts.

## Next step

No implementation work remains. Merge/deploy are separate operator decisions.

## Verification

- [x] SegmentedControl Vitest: native keyboard/change/disabled behavior.
- [x] Tooltip delay, focus reachability, and viewport placement.
- [x] Interaction-state guard/baseline update for the new selected-hover rule.
- [x] Production ReportTable fixture with rendered seam geometry assertions.
- [x] Browser geometry/screenshots on Envelope Materials and Aperture U-Values.
- [x] Horizontal-scroll frozen-lane smoke.
- [x] `make frontend-dev-check` plus focused frontend tests.
- [x] `graphify update .` after the final docs diff.

## Blockers

None.
