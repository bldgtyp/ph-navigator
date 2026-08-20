---
DATE: 2026-08-19
TIME: 19:05 EDT
STATUS: Complete — implementation and verification complete; archive next
AUTHOR: Codex
SCOPE: Current state of status presentation polish
RELATED:
  - planning/features/status-presentation-polish/PRD.md
---

# STATUS — Status Presentation Polish

**State:** `Complete`; implementation, simplify, docs-pass, Graphify, automated
verification, and mounted browser acceptance are complete. Archive cleanup is
next.

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

### Phase 3 — Integrated browser and frontend verification

- Regrouped Total thickness, Thermal, and authenticated Moisture in one metrics
  list after the mounted desktop check exposed Warning as an unintended row
  break; Warning now renders in a separate alerts list only when present.
- Verified Roadmap labels and timeline centers at desktop and 480 px widths;
  the rail contains no ambiguous glyphs or duplicate status badges.
- Verified the signed-in Assembly header keeps Total thickness, Thermal, and
  Moisture aligned at desktop, and wraps the whole Moisture metric after
  Thermal at 480 px.
- Verified a mounted signed-out saved Assembly keeps Total thickness and
  Thermal while rendering no Moisture label, condensation text, action, or
  blank metric wrapper.
- Three-way simplify review found no quality, reuse, or efficiency findings.
- `graphify update .` completed.
- `pnpm --dir frontend test` passed: 274 files / 2,475 tests.
- `make frontend-dev-check` passed: formatting, lint (0 errors; 18 existing
  Fast Refresh warnings), structural checks, TypeScript, production build, and
  version-marker verification. Vite retained its existing large-chunk warning.

## Next step

Archive this completed packet and update planning indexes.

## Verification

- [x] Roadmap state-cycle and accessible-name RTL.
- [x] Viewer/static Roadmap state labels.
- [x] Desktop/narrow timeline geometry browser checks.
- [x] Condensation loading/success/warning/danger/unavailable label tests.
- [x] Anonymous no-render/no-query test.
- [x] Locked and authenticated read-only visibility test.
- [x] Mounted signed-in and signed-out Envelope checks after
      `make agent-browser-ready`.
- [x] Frontend gate, full frontend suite, and Graphify update.

## Coordination

Roadmap CSS may overlap the active
`planning/refactor/overview-documentation-progress/` branch. Preserve that
packet's heading/typography work while changing only the milestone state rail.

## Blockers

None.
