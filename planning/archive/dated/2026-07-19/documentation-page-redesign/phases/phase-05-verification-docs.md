---
DATE: 2026-07-19
TIME: 00:34 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Close out the Documentation page redesign with focused tests, browser evidence, and docs.
RELATED:
  - planning/archive/dated/2026-07-19/documentation-page-redesign/PLAN.md
  - frontend/src/features/documentation/__tests__/DocumentationSummaryView.test.tsx
  - context/ui/pages/documentation-tab.md
---

# Phase 05 - Verification And Docs

## Goal

Prove the redesign works against the real Documentation route and fold durable
behavior back into the context docs.

## Work Items

- Update focused Documentation component tests.
- Add/adjust e2e coverage only where RTL cannot cover route/browser behavior.
- Run `make frontend-dev-check`.
- Use `make agent-browser-ready` before live browser verification.
- Verify desktop and phone-width Documentation route behavior.
- Verify the "How to photograph" directions modals still open and remain
  usable at desktop and phone widths.
- Update `context/ui/pages/documentation-tab.md` with the accepted 1A behavior.
- Update this packet's `STATUS.md`.
- Run `graphify update .` after code changes.

## Acceptance

- Focused frontend tests pass.
- Frontend gate passes.
- Browser smoke covers overview load, drill-down, editor controls, and read-only
  viewer behavior.
- Directions-modal coverage remains in focused tests and browser smoke.
- Durable docs match implementation.
- `planning/STATUS.md` and this packet's `STATUS.md` are current.

## Implementation Notes

- The focused Documentation RTL suite already covered the route behaviors that
  need deterministic component state: directions-modal content, viewer
  read-only rows, draft editor status writes, datasheet upload/attach, manual
  `Needed` with attachments still present, and optimistic per-record writes.
- No new e2e file was added; Phase 05 used live browser smoke for route-only
  behavior and kept durable coverage in the focused RTL/backend suites.
- `context/ui/pages/documentation-tab.md` now documents the accepted 1A
  overview/meter/disclosure behavior plus the persisted Datasheet/Photo status
  contract.

## Verification

- `pnpm exec vitest run src/features/documentation/__tests__/DocumentationSummaryView.test.tsx` passed.
- `pnpm exec tsc -b --pretty false` passed.
- `cd backend && uv run pytest tests/test_project_documentation_summary.py tests/test_assets_service.py::test_datasheet_upload_complete_url_attach_and_detach_with_fake_storage tests/test_project_document.py::test_project_document_upgrade_entrypoint_accepts_current_and_v0_baseline tests/test_project_document.py::test_project_document_v6_upgrade_backfills_documentation_evidence_statuses tests/envelope/test_envelope_document_contracts.py::test_assembly_segments_replace_preserves_omitted_notes_and_skips_noop -q` passed: 9 tests.
- `make frontend-dev-check` passed; eslint still reports the pre-existing Fast
  Refresh warnings in Apertures, Climate, and shared DataTable files.
- `make agent-browser-ready` passed and reused fixture project
  `437c8d56-ac12-44fc-99a9-ff1e6055792a` / version
  `d47feb2c-6935-4510-90bc-ef918b3a43a5`.
- Browser smoke on
  `/projects/437c8d56-ac12-44fc-99a9-ff1e6055792a/documentation#envelope`
  verified hash expansion, overview load, 15 semantic progress bars, enabled
  editor Spec/Datasheet/Photos controls, visible expanded Datasheet/Photo drop
  zones, and no Documentation-page overflow.
- Browser smoke verified the Equipment directions modal at `1440x900` and
  `390x844`; the modal stayed within the viewport and rendered the Ventilators
  and Pumps shot-list content.
- Anonymous browser smoke verified the public read-only Documentation shell:
  `READ-ONLY`, no Documentation selects, no Add file buttons, and no Drop files
  here controls. The seeded evidence row exists only in the editor draft, so
  read-only row behavior remains covered by RTL with saved-document fixture
  records.
- A root `.venv/bin/pytest ...` probe failed because this checkout does not
  have a root `.venv`; the backend-focused suite passed via the repo's `uv run`
  path from `backend/`.
