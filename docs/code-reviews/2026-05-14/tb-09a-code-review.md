# TB-09a Code Review

Date: 2026-05-14
Reviewer: Codex
Scope: Current uncommitted files implementing TB-09.a, reviewed against `docs/plans/01_IMPLEMENTATION-ROADMAP.md`, `context/user-stories/10-windows.md`, and `context/technical-requirements/data-model.md`. This review treats TB-09.b/c UI, Review all, e2e, staging, and final-app Windows functionality as explicitly out of scope.

## Findings

### P2 - Drift semantics now disagree with stable context docs

`backend/features/project_document/refresh.py:250-252` marks a slot `drifted` when either the pinned catalog version differs or any compared field differs:

```python
drifted_version = current_version_id != origin.catalog_version_id
drifted_fields = any(field.ref_value != field.catalog_value for field in fields)
state: SlotState = "drifted" if (drifted_version or drifted_fields) else "in_sync"
```

The working roadmap row for TB-09 now says this is intentional: a ref is drifted when `catalog_version_id` differs from current or when any catalog field differs from the ref's stored value (`docs/plans/01_IMPLEMENTATION-ROADMAP.md:531-536`). However, the stable context docs still say drift is version-id only:

- `context/technical-requirements/data-model.md:751-754`: copied entry is drifted when `catalog_origin.catalog_version_id != current_version_id`.
- `context/user-stories/10-windows.md:1636-1638`: frame/glazing is drifted if pinned version differs from current.
- `context/user-stories/10-windows.md:1685-1693`: resolved question says drift is detected only on version mismatch; current version plus `local_overrides` is customized, not stale.

That mismatch matters for TB-09.b/c. The frontend will likely use `state === "drifted"` to show badges and "Review all" counts. Under this backend, an in-place catalog typo/value correction that keeps the same `current_version_id` can create a drift badge/report entry even though the canonical user story says the badge is version-mismatch driven. This may be the better product behavior for in-place edits, but the source of truth needs to be reconciled before TB-09.b builds UI copy and default-selection behavior on top of it.

Recommended disposition: either update `context/technical-requirements/data-model.md` and `context/user-stories/10-windows.md` to bless field-delta drift as the TB-09 contract, or change the backend state to version-only drift while still returning field deltas for diff display.

### P3 - TB-09a test matrix is slightly overstated

The implementation has useful targeted coverage, but the roadmap says TB-09.a tests include both "drifted version but identical fields" and "non-editor (Viewer) read rejected" (`docs/plans/01_IMPLEMENTATION-ROADMAP.md:564`). The current test file does not cover either case:

- `backend/tests/test_project_document_refresh.py:199-223` covers field-delta drift after an in-place catalog patch, not a new current version with identical comparable fields.
- `backend/tests/test_project_document_refresh.py:313-325` asserts unauthenticated rejection only; there is no authenticated viewer/public-read path test.

I do not see this as a functional blocker because `ProjectEditAccess` is wired on the route and the version-mismatch branch is straightforward, but the roadmap completion note currently claims proof that is not actually present. Add those two tests or narrow the roadmap evidence.

## Scope Check

Against the TB-09.a backend-only scope, the implementation is largely complete:

- `backend/features/project_document/routes.py:111-117` adds `GET /api/v1/projects/{project_id}/versions/{version_id}/refresh/window-types?source=draft|version`.
- `backend/features/project_document/refresh.py` returns a typed `WindowTypesRefreshReport` with project/version identity, source, ETags, and per-slot `RefreshSlotReport` records.
- The walker covers frame top/right/bottom/left and glazing slots, and skips hand-entered refs with `catalog_origin = null`.
- Catalog rows are loaded through existing Frame/Glazing repositories, including soft-deleted identity rows.
- Soft-deleted or missing source rows become `source_deactivated` with `current_catalog_version_id = null` and null catalog values.
- `local_overrides` is copied into the slot report and each compared field is flagged with `is_overridden`.
- The endpoint is editor-only through the existing `ProjectEditAccess` dependency.

Items correctly not considered incomplete for TB-09.a:

- Per-entry refresh dialog, default radio choices, and apply mutation.
- Review-all modal/report UI.
- Browser/e2e/staging gates.
- Materials or Envelope refresh.
- MCP write tools.

## Architecture / Security / Performance Notes

No blocking security issue found. The new route reuses the existing project edit access seam rather than adding ad-hoc auth logic, and it remains read-only.

The performance shape is acceptable for the current Window Types slice: unique `(catalog_table, catalog_record_id)` pairs are deduplicated and loaded once per request. The implementation still performs one repository call per unique catalog record; that matches the roadmap's accepted TB-09a tradeoff and should only need a true `WHERE id IN (...)` batch repository if window refs scale materially.

The hard-coded comparable field lists are a good local guardrail, but they are only as strong as the tests. If new typed columns are added to `FrameRef` or `GlazingRef`, add a schema/field-set parity assertion so the drift report cannot silently omit them.

## Verification

I ran the targeted backend refresh suite:

```bash
cd backend && uv run pytest tests/test_project_document_refresh.py -q
```

Result: 6 passed.

I did not rerun the full backend suite, frontend suite, build, or browser checks during this review.
