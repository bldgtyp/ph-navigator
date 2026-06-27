---
DATE: 2026-06-27
TIME: 11:00 EDT
STATUS: Planned - implementation not started.
AUTHOR: Codex with Ed May
SCOPE: Phase 5 - beta gate drill and closeout.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
  - ../STATUS.md
---

# Phase 5 - Beta Gate Drill And Closeout

## Goal

Before real beta project data exists, run the complete schema-evolution drill
and record evidence that known project document bodies can upgrade.

## Scope

- Run fixture corpus upgrade tests.
- Run audit CLI against fixtures.
- Run audit CLI against local/demo project versions and drafts.
- If a staging/demo DB exists, run the audit against that corpus. This is the
  production-corpus drill half of `llm-mcp-schema.md` §10.5 (item 7); the per-PR
  fixture-corpus half (item 6) is the Phase 2 `pytest` that `make ci` runs.
- Verify read-safe recovery still handles unrecoverable invalid bodies.
- Update final docs and status.
- Run `graphify update .` after code changes.

## Acceptance Criteria

- Every known project document body audits cleanly or has a recorded exception.
- Future-version and invalid-body diagnostics are clear.
- No DB rows are mutated by read/audit flows.
- Docs identify the beta gate as complete.
- Context docs and feature docs no longer disagree.

## Verification

Expected closeout gates depend on the exact code touched, but should include:

- focused backend migration/drift/audit tests;
- audit CLI against fixtures;
- local DB audit if a dev DB is available;
- `make format`;
- broader `make ci` unless Ed explicitly narrows the gate;
- `graphify update .`.

