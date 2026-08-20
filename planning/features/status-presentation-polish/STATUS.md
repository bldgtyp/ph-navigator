---
DATE: 2026-08-19
TIME: 19:05 EDT
STATUS: Active — implementation complete, browser verification pending
AUTHOR: Codex
SCOPE: Current state of status presentation polish
RELATED:
  - planning/features/status-presentation-polish/PRD.md
---

# STATUS — Status Presentation Polish

**State:** `Active`; implementation and focused automated verification are
complete. Integrated browser verification is next.

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

### Phase 2 — Assembly moisture status

- Replaced the nested condensation chip with a compact text button while
  preserving all result labels, tones, accessible names, and the detail action.
- Derived `showMoisture` from the resolved session audience policy and used the
  same boolean for query enablement, header rendering, and modal rendering.
- Anonymous/session-unresolved paths render no Moisture wrapper and start no
  condensation request; authenticated locked-Version and read-only users retain
  the metric.
- Recorded the temporary public-moisture boundary in
  `context/ui/pages/envelope-tab.md` and beside the code guard.
- Verified with
  `pnpm --dir frontend exec vitest run src/features/envelope/__tests__/EnvelopePage.test.tsx src/features/envelope/__tests__/condensation-chip.test.ts`
  (69 tests passed), TypeScript build, formatting, and lint (0 errors; 18
  pre-existing Fast Refresh warnings).

## Next step

Run the desktop/narrow signed-in and signed-out browser checks, then the focused
frontend gate and Graphify update.

## Verification

- [x] Roadmap state-cycle and accessible-name RTL.
- [x] Viewer/static Roadmap state labels.
- [ ] Desktop/narrow timeline geometry browser checks.
- [x] Condensation loading/success/warning/danger/unavailable label tests.
- [x] Anonymous no-render/no-query test.
- [x] Locked and authenticated read-only visibility test.
- [ ] Mounted signed-in and signed-out Envelope checks after
      `make agent-browser-ready`.
- [ ] Focused frontend gate and Graphify update.

## Coordination

Roadmap CSS may overlap the active
`planning/refactor/overview-documentation-progress/` branch. Preserve that
packet's heading/typography work while changing only the milestone state rail.

## Blockers

None, once the auth/session seam is confirmed.
