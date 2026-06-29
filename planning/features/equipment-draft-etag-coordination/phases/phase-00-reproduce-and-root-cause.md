---
DATE: 2026-06-29
TIME: 16:52 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Reproduce the stale sibling table draft ETag failure and freeze the root cause.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
  - ../STATUS.md
---

# Phase 00 - Reproduce And Root Cause

## Goal

Prove the exact stale-guard sequence before changing code.

## Steps

1. Check the local app baseline.
   - Backend health:
     `curl -i http://localhost:8000/api/v1/auth/session`
   - Frontend:
     `http://localhost:5173`
   - Login:
     `codex@example.com` / `password`

2. Reproduce in the UI.
   - Open an editable project version.
   - Navigate to `Equipment / Fans`.
   - Add or edit a Fan row.
   - Do not `Save Version`.
   - Navigate to `Equipment / Hot-water tanks`.
   - Add or edit a Hot Water Tank row.
   - Capture whether the conflict banner appears.

3. Capture network evidence.
   - First request:
     `PUT /api/v1/projects/{project_id}/versions/{version_id}/draft/tables/fans`
   - First response:
     response body has `source="draft"` and a new `draft_etag`.
   - Second request:
     `PUT /api/v1/projects/{project_id}/versions/{version_id}/draft/tables/hot_water_tanks`
   - Expected failure on current code:
     request sends stale `If-Match` or stale `If-Match-Version`.
   - Backend response:
     `409`, `error_code="draft_etag_mismatch"`.

4. Confirm source lines.
   - `frontend/src/features/project_document/table-slice.ts`
     - `applyAcceptedSlice(...)`
     - `draftWriteHeaders(...)`
     - `invalidateProjectDocumentEditorTableSlices(..., refetchActiveSlices: false)`
   - `frontend/src/shared/ui/data-table/feature/useSliceTableController.ts`
     - payload builders read the current `slice` before mutation.
   - `backend/features/project_document/write_spine.py`
     - `load_draft_context(...)` enforces the whole-draft guard.

5. Decide whether copy needs adjustment.
   - If the implementation prevents all same-session false conflicts, keep
     route-specific copy for true external conflicts.
   - If same-session conflicts can still reach the banner in rare cases, update
     the shared copy to avoid saying "another tab" when no other tab exists.

## Exit Criteria

- Evidence shows the first write advanced the document `draft_etag`.
- Evidence shows the second table used a stale guard from its cached slice.
- Backend behavior is confirmed as correct.
- P01 can proceed without backend changes.

## Deliverables

- Add a short evidence section to `../STATUS.md`.
- Note whether the reproduction was manual, Playwright-driven, or unit-harness
  driven.
- Link any screenshot or trace artifact from `planning/features/.../assets/` if
  durable evidence is worth keeping.
