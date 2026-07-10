---
DATE: 2026-07-10
TIME: 10:08 EDT
STATUS: Active
AUTHOR: Codex
SCOPE: Current execution state for Status dashboard.
RELATED: README.md; PRD.md; PLAN.md
---

# Status — Status Dashboard

## Current state

Phase 00 is complete at its intended red-test boundary. Phase 01 is next.

The working decisions are:

- keep Record status and Roadmap on the existing Status route;
- use a quiet two-pane desktop composition and stacked responsive layout;
- summarize exactly the 12 tables governed by `STATUS_TABLE_NAMES`;
- use one compact backend read model rather than mounting/fetching full tables;
- show attention records first with bounded, user-controlled disclosure;
- keep all DATA-TABLE edits on their owning routes through exact row deep links;
- disclose Roadmap management actions only to editors, with hover, focus, keyboard, and touch parity.

## Next step

Implement the shared summary projection plus editor-draft and saved-version routes in Phase 01, turning the expected `404` route-contract failure green.

## Blockers

None. Product review may revise the layout or scope before implementation.

## Verification completed

- Reviewed existing Status route, components, styles, hooks, API, and access-mode gates.
- Reviewed the shared DATA-TABLE status contract and 12-table source of truth.
- Reviewed table read architecture, editor batch-read seam, version/viewer source behavior, and deep-link routes.
- Used the existing Graphify graph as the first codebase query, then verified weak graph results against source.
- Phase 00 contract run: `uv run pytest tests/test_project_status_summary.py -q` produced `4 passed, 1 failed`; the only failure is the intentionally missing Phase 01 route (`404`, expected `200`).
