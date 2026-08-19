---
DATE: 2026-08-19
TIME: 19:05 EDT
STATUS: Draft — not started
AUTHOR: Codex
SCOPE: Current state of shared interaction polish
RELATED:
  - planning/features/shared-interaction-polish/PRD.md
---

# STATUS — Shared Interaction Polish

**State:** `Active` planning; no code written.

## Next step

Add focused shared-component tests first:

1. a SegmentedControl option exposes shared delayed tooltip content while native
   radio semantics remain intact;
2. a mounted ReportTable fixture reproduces and measures the reported visual
   notch across first/middle/last rows without relying on Envelope-specific CSS.

Then adjust shared CSS and verify representative mounted consumers.

## Verification

- [ ] SegmentedControl Vitest: native keyboard/change/disabled behavior.
- [ ] Tooltip delay, focus reachability, and viewport placement.
- [ ] Interaction-state guard/baseline update with an explicit reason.
- [ ] ReportTable structure tests plus rendered seam geometry/screenshot checks.
- [ ] Browser geometry/screenshots on Envelope Materials and Aperture U-Values.
- [ ] Horizontal-scroll frozen-lane smoke.
- [ ] `make frontend-dev-check` plus focused frontend tests.
- [ ] `graphify update .` and design-system docs pass.

## Blockers

None. Both fixes are frontend-only shared-component work.
