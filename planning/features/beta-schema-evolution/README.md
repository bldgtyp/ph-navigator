---
DATE: 2026-06-27
TIME: 11:00 EDT
STATUS: Active - planning packet created; implementation not started.
AUTHOR: Codex with Ed May
SCOPE: Router for the beta schema-evolution feature.
RELATED:
  - planning/code-reviews/2026-06-27/beta-schema-evolution-readiness.md
  - planning/archive/dated/2026-06-24/backend-data-architecture-cleanup/phases/phase-07-schema-migration-mechanism.md
  - context/technical-requirements/llm-mcp-schema.md
  - context/technical-requirements/data-model.md
  - context/technical-requirements/save-versioning.md
---

# Beta Schema Evolution - Router

This feature turns the 2026-06-27 beta schema-evolution review into executable
planning. It promotes the old deferred Phase 7 obligation into a current beta
gate: before real beta project data exists, the app needs a standard way to
open, audit, and upgrade project documents saved under older data structures.

## Thesis

Keep the current JSONB/Pydantic project-document architecture. It is the right
fit for immutable project versions, raw recovery, LLM/MCP access, export, and
beta flexibility.

The missing piece is a boring schema-evolution lane:

- forward-only project-document upgraders;
- v1 golden corpus fixtures;
- a corpus/DB audit command;
- built-in `FieldDef` drift reporting;
- a schema-bump checklist and beta recovery runbook.

Read-safe recovery remains emergency access. It is not the normal update
mechanism.

## Read Order

1. `PRD.md` - problem, goals, scope, success criteria.
2. `decisions.md` - accepted decisions, including the decisions Ed locked on
   2026-06-27.
3. `PLAN.md` - phase map and sequencing.
4. `STATUS.md` - current state, next step, blockers, verification.
5. Active phase doc under `phases/`.
6. Source review:
   `planning/code-reviews/2026-06-27/beta-schema-evolution-readiness.md`.

## Phase Map

| Phase | Title | Purpose | State |
|---|---|---|---|
| 1 | Project-document upgrade harness | Establish the forward-only upgrader and wire read/save semantics | Planned |
| 2 | Golden corpus and regression tests | Lock v1 serialized fixtures and prove upgrade/idempotence behavior | Planned |
| 3 | Audit CLI and recovery runbook | Give beta operators a repeatable corpus/DB drill without DB mutation | Planned |
| 4 | FieldDef drift and schema-bump docs | Make persisted built-in field changes visible and reviewable | Planned |
| 5 | Beta gate drill and closeout | Run the full drill before the first real beta save | Planned |

## Scope Boundaries

In scope:

- project document body schema evolution;
- saved versions and drafts;
- table built-in `field_defs` and `custom_values`;
- table-view state only as cache/fingerprint hygiene;
- raw JSON recovery plus CLI/operator workflow.

Out of scope:

- moving project document tables into relational tables;
- automatic DB body rewrites as the normal path;
- a recovery/import UI before beta;
- broad catalog import/export redesign;
- climate bundle schema (`BUNDLE_SCHEMA_VERSION`) - static object-store asset on
  its own evolution lane (named in Phase 4's inventory so it is not missed);
- product-facing schema editing UX.

