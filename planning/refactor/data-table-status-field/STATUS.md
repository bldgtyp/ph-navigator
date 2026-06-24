---
DATE: 2026-06-24
TIME: 00:00 EDT
STATUS: Active
AUTHOR: Codex
SCOPE: Current status for the DataTable Status Field refactor packet.
RELATED: planning/refactor/data-table-status-field/README.md, planning/refactor/data-table-status-field/PLAN.md
---

# Status - DataTable Status Field

## Current State

State: Active / phased implementation plan complete, implementation not started.

The planning packet is ready for implementation. No application code, seed JSON, tests, or database state has been changed as part of this planning pass.

## Next Step

Start `phases/phase-01-contract-and-seeds.md` by adding the shared `status` FieldDef / option helper, then wire it into the shared table modules and Heat Pump Outdoor/Indoor Equipment FieldDef lists.

## Open Questions

- Should existing non-dev persisted documents be backfilled, or is this intentionally scoped to new documents plus local dev reset/reseed?
- Should the `Status` single-select cell render with Materials-style status dots immediately, or is the generic single-select pill acceptable until the splash dashboard is built?

## Verification

Planning-only validation performed:

- Read `planning/.instructions.md`.
- Read `planning/features/.instructions.md` for reusable folder-shape and browser-work rules.
- Used Graphify first per repo guidance; the query was too sparse for this field contract, so source inspection followed.
- Inspected current shared table FieldDef patterns, Heat Pump leaf table patterns, Materials status UI precedent, local seed layout, and reset/reseed Make targets.
- Expanded the PRD into Phase 01 through Phase 05 implementation plans.

Runtime verification not performed because implementation has not started.
