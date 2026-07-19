---
DATE: 2026-07-18
TIME: 22:50 EDT
STATUS: Decision recorded
AUTHOR: Codex
SCOPE: Resolve the evidence-axis status contract and identify the exact implementation slice.
RELATED:
  - planning/archive/dated/2026-07-19/documentation-page-redesign/README.md
  - planning/archive/dated/2026-07-19/documentation-page-redesign/PRD.md
  - planning/archive/dated/2026-07-19/documentation-page-redesign/research.md
---

# Phase 00 - Status Contract And Current Slice

## Goal

Record the accepted contract for Option 1A's per-axis status selects and the
current derived Datasheet/Photo evidence model before UI code changes begin.

## Work Items

- Re-read the 1A handoff and current Documentation page code.
- Confirm whether Datasheet/Photo `Question` must persist in v1. Done:
  Datasheet/Photo do not expose `Question`.
- Confirm whether Datasheet/Photo status can be set independently from
  attachments. Done: users can set `Needed` even when attachments exist.
- Choose the storage/write mapping for Datasheet and Photo select values. Done:
  persisted per-axis evidence status is required.
- Record the accepted mapping in `PRD.md` and `STATUS.md`. Done.
- List the exact files expected to change in later phases. Pending for
  implementation kickoff.

## Accepted Mapping

- Spec values: `Complete`, `Question`, `Needed`, `NA`.
- Datasheet values: `Complete`, `Needed`, `NA`.
- Photo values: `Complete`, `Needed`, `NA`.
- Datasheet/Photo upload auto-sets the matching axis to `Complete`.
- Datasheet/Photo can be manually set back to `Needed` with attachments still
  present.
- `NA` replaces the visible waiver checkbox behavior.
- Record detail modal remains part of the page.

## Implementation Implication

The current derived Datasheet/Photo model cannot represent `Needed` when one or
more attachments exist. Phase 01 needs a backend/schema slice for persisted
Datasheet/Photo evidence status and migration/backfill:

- existing waiver -> `NA`;
- existing attachment and no waiver -> `Complete`;
- no attachment and no waiver -> `Needed`.

## Acceptance

- `STATUS.md` names the accepted mapping. Done.
- The phase either keeps implementation frontend-only or explicitly adds
  backend/schema scope. Done: backend/schema scope is required.
- Later phases can implement without re-litigating evidence semantics.
