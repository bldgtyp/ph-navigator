---
DATE: 2026-07-15
TIME: 14:27 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Current state and next action for Project Location town search.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
  - ./decisions.md
  - ./phases/phase-00-provider-contract-and-fixtures.md
---

# STATUS - Project Location Town Search

## Current State

**Planned. No implementation has started.**

The current modal/backend flow has been traced and the feature contract is
documented. Existing storage already supports a streetless location, and
downstream Climate consumers already use coordinates rather than requiring a
street address.

## Next Action

Begin `phases/phase-00-provider-contract-and-fixtures.md`:

1. capture representative MapTiler address/locality/postal response fixtures;
2. settle the additive candidate/result metadata shape;
3. record configured-provider success, zero-result, and failure semantics;
4. confirm an authorized MapTiler environment is available for fixture capture
   and final live smoke.

## Phase Ledger

| Phase | State | Purpose |
|---|---|---|
| 00 - Provider contract and fixtures | Planned | Freeze provider shapes, candidate semantics, and fallback reporting |
| 01 - Backend locality candidates | Planned | Parse typed MapTiler results and expose honest search capability |
| 02 - Modal town search | Planned | Separate search text from street persistence and implement locality UX |
| 03 - Verification and docs | Planned | Focused gates, live browser matrix, context reconciliation, closeout |

## Accepted Boundaries

- MapTiler is the address + locality provider.
- Census remains a keyless street-address-only fallback.
- No new provider and no database migration in this feature.
- Locality selection persists `street_address = null`.
- Town-level elevation is approximate; manual elevation/pin refinement remains
  the correction path.

## Blockers

No product decision blocker. Implementation has one operational prerequisite:
access to an authorized environment with `MAPTILER_API_KEY` for sanitized
fixture capture and the final live-provider smoke. If that is unavailable,
Phase 00 may finish its contract review but must mark fixture capture/live smoke
blocked rather than inventing provider payloads. Automated work remains
fixture-driven and keyless.

## Verification Baseline

Review-time focused baseline on 2026-07-15:

- `cd backend && uv run pytest tests/test_project_location.py -q` - `28 passed`.
- `cd frontend && pnpm exec vitest run src/features/climate/__tests__/SetLocationModal.test.tsx src/features/projects/__tests__/location-form.test.ts` - `14 passed`.
- Local keyless searches for `West Stockbridge, MA 01266` and
  `Brooklyn, NY 11232` returned no Census candidates, matching the Census
  street-address-only contract.
