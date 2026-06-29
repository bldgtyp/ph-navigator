---
DATE: 2026-06-29
TIME: 16:52 EDT
STATUS: Complete
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

- ✅ Evidence shows the first accepted write updates only the source table cache,
  records the new document-scoped `draft_etag`, and invalidates sibling editor
  slices without active refetch.
- ✅ Evidence shows the next sibling write path builds payloads and headers from
  the controller's cached `slice` prop, so an invalidated sibling can send its
  stale guard.
- ✅ Backend behavior is confirmed as correct: `load_draft_context(...)`
  rejects a mismatched `If-Match` against the stored draft ETag.
- ✅ P01 can proceed without backend changes.

## Deliverables

- Added a short evidence section to `../STATUS.md`.
- Reproduction mode: deterministic code/test harness plus existing focused
  Vitest coverage. Manual browser reproduction is deferred to P03 after the fix
  is in place.
- No screenshot or trace artifact was created for this phase; the durable
  evidence is the focused test output and source-line references.
