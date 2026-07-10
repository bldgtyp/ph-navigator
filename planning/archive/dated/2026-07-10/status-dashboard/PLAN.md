---
DATE: 2026-07-10
TIME: 10:08 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Ordered implementation and verification plan for Status dashboard.
RELATED: PRD.md; STATUS.md; phases/
---

# Implementation Plan

## Sequence

1. Lock the summary schema and table-to-route registry with contract tests.
2. Implement draft and saved-version summary reads over one shared projection service.
3. Build the Record status query/component with bounded disclosures, notes, and deep links.
4. Refactor Roadmap markup and styling; add an accessible editor-only overflow menu.
5. Verify integration, invalidation, viewer authorization, cold-load behavior, responsive layout, and payload/load budgets.

## Architectural shape

- Backend owns status normalization, counts, fallback labels, and the compact record projection.
- One shared registry maps the 12 backend table names to user-facing group/leaf labels; a test guards it against `STATUS_TABLE_NAMES` drift.
- Frontend owns grouping disclosure state, bounded list presentation, session-only expansion persistence, and route construction.
- Roadmap remains relational and independent from versioned DATA-TABLE content.
- No summary write API is added.

## Test strategy

- Backend unit tests: all four states, Unknown compatibility state, notes trimming, fallback labels, zero-row tables, Heat Pump grouping metadata, one document-store load.
- Backend route tests: editor draft vs viewer saved-version isolation and access failures.
- Frontend Vitest/RTL: loading/error independence, count rendering, bounded disclosure, show-resolved/show-all, notes expansion, deep links, no viewer controls, keyboard menu/reorder.
- Existing App route tests: Status route fetch contract and anonymous/viewer rendering.
- Playwright: editor and viewer cold land, one summary request, row focus for generic Equipment + Heat Pump + Thermal Bridge, responsive/touch action access.
- Performance evidence: response byte size and document-load count using a large deterministic fixture; browser network trace for request fan-out and layout shift observation.

## Required commands at implementation closeout

Use focused tests during phases. At final closeout:

```bash
make frontend-dev-check
make ci
graphify update .
git diff --check
```

Then run `simplify` and `docs-pass` before archive/commit work, following repo practice.
