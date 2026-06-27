---
DATE: 2026-06-27
TIME: 11:00 EDT
STATUS: Active - feature packet created; ready for implementation planning or Phase 1 start.
AUTHOR: Codex with Ed May
SCOPE: Current state, next step, blockers, verification for beta schema evolution.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
  - ./decisions.md
---

# STATUS

## Current State

- The 2026-06-27 code review recommends keeping the current JSONB/Pydantic
  project-document architecture and adding a small schema-evolution lane.
- Ed accepted all open-decision recommendations on 2026-06-27.
- This active feature packet now owns the beta schema-evolution work.
- Implementation has not started.

## Decision Ledger

| Decision | State |
|---|---|
| D0 - read-time forward-only upgrade chain | Resolved |
| D1 - real beta data trigger | Resolved |
| D2 - old saved rows remain old | Resolved |
| D3 - DB body rewrites explicit maintenance only | Resolved |
| D4 - no repair/import UI before beta | Resolved |
| D5 - built-in display names are product schema | Resolved |

## Phase Ledger

| Phase | State | Blocker |
|---|---|---|
| 1 - project-document upgrade harness | Planned | none |
| 2 - golden corpus and regression tests | Planned | Phase 1 API shape |
| 3 - audit CLI and recovery runbook | Planned | Phase 1 API shape |
| 4 - FieldDef drift and schema-bump docs | Planned | none |
| 5 - beta gate drill and closeout | Planned | Phases 1-4 |

## Next Step

Start Phase 1 when implementation is requested:

```text
planning/features/beta-schema-evolution/phases/phase-01-upgrade-harness.md
```

## Blockers

None for planning.

Implementation should not start until explicitly requested; this packet was
created as a planning step.

## Verification Posture

For this docs-only packet:

- run `git diff --check` on the new planning files;
- no runtime/backend/frontend tests are required.

For implementation phases:

- focused backend tests for project document validation, drafts, saved versions,
  migration errors, and fixtures;
- audit CLI run against fixtures;
- appropriate broader gates at closeout;
- `graphify update .` after code changes.

