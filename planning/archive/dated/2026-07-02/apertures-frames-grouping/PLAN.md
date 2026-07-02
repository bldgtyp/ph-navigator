---
DATE: 2026-07-02
TIME: 14:25 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Implementation plan for Apertures / Frames grouping.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./STATUS.md
---

# PLAN - Apertures Frames Grouping

## Phase 01 - Table Contract Audit - Complete

- Locate the Apertures / Frames route and DataTable configuration.
- Confirm available fields and table-view persistence.
- Decide whether `brand` is a safe grouping field.

Result: Frames are rendered by `ApertureSpecReportPanel` / `ReportTable`, not the
shared editable `DataTable`. `brand` is durable on `FrameRef` /
`ProjectFrameRead` and backend aperture default refs.

## Phase 02 - Grouping Defaults - Complete

- Enable or expose group controls if missing.
- Set default grouping to `manufacturer`.
- Add `brand` if the field is durable.

Result: Frames report now has a compact grouping toolbar with Manufacturer,
Brand, and No grouping options. Grouping remains nested inside the existing
status sections so datasheet/use-site expansion behavior is preserved.

## Phase 03 - Verification - Complete

- Run focused frontend checks.
- Browser-smoke grouping, ungrouping, and brand grouping if applicable.
- Update `STATUS.md`.

Result: focused component coverage and `make frontend-dev-check` pass. Browser
login/API smoke passed, but populated Frames route smoke was blocked by local
seed data with no `project_frames` rows.
