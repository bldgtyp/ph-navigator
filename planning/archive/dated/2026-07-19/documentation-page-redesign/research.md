---
DATE: 2026-07-18
TIME: 22:50 EDT
STATUS: Draft
AUTHOR: Codex
SCOPE: Current-state notes for the Documentation tab Option 1A redesign.
RELATED:
  - planning/archive/dated/2026-07-19/documentation-page-redesign/README.md
  - frontend/src/features/documentation/
  - planning/archive/dated/2026-07-19/documentation-tab/
---

# Documentation Page Redesign Research

## Design Reference Reviewed

Source files:

- `/Users/em/Downloads/Redesigning data page layout/HANDOFF-1A.md`
- `/Users/em/Downloads/Redesigning data page layout/Documentation Redesign.dc.html`

Approved frame: Option `1A Overview & drill-down`.

Key target changes:

- remove the top rollup chips;
- add `Documentation status`, subtitle, and one attention line;
- collapse into section -> group -> record tiers;
- show Spec/Datasheet/Photo meters in section and group headers;
- render compact record rows with status-pill selects;
- move upload/drop zones into expanded record panels;
- remove separate Not Required checkboxes by folding `NA` into selects.

## Current Frontend Surface

Primary implementation files:

- `frontend/src/features/documentation/routes/DocumentationPage.tsx`
- `frontend/src/features/documentation/components/DocumentationSummaryView.tsx`
- `frontend/src/features/documentation/components/DocumentationRecordViews.tsx`
- `frontend/src/features/documentation/hooks.ts`
- `frontend/src/features/documentation/lib.ts`
- `frontend/src/features/documentation/types.ts`
- `frontend/src/features/documentation/documentation.css`
- `frontend/src/features/documentation/__tests__/DocumentationSummaryView.test.tsx`

Current behavior:

- header renders only three rollup chips;
- filters are toggles for missing specs, datasheets, and photos;
- complete sections can collapse, incomplete sections render open;
- groups render open;
- records render full controls in the list;
- record name opens a modal;
- section headers expose "How to photograph" directions modals;
- editor Spec uses a select;
- Photos use real `AttachmentCell` upload from the Documentation page;
- Datasheets render read-only attachment strips on the Documentation page;
- Datasheet/Photo N/A is represented by separate waiver checkboxes;
- viewers and locked versions are read-only.

## Current Data Contract

`ProjectDocumentationSummary` provides:

- `counts` at project, section, and group levels;
- `sections[].groups[].records[]`;
- record identity and owner route;
- `spec_status`;
- `datasheet_asset_ids`;
- `photo_asset_ids`;
- `datasheet_not_required`;
- `photo_not_required`.

`axisDone()` currently defines done state as:

- Spec: `complete` or `na`;
- Datasheet: at least one datasheet asset, datasheet waiver, or spec `na`;
- Photo: at least one photo asset, photo waiver, or spec `na`.

This supports current `Needed`, `Complete`, and `NA` projections for evidence
axes, but it cannot preserve `Needed` when attachments are present.

## Implementation Risks

### Datasheet/Photo Status Selects

Ed resolved the status contract on 2026-07-18:

- Spec: `Complete`, `Question`, `Needed`, `NA`;
- Datasheet/Photo: `Complete`, `Needed`, `NA`;
- uploading a datasheet/photo auto-sets the axis to `Complete`;
- users can set Datasheet/Photo back to `Needed` even when attachments remain;
- keep the record detail modal.
- keep the existing "How to photograph" directions modals; they were omitted
  from the Claude Design mockup but are intentionally retained.

Because current Datasheet/Photo status is derived from attachment presence plus
waivers, this requires persisted per-axis evidence status for Datasheet and
Photo. The implementation should migrate current waivers to `NA`, attached
records to `Complete`, and empty unwaived records to `Needed`.

### Datasheet Upload From Documentation

The current page can upload photos but not datasheets. Option 1A places both
Datasheet and Photo upload zones in the expanded record panel. This means the
Documentation write hook probably needs a datasheet attachment mutation path
parallel to the existing photo path, including envelope/material fan-out rules
where applicable.

### Rollup Recalculation

Current optimistic field updates only patch waiver booleans locally; spec
status returns refreshed summary semantics through the existing write path.
The redesign expects select colors, attention counts, and meters to update
immediately. Implementation should either add local count recomputation for the
affected axes or rely on a quick accepted summary refetch with no stale display
window.

### Modal Duplication

The current row name opens `RecordDetailModal`. Option 1A moves owner link and
upload zones into the row-expanded panel. Keeping the modal unchanged could
duplicate edit controls and reintroduce the wall-of-controls problem at a
smaller scale.
