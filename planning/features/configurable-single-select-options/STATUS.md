---
DATE: 2026-07-02
TIME: 15:06 EDT
STATUS: Active
AUTHOR: Codex
SCOPE: Current state for user-configurable single-select options.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
  - ./reviews/2026-07-02-critical-feature-review.md
  - ./phases/phase-00-contract-spike.md
---

# STATUS - Configurable Single-Select Options

## State

`Active` - planning packet expanded after a critical code-backed review; no
implementation started.

## Next Step

Start `phases/phase-00-contract-spike.md`. Do not implement UI wiring until the
option-mutability contract covers all three entry points:

- field-config manage-options modal
- inline single-select create
- paste/type-to-create option deltas

## Blockers

Requires product/schema decisions before implementation:

- Whether the existing render-time `FieldDef.locked: ["options"]` is the
  product-facing source of truth, or whether the backend also needs a named
  option-edit allowlist/lock registry.
- Whether protected app-owned fields such as `status` must reject all option
  creation/edit/delete paths, including inline create and pasted new labels.
- Whether Rooms `Floor` and `Zone` delete in-use values by clearing cells
  (current backend `editOptions` behavior for nullable built-ins) or by forcing
  an explicit replacement (current PRD language and legacy slice-replace helper).
- Whether the existing whole-table replace option editor remains in play or the
  feature standardizes on typed `editOptions` / `editFieldBundle`.

## Verification Ledger

- 2026-07-02: Code inspection only; no tests run.
