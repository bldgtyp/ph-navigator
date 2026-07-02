---
DATE: 2026-07-02
TIME: 14:00 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: User-configurable option lists for selected project single-select fields,
  starting with Spaces / Rooms `Floor` and `Zone`.
RELATED:
  - ./decisions.md
  - ./PRD.md
  - ./PLAN.md
  - ./STATUS.md
  - ./reviews/2026-07-02-critical-feature-review.md
  - ./phases/phase-00-contract-spike.md
  - planning/features_v1.1/catalog-manage-options-modal/README.md
---

# Configurable Single-Select Options

## Scope

Define and implement user-configurable option lists for selected project
single-select fields:

- Rooms `Floor`
- Rooms `Zone`

This must be allowlisted. System-owned single-selects such as `STATUS` should
not become user-configurable.

## Read Order

1. `PRD.md` - product/schema contract.
2. `reviews/2026-07-02-critical-feature-review.md` - edge-case and API risk
   review that reframes the implementation.
3. `decisions.md` - resolved option-mutability contract.
4. `PLAN.md` - phased plan and decision points.
5. `phases/phase-00-contract-spike.md` - completed contract spike.
6. `STATUS.md` - current state and next action.
7. `planning/features_v1.1/catalog-manage-options-modal/README.md` - related
   modal precedent for catalog option cleanup.

## Classification

`planning/features` because this is a new project-schema capability with UI,
data contract, and permission/guardrail implications.
