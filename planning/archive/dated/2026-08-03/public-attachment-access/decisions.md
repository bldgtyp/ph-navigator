---
DATE: 2026-08-03
TIME: 11:12 EDT
STATUS: Accepted
AUTHOR: Codex with Ed May
SCOPE: Decisions resolved during public attachment access implementation.
RELATED:
  - ./PRD.md
  - ./phases/phase-00-production-inventory.md
  - ./phases/phase-02-register-pdf-report.md
---

# Decisions — Public attachment access

## D-01 — Thermal Bridge PDF Report remains PDF-only

**Decision:** Register `thermal_bridges.pdf_report_asset_ids` as a `datasheet`
attachment field restricted to `application/pdf`, with five files per cell and
a 25 MB per-file cap. Do not widen it to the shared
`DATASHEET_CONTENT_TYPES` allowlist.

**Evidence:** Phase 00 inspected every production reference in the field. All
five assets were uploaded PDFs, every cell held one file, and none exceeded 25
MB. The frontend PDF Report control already accepted PDFs only.

**Consequence:** Existing production data remains valid and future writes match
the field's stated purpose. Supporting images or other datasheet formats here
would require an explicit contract change rather than silently inheriting the
broader generic datasheet policy.
