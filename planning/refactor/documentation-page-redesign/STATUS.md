---
DATE: 2026-07-18
TIME: 22:50 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Current state and handoff for the Documentation tab Option 1A redesign.
RELATED:
  - planning/refactor/documentation-page-redesign/README.md
  - planning/refactor/documentation-page-redesign/PRD.md
  - planning/refactor/documentation-page-redesign/PLAN.md
  - planning/refactor/documentation-page-redesign/research.md
---

# Documentation Page Redesign Status

## Current State

Planning packet created. No implementation code changed.

Reviewed:

- `/Users/em/Downloads/Redesigning data page layout/HANDOFF-1A.md`;
- `/Users/em/Downloads/Redesigning data page layout/Documentation Redesign.dc.html`
  Option `#1a`;
- `frontend/src/features/documentation/components/DocumentationSummaryView.tsx`;
- `frontend/src/features/documentation/components/DocumentationRecordViews.tsx`;
- `frontend/src/features/documentation/lib.ts`;
- `frontend/src/features/documentation/types.ts`;
- `frontend/src/features/documentation/documentation.css`;
- `frontend/src/features/documentation/hooks.ts`;
- `frontend/src/features/documentation/__tests__/DocumentationSummaryView.test.tsx`;
- `context/ui/pages/documentation-tab.md`;
- `planning/archive/dated/2026-07-19/documentation-tab/`.

## Phase Progress

| Phase | State | Notes |
|---|---|---|
| 00 - Status contract and current slice | Decision recorded | Spec has four states; Datasheet/Photo have three persisted states |
| 01 - Evidence status schema | Planned | Add/migrate/backfill Datasheet/Photo status and update rollups/write paths |
| 02 - Progressive disclosure shell | Planned | Header, section/group accordions, local expansion state, compact rows |
| 03 - Axis selects and evidence writes | Planned | Spec/Datasheet/Photo selects; upload auto-sets Datasheet/Photo complete |
| 04 - Visual polish and responsive behavior | Planned | Tokenized CSS, meters, pills, drop zones, desktop/mobile checks |
| 05 - Verification and docs | Planned | RTL, browser smoke, docs-pass, Graphify |

## Decisions So Far

- Use Option 1A as the structural and behavioral target.
- Keep PH-Navigator design-system tokens instead of copying mockup tokens.
- Keep the topbar and project tabbar unchanged.
- Keep expansion state local to the browser session.
- Spec statuses are `Complete`, `Question`, `Needed`, and `NA`.
- Datasheet/Photo statuses are `Complete`, `Needed`, and `NA`; they do not
  expose `Question`.
- Datasheet/Photo status must be persisted independently from attachment
  presence so a user can set an axis back to `Needed` after files are attached.
- Datasheet/Photo uploads auto-set the matching axis status to `Complete`.
- Keep the record detail modal.
- Keep the section-level "How to photograph" directions modals; the Claude
  Design mockup omitted them, but the redesign must preserve them for viewers
  and editors.
- Backend-derived rollups remain the source of truth, updated to use the new
  persisted evidence statuses.

## Open Questions

None currently. The three initial contract questions were resolved by Ed on
2026-07-18.

## Next Step

Start Phase 01 by implementing the persisted Datasheet/Photo evidence status
schema, migration/backfill, and summary rollup updates.

## Verification

Not run. This was a planning-only pass.
