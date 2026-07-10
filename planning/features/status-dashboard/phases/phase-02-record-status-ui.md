---
DATE: 2026-07-10
TIME: 10:08 EDT
STATUS: Planned
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

