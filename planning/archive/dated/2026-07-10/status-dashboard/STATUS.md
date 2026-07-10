---
DATE: 2026-07-10
TIME: 10:08 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Current execution state for Status dashboard.
RELATED: README.md; PRD.md; PLAN.md
---

# Status — Status Dashboard

## Current state

Phases 00-04 are complete. The compact API, progressively disclosed Record status UI, invalidation, row destinations, two-pane composition, lightweight Roadmap controls, editor/viewer integration, cold-load performance, responsive behavior, and accessibility paths are implemented and verified.

The working decisions are:

- keep Record status and Roadmap on the existing Status route;
- use a quiet two-pane desktop composition and stacked responsive layout;
- summarize exactly the 12 tables governed by `STATUS_TABLE_NAMES`;
- use one compact backend read model rather than mounting/fetching full tables;
- show attention records first with bounded, user-controlled disclosure;
- keep all DATA-TABLE edits on their owning routes through exact row deep links;
- disclose Roadmap management actions only to editors, with hover, focus, keyboard, and touch parity.

## Next step

None. The completed packet is archived at `planning/archive/dated/2026-07-10/status-dashboard/`.

## Blockers

None.

## Verification completed

- Reviewed existing Status route, components, styles, hooks, API, and access-mode gates.
- Reviewed the shared DATA-TABLE status contract and 12-table source of truth.
- Reviewed table read architecture, editor batch-read seam, version/viewer source behavior, and deep-link routes.
- Used the existing Graphify graph as the first codebase query, then verified weak graph results against source.
- Phase 00 contract run: `uv run pytest tests/test_project_status_summary.py -q` produced `4 passed, 1 failed`; the only failure is the intentionally missing Phase 01 route (`404`, expected `200`).
- Phase 01: `18 passed` across summary and adjacent batch-route tests; a 500-record summary measured 50,623 bytes and the route loaded the document once.
- Phase 02: focused frontend suites `54 passed`, App suite `31 passed`, `make frontend-dev-check` passed, and the live Status route rendered without console errors.
- Phase 03: focused Status/App suites `36 passed`; `make frontend-dev-check` passed with 14 pre-existing warnings; live editor verification confirmed the quiet 2:1 layout and compact four-milestone Roadmap.
- Phase 04: backend Status suites `15 passed`, frontend Status/App suites `47 passed`, dedicated editor/viewer Playwright flow `1 passed`, `make ci` passed, and the cold editor load issued exactly one compact summary request.
