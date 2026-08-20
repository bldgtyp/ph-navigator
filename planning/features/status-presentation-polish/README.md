---
DATE: 2026-08-19
TIME: 19:05 EDT
STATUS: Active — implementation complete, browser verification pending
AUTHOR: Ed May / Codex
SCOPE: Roadmap status controls and Envelope moisture-status presentation
RELATED:
  - planning/features/status-presentation-polish/PRD.md
  - planning/features/status-presentation-polish/STATUS.md
  - planning/2026-08-19-ui-batch.md
---

# Status Presentation Polish

Two status surfaces currently use more chrome than meaning:

- Roadmap repeats state as an ambiguous `X`/`O` rail glyph and a second badge
  beside the milestone title.
- Envelope wraps condensation state in a large nested chip that overwhelms the
  Total thickness/Thermal row, and exposes an incompletely supported Moisture
  surface to anonymous viewers.

This packet replaces both with direct text and keeps one clear interaction per
status.

## Read order

1. `PRD.md` — behavior, auth, and accessibility contract.
2. `STATUS.md` — next step and verification ledger.

## Current-code anchors

- `frontend/src/features/project_status/components/StatusItemRow.tsx`
- `frontend/src/features/project_status/project_status.css`
- `frontend/src/features/project_status/lib.ts`
- `frontend/src/features/envelope/components/AssemblyHeader.tsx`
- `frontend/src/features/envelope/components/CondensationStatusButton.tsx`
- `frontend/src/features/envelope/envelope.css`

`StatusItem` also supports `na`; the revised left rail must say `N/A` rather
than silently dropping that third domain state.
