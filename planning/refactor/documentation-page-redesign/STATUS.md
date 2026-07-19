---
DATE: 2026-07-19
TIME: 00:29 EDT
STATUS: In Progress
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

Phase 04 implemented. The project-document schema is v7 with persisted
Datasheet/Photo evidence statuses. The Documentation page now loads as an
overview-first disclosure shell with compact Spec/Datasheet/Photo status
selects, expanded-row evidence controls, Datasheet and Photo upload/delete
paths, read-only viewer rows, tokenized meter styling, responsive section/group
layouts, and visible expanded-row drop zones.

Reviewed:

- `/Users/em/Downloads/Redesigning data page layout/HANDOFF-1A.md`;
- `/Users/em/Downloads/Redesigning data page layout/Documentation Redesign.dc.html`
  Option `#1a`;
- `frontend/src/features/documentation/components/DocumentationSummaryView.tsx`;
- `frontend/src/features/documentation/components/DocumentationRecordViews.tsx`;
- `frontend/src/features/documentation/documentation-modals.css`;
- `frontend/src/features/documentation/documentation-records.css`;
- `frontend/src/features/documentation/lib.ts`;
- `frontend/src/features/documentation/types.ts`;
- `frontend/src/features/documentation/documentation.css`;
- `frontend/src/features/documentation/hooks.ts`;
- `frontend/src/features/documentation/__tests__/DocumentationSummaryView.test.tsx`;
- `frontend/src/features/documentation/__tests__/DocumentationSummaryView.fixtures.ts`;
- `frontend/src/features/project_status/components/RecordStatusSummary.tsx`;
- `frontend/src/features/project_status/status_summary.css`;
- `frontend/src/shared/ui/ProgressBar.tsx`;
- `frontend/src/shared/ui/index.ts`;
- `context/ui/pages/documentation-tab.md`;
- `planning/archive/dated/2026-07-19/documentation-tab/`.

## Phase Progress

| Phase | State | Notes |
|---|---|---|
| 00 - Status contract and current slice | Decision recorded | Spec has four states; Datasheet/Photo have three persisted states |
| 01 - Evidence status schema | Complete | Schema v7 adds/backfills Datasheet/Photo status, rollups use persisted status, uploads auto-complete |
| 02 - Progressive disclosure shell | Complete | Overview header, local section/group/record expansion, hash expansion, compact rows |
| 03 - Axis selects and evidence writes | Complete | Spec/Datasheet/Photo pill selects, status writes, Datasheet/Photo attachments, viewer read-only |
| 04 - Visual polish and responsive behavior | Complete | Tokenized meters, responsive section/group/record grids, visible expanded drop zones, desktop/mobile browser geometry checks |
| 05 - Verification and docs | Planned | Final RTL/browser/doc verification, Graphify, archive cleanup |

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
- Legacy `datasheet_not_required` / `photo_not_required` booleans are retained
  as compatibility fields for owner-page surfaces and migrated documents; the
  Documentation page now writes `datasheet_status` / `photo_status` directly.

## Open Questions

None currently. The three initial contract questions were resolved by Ed on
2026-07-18.

## Next Step

Start Phase 05 by running the final verification/docs sweep, reconciling packet
docs, and preparing the active packet for archive once all acceptance evidence is
current.

## Verification

- `.venv/bin/pytest tests/test_project_documentation_summary.py tests/test_assets_service.py::test_datasheet_upload_complete_url_attach_and_detach_with_fake_storage tests/test_project_document.py::test_project_document_upgrade_entrypoint_accepts_current_and_v0_baseline tests/test_project_document.py::test_project_document_v6_upgrade_backfills_documentation_evidence_statuses tests/envelope/test_envelope_document_contracts.py::test_assembly_segments_replace_preserves_omitted_notes_and_skips_noop -q` passed.
- `pnpm exec tsc -b --pretty false` passed.
- `git diff --check` passed.
- `pnpm exec vitest run src/features/documentation/__tests__/DocumentationSummaryView.test.tsx` passed.
- `pnpm exec vitest run src/features/documentation/__tests__/DocumentationSummaryView.test.tsx` passed again after Phase 04.
- `pnpm exec tsc -b --pretty false` passed again after Phase 04.
- `make frontend-dev-check` passed again after Phase 04; eslint still reports
  the pre-existing Fast Refresh warnings in Apertures, Climate, and shared
  DataTable files.
- `make agent-browser-check` passed with frontend `:5173` and backend `:8000`
  ready.
- Live browser check on project `437c8d56-ac12-44fc-99a9-ff1e6055792a` with
  fixture record `Documentation Verification Pump With Long Label` passed at
  `1440x900` and `390x844`: no Documentation-page overflow, 15 semantic
  progress bars with visible `.progress-bar__fill` elements, and two visible
  expanded Datasheet/Photo `Drop files here` controls.
- Phase 03 simplify pass completed with three review agents; concrete findings
  were fixed in shared status helpers, attachment controls, and test coverage.
- Phase 04 simplify pass completed with three review agents; concrete findings
  were fixed by exporting `ProgressBar` through `shared/ui`, making the
  component styling class explicit, adding a stable progress-fill class, and
  letting the shared component own value clamping.
