---
DATE: 2026-08-19
TIME: 19:05 EDT
STATUS: Active — Roadmap complete, Assembly pending
AUTHOR: Codex
SCOPE: Current state of status presentation polish
RELATED:
  - planning/features/status-presentation-polish/PRD.md
---

# STATUS — Status Presentation Polish

**State:** `Active`; Roadmap presentation is complete and Assembly moisture
presentation is next.

## Completed

### Phase 1 — Roadmap status control

- Replaced the `x` / `o` / `-` rail symbols with Done / To-Do / N/A.
- Removed the duplicate title-adjacent status badge.
- Preserved editor state cycling, next-action accessible names, viewer labels,
  drag/reorder controls, dates, menus, and notes.
- Expanded the rail and centered the timeline through the wider label control.
- Verified with
  `pnpm --dir frontend exec vitest run src/features/project_status/components/StatusItemRow.test.tsx src/features/project_status/lib.test.ts`
  (14 tests passed).

## Next step

Write focused failing tests for:

1. anonymous Assembly header does not render or query Moisture;
2. signed-in Assembly header retains a compact clickable detail status.

Identify the current session/auth discriminator before implementing the
anonymous guard; do not approximate it with edit permission.

## Verification

- [x] Roadmap state-cycle and accessible-name RTL.
- [x] Viewer/static Roadmap state labels.
- [ ] Desktop/narrow timeline geometry browser checks.
- [ ] Condensation loading/success/warning/danger/unavailable label tests.
- [ ] Anonymous no-render/no-query test.
- [ ] Locked and authenticated read-only visibility test.
- [ ] Mounted signed-in and signed-out Envelope checks after
      `make agent-browser-ready`.
- [ ] Focused frontend gate and Graphify update.

## Coordination

Roadmap CSS may overlap the active
`planning/refactor/overview-documentation-progress/` branch. Preserve that
packet's heading/typography work while changing only the milestone state rail.

## Blockers

None, once the auth/session seam is confirmed.
