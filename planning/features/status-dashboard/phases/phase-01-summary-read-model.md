---
DATE: 2026-07-10
TIME: 10:08 EDT
STATUS: Planned
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

