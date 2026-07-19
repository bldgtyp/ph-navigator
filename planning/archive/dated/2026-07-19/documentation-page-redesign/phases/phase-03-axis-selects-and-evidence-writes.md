---
DATE: 2026-07-19
TIME: 00:05 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Implement status-pill selects and expanded-row evidence write controls.
RELATED:
  - planning/archive/dated/2026-07-19/documentation-page-redesign/PRD.md
  - frontend/src/features/documentation/hooks.ts
  - frontend/src/features/documentation/components/DocumentationRecordViews.tsx
---

# Phase 03 - Axis Selects And Evidence Writes

## Goal

Make each record row expose Spec, Datasheet, and Photo as compact status-pill
selects, with real evidence controls in the expanded row panel.

## Work Items

- Add a small adapter that maps records to UI axis values.
- Convert Spec to the shared 1A pill-select treatment while preserving the
  existing spec write path.
- Convert Datasheet and Photo status cells according to the accepted Phase 00
  contract.
- Replace visible waiver checkboxes with `NA` select behavior.
- Move Photo upload/delete controls into the expanded row panel.
- Add Datasheet upload/delete controls to the Documentation page.
- Auto-set Datasheet/Photo status to `Complete` after successful upload.
- Keep viewer and locked-version rows read-only.
- Ensure visible meters and attention counts update after writes.

## Acceptance

- Editor can change Spec status from a record row.
- Editor can mark Datasheet/Photo `NA` without a separate checkbox.
- Editor can clear `NA` back to `Needed`.
- Editor can set Datasheet/Photo back to `Needed` while attachments remain.
- Photo upload still writes through the existing attachment path.
- Datasheet upload works from the Documentation page.
- Datasheet/Photo upload sets the matching status to `Complete`.
- Viewer/locked tests confirm no enabled selects or upload controls.

## Notes

- Spec, Datasheet, and Photos now render as compact status-pill selects for
  editable rows, with read-only status pills for viewers.
- Datasheet and Photo evidence controls live in the expanded record panel and
  record detail modal.
- Datasheet writes use the same asset attach/detach contract as Photo, with an
  axis-aware target adapter for table rows and assembly segment/material rows.
- Visible waiver checkboxes are removed from the Documentation page; `NA` is
  expressed through `datasheet_status` and `photo_status`.
- Shared status options and Spec=N/A evidence coercion live in
  `frontend/src/features/documentation/lib.ts`.
- The focused RTL test now covers status writes, Datasheet upload attach, viewer
  read-only controls, pending optimistic status state, and attachments surviving
  `NA -> Needed`.

## Verification

- `pnpm exec vitest run src/features/documentation/__tests__/DocumentationSummaryView.test.tsx` passed.
- `pnpm exec tsc -b --pretty false` passed.
- `make frontend-dev-check` passed; eslint still reports the pre-existing Fast
  Refresh warnings in Apertures, Climate, and shared DataTable files.
- Phase 03 simplify pass completed with reuse, quality, and efficiency agents;
  concrete findings were fixed.
