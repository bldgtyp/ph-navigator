---
DATE: 2026-05-26
TIME: 18:21 EDT
STATUS: Proposed implementation plan.
AUTHOR: Codex
SCOPE: Project-material catalog drift detection, review, and explicit
       refresh.
RELATED:
  - docs/plans/2026-05-26/assembly-builder/assembly-builder-prd.md §§5.5, 7.13
  - docs/plans/2026-05-26/assembly-builder/phase-04-materials-picker-specifications.md
  - context/technical-requirements/data-model.md §7.4
  - context/user-stories/20-envelope.md US-ENV-11
---

# Phase 7 - Catalog Refresh And Drift

## Goal

Make catalog drift visible and reviewable without reintroducing V1's
live-reference behavior. Refresh is explicit, per project material, and
field-by-field.

## In Scope

- Drift report for project materials.
- Drift predicate:
  - catalog version mismatch;
  - same-version field delta;
  - customized fields through `local_overrides`;
  - source deactivated.
- Per-material refresh dialog.
- Assemblies-tab drift banner.
- Specifications card drift badges and actions.
- Project-wide "Review all" entry point with per-material actions and
  no bulk auto-apply.
- Backend refresh command that writes chosen field values and preserves
  `local_overrides` verbatim in v1.

## Out Of Scope

- Bulk auto-refresh.
- Catalog schema migration tooling.
- Renamed-field diff metadata.
- Field-level override manager that recomputes/prunes overrides.
- Cross-project material queries.

## Backend Work

- Drift report service for `project_materials[]`.
- Source lookup through current Materials catalog APIs.
- Structured states:
  - `in_sync`;
  - `customized`;
  - `drifted`;
  - `source_deactivated`;
  - `source_missing` if the catalog row cannot be found.
- Refresh diff model with field-level choices.
- `refresh_project_material_from_catalog` command.
- Audit/log event naming aligned with project-document conventions.

## Frontend Work

- Drift badges on segment chips and material cards.
- Assemblies active-assembly drift banner.
- Specifications page drift summary.
- Refresh dialog with keep mine / take catalog / edit value choices.
- Unit-aware display of physical value diffs while all comparisons and
  writes remain canonical SI.
- Review-all report with per-material actions only.
- Read-only behavior for viewer/locked versions.

## Verification Gates

Backend:

- version mismatch drift;
- same-version field delta drift;
- local override default behavior;
- source deactivated;
- refresh writes chosen values and updates `catalog_version_id` /
  `synced_at`;
- refresh preserves `local_overrides` verbatim.
- displayed IP/SI values do not change drift predicates or local
  override tracking.

Frontend:

- badge visibility;
- review-all report grouping;
- dialog default choices;
- failed refresh preserves dialog state.

Browser:

1. Pick catalog material into a segment.
2. Modify catalog material current version.
3. Verify drift badge/banner appears.
4. Toggle IP/SI and verify physical-value diffs reformat without
   changing drift state.
5. Open refresh dialog; keep one field, take another, edit a third.
6. Apply and verify project material values update only after explicit
   confirmation.
7. Deactivate source row and verify `source_deactivated` state.
8. Open locked/viewer version and verify drift is visible but not
   actionable.

Commands:

```bash
cd backend
uv run ruff check .
uv run ty check
uv run pytest tests/test_catalogs.py tests/test_project_document_refresh.py

cd ../frontend
pnpm run format
pnpm test -- --run src/features/envelope
pnpm run build
```

## Success Criteria

1. Project values never change because the catalog changed upstream.
2. Drift states are visible where users make material decisions.
3. Refresh requires explicit field-level choices.
4. Source deactivation is understood as a catalog problem, not invalid
   project data.

## Risks

- **Drift predicate diverges from Windows refresh.** Mitigation:
  compare behavior against the current `project_document/refresh.py`
  contract before coding.
- **Same-version field drift gets missed.** Mitigation: test in-place
  catalog edits explicitly.
- **Review all becomes bulk apply.** Mitigation: keep report actions
  per-material only in v1.

## Lessons To Capture

Record lessons for:

- drift status vocabulary;
- refresh default choices;
- source-deactivated UX;
- reusable refresh abstractions with Windows.
