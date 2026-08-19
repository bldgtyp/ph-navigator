---
DATE: 2026-08-19
TIME: 19:05 EDT
STATUS: Draft — not started
AUTHOR: Codex
SCOPE: Current state of status presentation polish
RELATED:
  - planning/features/status-presentation-polish/PRD.md
---

# STATUS — Status Presentation Polish

**State:** `Active` planning; no code written.

## Next step

Write focused failing tests for:

1. Roadmap visible text contains Done/To-Do/N/A and no duplicate status badge;
2. anonymous Assembly header does not render or query Moisture;
3. signed-in Assembly header retains a compact clickable detail status.

Identify the current session/auth discriminator before implementing the
anonymous guard; do not approximate it with edit permission.

## Verification

- [ ] Roadmap state-cycle and accessible-name RTL.
- [ ] Viewer/static Roadmap state labels.
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
