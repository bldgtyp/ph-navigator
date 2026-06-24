---
DATE: 2026-06-24
TIME: 19:03 EDT
STATUS: Complete
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 2 — finish columns + datasheet/use-site/spec-status/drift wiring;
  retire the interim ProjectRefsView modal + refsAggregation.
RELATED: ./phase-01-frontend-routing-and-panels.md, ../PRD.md (Expanded row)
---

# Phase 2 — Wire the panels + retire the interim modal

## Result

Complete as of 2026-06-24. `GlazingsPanel` and `FramesPanel` now render full
Materials-parity report tables over the Phase 0 spec-report read model:
status-filter chips, in-scope/N/A/unused grouping, product/manufacturer/numeric
columns, datasheet chips and expanded `AttachmentCell` zones, use-site rows,
catalog-drift badges and refresh actions, editable specification-status controls,
unused-row removal, and viewer hiding for N/A/unused products. The interim
`ProjectRefsView` modal, `refsAggregation.ts`, and `refsAggregation.test.ts`
were removed.

## Columns (per PRD column maps)

- **GlazingsPanel:** Glazing (primary) · Manufacturer · U-value · g-value ·
  Datasheet (`AttachmentChipCell`) · Status (`StatusDot` + `AutocompleteSelect`).
- **FramesPanel:** Frame (primary) · Manufacturer · U-value · Ψ-install · Width ·
  Datasheet · Status.
- Numeric columns: two-line label+unit headers, right-aligned, IP/SI-aware via
  the existing `lib/units` formatters (mirror `MaterialsPanel.tsx:160-205`). Reuse
  the catalog unit-label helpers where applicable.
- **No Photos column** (Feature 1 D-5).

## Expansion (clone `MaterialsPanel.tsx:305-405`)

- **Datasheets:** `AttachmentCell` over `datasheet_asset_ids`, config
  `DATASHEET_ATTACHMENT_CONFIG`, `readOnly` when `!canEdit || status==="na"`;
  `onChange` → `onAttachmentChange({ tableKey: "project_glazings" | "project_frames",
  rowId: entity.id, fieldKey: "datasheet_asset_ids", currentAssetIds, nextAssetIds })`
  (mirror `MaterialsPanel.tsx:338-346`; the backend table keys exist from the
  prerequisite Phase 3).
- **Used in N elements:** render use-site sub-rows from the read model
  (`aperture type · element` for glazings; `· side` for frames). No photo zones.
- **Drift:** `MaterialDriftBadge`-style badge + "Refresh from catalog" when the
  entity is drifted (data from the Phase-0 drift report).

## Editing

- Status `<AutocompleteSelect>` → `update_project_glazing` /
  `update_project_frame`.
- Unused-row `X` → `remove_project_glazing` / `remove_project_frame`.
- Locked-version + viewer gates identical to Materials (disable selects, hide
  drop-zones + delete, still render rows).
- Optional value-edit modal (D-R5) — include only if Ed wants it in v1;
  otherwise field edits happen in the builder.

## Retire the interim report

Now that both pages exist, remove the stop-gap:

- Delete `frontend/src/features/apertures/components/ProjectRefsView.tsx` and its
  launch affordance in the apertures builder.
- Delete `frontend/src/features/apertures/lib/refsAggregation.ts` and
  `__tests__/refsAggregation.test.ts` (the dedup now lives server-side in
  `build_apertures_read_parts`).
- Grep for and remove any remaining imports/usages.

## Verification

- `cd frontend && pnpm exec vitest run src/features/apertures/__tests__/ApertureSpecReportPanel.test.tsx` — 3 passed.
- `make frontend-dev-check` — passed with existing fast-refresh warnings and
  Vite chunk-size warning only.
- Playwright smoke on local Codex fixture
  `846a42ac-cb2c-472f-8239-eabd05fe6d57` — glazings and frames report routes
  rendered real rows, columns, expanded datasheet/use-site evidence, and did not
  hit builder-only aperture slice or U-value APIs; bare `/apertures` redirected
  to `/apertures/builder`.
- Simplify pass — fixed duplicate draft-summary invalidation, indexed drift
  lookups by `element_id:target`, constrained datasheet URL fetches to the
  expanded row, and added typed product command config/status guarding.

## Exit criteria

- Both pages are full Materials-parity reports; interim modal + aggregator gone;
  lint + type-check + tests green.

Met. Phase 3 remains for final closeout docs/context and full closeout
verification.
