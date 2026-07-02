---
DATE: 2026-07-02
TIME: 15:06 EDT
STATUS: Active
AUTHOR: Codex
SCOPE: Current state for user-configurable single-select options.
RELATED:
  - ./README.md
  - ./decisions.md
  - ./PRD.md
  - ./PLAN.md
  - ./reviews/2026-07-02-critical-feature-review.md
  - ./phases/phase-00-contract-spike.md
  - ./phases/phase-01-api-guardrails.md
---

# STATUS - Configurable Single-Select Options

## State

`Active` - Phase 00 contract spike complete; implementation not started.

## Next Step

Start `phases/phase-01-api-guardrails.md`. Do not implement Rooms UI wiring
until the option-mutability contract covers all three entry points:

- field-config manage-options modal
- inline single-select create
- paste/type-to-create option deltas

## Blockers

None for Phase 01.

## Decisions

- Contract: `option_mutability = "editable" | "locked"`.
- Frontend capability: `FieldDef.optionMutability`, defaulting from
  `FieldDef.locked.includes("options")`.
- Backend capability: `TableFieldRegistry.option_editable_builtin_field_keys`.
- Allowlisted built-ins: Rooms `floor_level`, `building_zone`.
- Protected built-ins: app-owned `status` fields and other built-in
  single-selects unless explicitly allowlisted.
- Nullable Rooms referenced deletes clear cells; replacement UX is not required
  for Phase 02.
- Rooms manage-options uses typed `editFieldBundle.nextOptions` /
  `apply_edit_options`.

## Verification Ledger

- 2026-07-02: Code inspection only; no tests run.
- 2026-07-02: Phase 00 code inspection completed across DataTable
  single-select editors, paste planning, field-config options, backend
  `TableFieldRegistry`, Rooms registry, and `options_ops`. Decisions captured
  in `decisions.md`; no tests run because Phase 00 is docs/contract only.
