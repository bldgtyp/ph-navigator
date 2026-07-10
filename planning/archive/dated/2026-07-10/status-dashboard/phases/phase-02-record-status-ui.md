---
DATE: 2026-07-10
TIME: 10:08 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Independently loading, progressively disclosed DATA-TABLE summary UI.
RELATED: phase-01-summary-read-model.md; ../PRD.md
---

# Phase 02 — Record Status UI

## Goal

Add the attention-first project-record summary without delaying the Roadmap.

## Work

- Add typed query/API seam keyed by project, version, and source.
- Build stable skeleton, partial error/retry, no-version, and all-empty states.
- Implement compact totals, group disclosures, Heat Pump leaves, bounded lists, show-resolved, and notes expansion.
- Persist only disclosure state in session storage, scoped by project.
- Add/verify exact focus deep links on generic Equipment, Heat Pump leaves, and Thermal Bridges.
- Invalidate summary after accepted writes to in-scope tables.

## Exit gate

Focused RTL tests pass and all three destination families focus the selected record in browser smoke.

## Completion evidence

- Added the version/access-keyed React Query seam and invalidation after accepted table writes.
- Added independently loading/erroring Record status UI with compact totals, nine collapsed product groups, four Heat Pump leaves, session-only disclosure state, 10-item attention cap, resolved-item disclosure, notes clamping, and no-version state.
- Added exact generic Equipment, Heat Pump leaf, and Thermal Bridge destinations.
- Extended shared row-focus behavior to retry virtualized mounts and wired focus through generic Equipment, all four Heat Pump leaves, and Thermal Bridges.
- Focused Vitest + App route suites: `85 passed`.
- `make frontend-dev-check`: passed (14 pre-existing Fast Refresh warnings only); production Status chunk is 43.92 kB gzip.
- Live `AGENT-BROWSER` Status route: nine groups rendered, Pumps disclosure persisted across reload, Open table route was correct, and browser error log was empty.
- Simplify fixed project-switch session-state clobbering, derived Heat Pump headings from leaf count, routed every table family through virtualizer-aware DataTable focus, and removed competing double-scroll behavior.
- Docs-pass: phase/status evidence updated; durable UI narrative remains assigned to Phase 04 after the Roadmap composition is final.
