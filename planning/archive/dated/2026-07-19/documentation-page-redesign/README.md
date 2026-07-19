---
DATE: 2026-07-19
TIME: 00:34 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Router for the Documentation tab Option 1A overview-and-drill-down redesign.
RELATED:
  - planning/archive/dated/2026-07-19/documentation-page-redesign/PRD.md
  - planning/archive/dated/2026-07-19/documentation-page-redesign/PLAN.md
  - planning/archive/dated/2026-07-19/documentation-page-redesign/STATUS.md
  - planning/archive/dated/2026-07-19/documentation-page-redesign/research.md
  - planning/archive/dated/2026-07-19/documentation-page-redesign/phases/phase-00-status-contract-and-current-slice.md
  - planning/archive/dated/2026-07-19/documentation-page-redesign/phases/phase-01-evidence-status-schema.md
  - planning/archive/dated/2026-07-19/documentation-page-redesign/phases/phase-02-progressive-disclosure-shell.md
  - planning/archive/dated/2026-07-19/documentation-page-redesign/phases/phase-03-axis-selects-and-evidence-writes.md
  - planning/archive/dated/2026-07-19/documentation-page-redesign/phases/phase-04-visual-polish-responsive.md
  - planning/archive/dated/2026-07-19/documentation-page-redesign/phases/phase-05-verification-docs.md
  - planning/archive/dated/2026-07-19/documentation-tab/
  - /Users/em/Downloads/Redesigning data page layout/HANDOFF-1A.md
  - /Users/em/Downloads/Redesigning data page layout/Documentation Redesign.dc.html
---

# Documentation Page Redesign

## Read Order

1. `/Users/em/Downloads/Redesigning data page layout/HANDOFF-1A.md` -
   source narrative for approved Option 1A.
2. `/Users/em/Downloads/Redesigning data page layout/Documentation Redesign.dc.html` -
   visual reference; use the `#1a` frame only.
3. `research.md` - current implementation map and contract conflicts.
4. `PRD.md` - target behavior and non-goals.
5. `PLAN.md` - phase sequence.
6. `STATUS.md` - current state, next step, blockers, and verification ledger.
7. `phases/` - phase-specific handoffs.

## Why This Is Under `planning/refactor`

This is a focused redesign of an already-shipped page, not a new product
feature. The route, backend summary endpoint, attachment backbone, access
model, and saved/draft document semantics already exist from the archived
Documentation tab feature. The work should refactor the page composition,
interaction model, and evidence controls while preserving those contracts.

## Scope Summary

Implement Option 1A "Overview & drill-down" for the top-level Documentation
tab at `/projects/{id}/documentation`.

The target page uses progressive disclosure:

- project documentation header with a single attention line;
- collapsible section cards for Envelope, Equipment, Apertures, and Thermal
  Bridges;
- nested collapsible groups/assemblies;
- compact record rows with Spec, Datasheet, and Photo status selects;
- row-expanded evidence panels with owner link and upload/drop zones.

The project topbar and tabbar are out of scope. The reference mockup's exact
inline CSS, fonts, radii, shadows, and raw colors are not implementation
contracts; map the layout and behavior onto PH-Navigator design-system tokens.

## Phase Map

| Phase                                      | Status            | Output                                                                                                            |
| ------------------------------------------ | ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| 00 - Status contract and current slice     | Decision recorded | Spec has four states; Datasheet/Photo have three persisted states and can be `Needed` even when attachments exist |
| 01 - Evidence status schema                | Complete          | Persisted Datasheet/Photo status enums and migrated/backfilled from current attachments + waiver fields           |
| 02 - Progressive disclosure shell          | Complete          | Header, local expansion state, section/group cards, compact record rows                                           |
| 03 - Axis selects and evidence writes      | Complete          | Spec/Datasheet/Photo select controls, datasheet/photo upload placement, optimistic rollup updates                 |
| 04 - Visual polish and responsive behavior | Complete          | Design-system CSS for meters, pills, cards, drop zones, desktop/mobile geometry                                   |
| 05 - Verification and docs                 | Complete          | Focused tests, browser smoke, context docs-pass, Graphify update                                                  |

## Current Handoff

Final state:

- The Option 1A redesign is implemented and verified.
- The current Documentation page lives under
  `frontend/src/features/documentation/`.
- The archived first-build packet lives under
  `planning/archive/dated/2026-07-19/documentation-tab/`.
- The main status contract is resolved: Datasheet/Photo status is
  persisted independently of attachment presence because users can set an axis
  back to `Needed` after one or more files are attached.

Verification:

- Focused backend, RTL, TypeScript, frontend gate, Graphify, and browser smoke
  evidence is recorded in `STATUS.md` and the phase files.
