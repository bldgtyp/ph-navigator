---
DATE: 2026-07-02
TIME: 14:25 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Current state for Apertures / Frames grouping.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
---

# STATUS - Apertures Frames Grouping

## State

`Complete` - Frames report rows now default-group by `manufacturer`, can
regroup by durable `brand`, and can be returned to an ungrouped view from the
Frames report toolbar.

## Next Step

None. The packet is archived under
`planning/archive/dated/2026-07-02/apertures-frames-grouping/`.

## Blockers

None known.

## Verification Ledger

- PASS - `pnpm --dir frontend exec vitest run src/features/apertures/__tests__/ApertureSpecReportPanel.test.tsx`
- PASS - `make frontend-dev-check`
- PARTIAL - Playwright login and `/api/v1/projects` access worked with
  `codex@example.com`; no local project exposed `project_frames` rows for a
  populated Frames route smoke.
