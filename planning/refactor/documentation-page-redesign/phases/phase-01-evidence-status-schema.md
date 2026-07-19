---
DATE: 2026-07-19
TIME: 00:00 EDT
STATUS: Complete
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
  fully replaced by the new status fields during implementation. Done: retained
  as compatibility fields; rollups use the new status fields.

## Implementation Notes

- `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` is now `7`.
- New `EvidenceStatus` values are `needed`, `complete`, and `na`.
- `datasheet_status` / `photo_status` are persisted on documentation record
  families that carry those axes.
- The v6 -> v7 upgrade backfills:
  - existing waiver -> `na`;
  - at least one attachment and no waiver -> `complete`;
  - no attachment and no waiver -> `needed`.
- Attachment attach writes auto-set `datasheet_status` or `photo_status` to
  `complete` via the existing asset attach endpoint.
- `assembly_segments` replacement now accepts and exposes `photo_status` so
  envelope material photo status can round-trip through the documentation write
  path.

## Acceptance

- Backend tests cover migration/backfill for all three evidence statuses.
- Rollup tests prove `Needed` with attachments present counts as incomplete.
- Upload tests prove new datasheet/photo attachments set status to `Complete`.
- API summary records expose enough status data for the frontend select adapter.

## Verification

- `.venv/bin/pytest tests/test_project_documentation_summary.py tests/test_assets_service.py::test_datasheet_upload_complete_url_attach_and_detach_with_fake_storage tests/test_project_document.py::test_project_document_upgrade_entrypoint_accepts_current_and_v0_baseline tests/test_project_document.py::test_project_document_v6_upgrade_backfills_documentation_evidence_statuses tests/envelope/test_envelope_document_contracts.py::test_assembly_segments_replace_preserves_omitted_notes_and_skips_noop -q` passed.
- `pnpm exec tsc -b --pretty false` passed.
- `git diff --check` passed.
