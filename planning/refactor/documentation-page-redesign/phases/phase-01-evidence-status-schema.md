---
DATE: 2026-07-18
TIME: 22:50 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Persist Datasheet/Photo evidence status so status can differ from attachment presence.
RELATED:
  - planning/refactor/documentation-page-redesign/PRD.md
  - planning/refactor/documentation-page-redesign/STATUS.md
  - backend/features/project_document/
  - frontend/src/features/documentation/types.ts
---

# Phase 01 - Evidence Status Schema

## Goal

Add the data contract needed for Datasheet and Photo status selects:
`Complete`, `Needed`, and `NA`, independent from whether attachments are
present.

## Work Items

- Add persisted Datasheet/Photo evidence status fields to every documentation
  record family that appears in the summary.
- Migrate/backfill current records:
  - existing waiver -> `NA`;
  - at least one attachment and no waiver -> `Complete`;
  - no attachment and no waiver -> `Needed`.
- Update documentation-summary records and rollups to use persisted evidence
  status rather than pure attachment-derived completion.
- Keep attachment ids as evidence payloads, not status.
- Update write paths so uploading a datasheet/photo auto-sets the matching axis
  to `Complete`.
- Keep manual `Needed` valid even when attachment ids remain present.
- Decide whether legacy waiver booleans are retained as compatibility fields or
  fully replaced by the new status fields during implementation.

## Acceptance

- Backend tests cover migration/backfill for all three evidence statuses.
- Rollup tests prove `Needed` with attachments present counts as incomplete.
- Upload tests prove new datasheet/photo attachments set status to `Complete`.
- API summary records expose enough status data for the frontend select adapter.

