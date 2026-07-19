---
DATE: 2026-07-18
TIME: 22:50 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Phase sequence for the Documentation tab Option 1A redesign.
RELATED:
  - planning/refactor/documentation-page-redesign/README.md
  - planning/refactor/documentation-page-redesign/PRD.md
  - planning/refactor/documentation-page-redesign/STATUS.md
  - planning/refactor/documentation-page-redesign/phases/
---

# Documentation Page Redesign Plan

## Sequence

| Phase | Scope | Depends on |
|---|---|---|
| 00 | Status contract and current slice review | - |
| 01 | Evidence status schema: persisted Datasheet/Photo status, migration/backfill, summary rollup updates | 00 |
| 02 | Progressive disclosure shell: header, local expansion state, section/group accordions, compact rows | 01 |
| 03 | Axis selects and evidence writes: select-value adapter, datasheet/photo upload panels, optimistic rollup handling | 01, 02 |
| 04 | Visual polish and responsive behavior: design-system CSS, meters, status pills, row-expanded drop zones, desktop/phone geometry | 02, 03 |
| 05 | Verification and docs: RTL, browser smoke, context docs-pass, Graphify update | 04 |

## Standing Rules

- Read the approved 1A source and this packet before implementation.
- Keep topbar/tabbar code untouched.
- Reuse current Documentation summary data and attachment write paths, with the
  accepted Datasheet/Photo persisted status extension.
- Treat Datasheet/Photo status persistence as the highest-risk contract.
- Keep frontend changes scoped to `frontend/src/features/documentation/` and
  backend changes scoped to the project-document schema/summary/write paths
  needed for the new evidence statuses.
- Use `make agent-browser-ready` before localhost browser verification.
- Use `make frontend-dev-check` plus focused tests during frontend phases.
- At closeout, run Graphify update, simplify/docs-pass if requested by the
  implementation loop, and the agreed final gate.

## Verification Targets

Focused frontend:

```bash
pnpm exec vitest run src/features/documentation/__tests__/DocumentationSummaryView.test.tsx
pnpm exec tsc -b --pretty false
make frontend-dev-check
```

Browser smoke:

```bash
make agent-browser-ready
```

Then verify `/projects/{fixture}/documentation` at desktop and phone widths:

- initial section-card overview;
- hash navigation to `#envelope`;
- section/group/record expansion;
- status select color/mutation behavior for an editor;
- no edit affordances for a viewer or locked version;
- no overlapping text or clipped controls.

Backend focused tests must cover Datasheet/Photo status migration, rollups,
manual `Needed` with attachments present, and upload auto-complete behavior.
