---
DATE: 2026-08-03
STATUS: Complete
AUTHOR: Codex with Ed May
SCOPE: Retire the duplicate status-summary projection and synchronize durable
  Overview/Documentation contracts.
RELATED:
  - ../PLAN.md
  - ../PRD.md
  - ../decisions.md
---

# Phase 05 — Retire status summary

## Outcome

The backend status-summary module, routes, and tests and the frontend record
tree, query module, styles, and tests are removed. The canonical option-id map
now lives with the shared status FieldDef contract. Overview's end-to-end
coverage targets the counts-only Documentation rollup. Durable docs use the
Overview route/name and record the current summary/rollup endpoints.

## Coordination

`planning/features_v1.1/aperture-psi-install/STATUS.md` was re-read before the
consumer sweep. It still reports no implementation started, so its conditional
`status_summary.py` additions are skipped; no user-owned aperture-psi packet
files were modified or staged.

## Verification evidence

- Active-source consumer sweep is clean for `status-summary`,
  `status_summary`, `RecordStatusSummary`, `projectStatusPath`, and retired
  query-key helpers.
- Focused backend checks passed (13 tests); focused frontend checks passed (41
  tests); the production frontend build passed.
- Three-lens simplify review reconciled canonical option metadata, consolidated
  Documentation cache invalidation under one query-key prefix, and corrected
  stale route/page references.
- Docs-pass updated the UI/UX, glossary, page, technical API/DataTable, audit,
  and related refactor contracts.
- `graphify update . --force` rebuilt the graph (19,276 nodes / 59,187 edges).
- Full `make ci` passed: backend 1,822 passed / 7 skipped; frontend 2,393
  passed; production build and static gates green.
