---
DATE: 2026-07-10
TIME: 10:08 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Purpose-built backend projection for Status DATA-TABLE summary.
RELATED: phase-00-contract-and-registry.md; ../PRD.md
---

# Phase 01 — Summary Read Model

## Goal

Serve the complete Status summary with one project-document load and a compact payload.

## Work

- Add shared projection service over draft/saved `ProjectDocumentV1`.
- Add editor-only draft and view-safe saved-version routes.
- Project only IDs, display label inputs, status, notes, group metadata, and counts.
- Preserve saved-version isolation for viewers.
- Instrument/test store-load count and measure a 500-record response.

## Exit gate

Backend focused tests pass; measured load count is one; payload evidence is recorded in feature STATUS.

## Completion evidence

- Added draft/edit and saved/view summary routes over one shared projection.
- The response carries only source/etag metadata, counts, group/leaf destinations, row ID, display name, status, and notes.
- Viewer route isolation test proves an unsaved editor row is absent from the saved response; anonymous draft access returns `401`.
- One-load test records exactly one `get_current_document_view` call for all 12 tables.
- A deterministic 500-record fixture returns 50,623 bytes, below the 100 kB target.
- `uv run pytest tests/test_project_status_summary.py tests/test_project_document_batch_draft_tables.py -q`: `18 passed`.
- Focused Ruff and ty checks passed.
- Simplify: reused the existing pumps URL helper and hardened malformed legacy status values to `unknown`; efficiency review was clean.
- Docs-pass: folded the stable two-route, one-load projection contract into `context/technical-requirements/data-table.md`.
