---
DATE: 2026-09-14
TIME: 19:13 EDT
STATUS: Merged to main via PR #97 (2026-09-14); deploy pending Ed
AUTHOR: Claude (with Ed May)
SCOPE: Current state and next step
RELATED: README.md, PLAN.md
ISSUE: https://github.com/bldgtyp/ph-navigator/issues/96
---

# Status

**Merged to main** through [PR #97](https://github.com/bldgtyp/ph-navigator/pull/97)
on 2026-09-14 (squash), after GitHub Actions CI passed on the PR. It was built on
`feature/desktop-window-catalog-read`. Ed accepted the plan on 2026-09-14: D1 changed the approval copy,
and D2 archived the #90 packet (now `planning/archive/desktop-catalog-read/`).
gpt-5.6-sol built Steps 1–6. Claude reviewed the diff and applied the simplify
fixes, which tidied two lines of test parametrization.

Verification (2026-09-14, local Docker Postgres):

- `tests/test_desktop.py`: 53 collected. Together with
  `test_catalogs_frame_types.py` and `test_catalogs_glazing_types.py`,
  89 passed.
- `make format`: no changes. `make ci`: green. Backend 1,974 passed and
  7 skipped; Ruff, `ty`, and the boundary check are clean. Frontend: 287 files
  and 2,547 tests passed; ESLint 0 errors (the 18 existing warnings);
  production build passed.

Simplify skips: a combined catalogs endpoint (it would break the #96 two-route
contract) and module-scoped test clients (the autouse fixture truncates `users`
per test).

Next: Ed reviews and merges the PR, then runs Deploy Production (no
migration). After that, rerun the SketchUp Window Types phase-8f production
walkthrough: a fresh process with one retained grant, all three catalogs, and
one real Frame and one real Glazing bookshelved. That rerun is the last #96
acceptance item. Archive this packet once it passes.

Follow-up noticed, not in scope: about 8 catalog test modules each redefine a
staff sign-in helper. A shared `catalog_admin_client()` in
`tests/catalog_helpers.py` would remove the duplication.

Blocks: the SketchUp Window Types phase-8f production walkthrough
(`ph-navigator-sketchup`, branch `codex/w1-window-types`).
