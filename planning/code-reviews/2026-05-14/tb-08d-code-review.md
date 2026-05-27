# TB-08d Code Review

Date: 2026-05-14
Reviewer: Codex
Scope: current uncommitted files for TB-08d, reviewed against `planning/ROADMAP.html` TB-08.d and the relevant `context/` docs. This is not a final-app completeness review.

## Findings

### P2 - E2E creates persistent firm catalog/project data with no teardown

`frontend/tests/e2e/windows-tb-08c.spec.ts:24-63`

The new TB-08 E2E seeds Frame and Glazing catalog rows and creates a project on every run, but it never deactivates/deletes those records or confines the test to a disposable database. That is tolerable for a one-off manual smoke, but TB-08.d promotes this into repeatable `make e2e` coverage and the config supports `E2E_BASE_URL`, so the same spec can run against staging. Frame and Glazing are global firm catalogs, not project-local scratch data; repeated runs will pollute the catalog with `E2E Frame ...` / `E2E Glazing ...` rows, make picker lists noisier over time, and can eventually slow or destabilize catalog-backed tests.

Recommended fix: make the spec self-cleaning. Prefer API-level setup/teardown in `test.step` / `finally` blocks: create the rows, remember their record IDs, and deactivate them after the assertions. If catalog deletion/reactivation semantics make hard cleanup awkward, use stable seeded fixture rows for the pick path and limit per-run mutation to the project document. Also consider tagging any unavoidable test rows with a recognizable provenance and documenting that `make e2e` is local-only unless cleanup is active.

### P3 - Diff assertion can pass against the wrong table section

`frontend/tests/e2e/health.spec.ts:101-103`

The changed assertion uses `diffDialog.getByText("0 changed paths").first()`. TB-08.b adds `window_types` to the diff response, so the dialog can now contain multiple identical `0 changed paths` strings. The test still only checks the `rooms` heading, but the count assertion is no longer scoped to the Rooms section and can pass because some other table has zero changed paths while Rooms regresses.

Recommended fix: scope the assertion to the Rooms section, or assert the expected table headings and zero-count rows together. A simple option is to add stable test IDs or table-section roles in the diff UI, then assert `rooms` and `window_types` independently.

### P3 - Commit hygiene: required E2E file is untracked; unrelated lock file is untracked

Working tree state includes:

- `frontend/tests/e2e/windows-tb-08c.spec.ts` untracked
- `.claude/scheduled_tasks.lock` untracked

The roadmap now claims `make e2e` includes `tests/e2e/windows-tb-08c.spec.ts`, so this file must be included in the TB-08d commit. The `.claude/scheduled_tasks.lock` file does not appear related to TB-08d and should not be committed; add it to an appropriate ignore rule if this lock is expected to recur.

## Notes

No additional architectural/security divergence from the TB-08d scope stood out in the changed docs/config. The data-model/API docs updates are aligned with the TB-08.b endpoint now being shipped, and the serial Playwright worker setting is defensible under the current single-seeded-editor auth policy, though it will become a suite-duration constraint as E2E coverage grows.

## Verification

Review-only. I ran `git diff --check`; it passed. I did not rerun the full local gates.
