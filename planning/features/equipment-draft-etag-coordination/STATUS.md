---
DATE: 2026-06-29
TIME: 16:52 EDT
STATUS: Planned - root cause identified; implementation not started.
AUTHOR: Codex
SCOPE: Current state, next step, blockers, and verification for the stale draft ETag fix.
RELATED:
  - README.md
  - PRD.md
  - PLAN.md
  - phases/
---

# Equipment Draft ETag Coordination - Status

## Current State

Docs-only planning packet created. No application code has been changed.

Root cause identified from current code:

- `frontend/src/features/equipment/routes/EquipmentPage.tsx` mounts all
  non-heat-pump Equipment slice queries at once.
- `frontend/src/features/project_document/table-slice.ts` invalidates sibling
  editor slices after an accepted write but suppresses active refetch via
  `refetchActiveSlices: false`.
- `frontend/src/shared/ui/data-table/feature/useSliceTableController.ts`
  builds write payloads from the current `slice` prop and sends them without a
  target-slice freshness check.
- `backend/features/project_document/write_spine.py` correctly rejects stale
  draft guards with `409 draft_etag_mismatch`.

The bug appears to be a frontend cache-freshness regression, not a backend
concurrency policy bug.

## Next Step

Start P00:

```text
phases/phase-00-reproduce-and-root-cause.md
```

Use the reported workflow and/or a deterministic test harness to capture:

- first Equipment write request and response,
- new `draft_etag` after the first write,
- second Equipment write request headers,
- `409 draft_etag_mismatch` response when using the stale guard.

## Blockers

None for implementation planning.

Useful but not required for P00:

- local dev backend/frontend running on `localhost:8000` / `localhost:5173`;
- project fixture with editable Equipment tables;
- `codex@example.com` / `password` login.

## Planned Verification

Focused tests after implementation:

- `cd frontend && pnpm exec vitest run src/features/project_document/table-slice.test.ts`
- controller-level Vitest coverage for fresh-slice payload construction;
- `cd frontend && pnpm exec playwright test tests/e2e/table-regression --grep @table-draft-etag`
- `make frontend-dev-check`

Broaden only if the implementation touches wider shared table behavior:

- `cd frontend && pnpm run test:e2e:tables`
- `make ci`

## Verification Performed For This Planning Packet

- Planning instructions read:
  `planning/.instructions.md` and `planning/features/.instructions.md`.
- Current root-cause code paths reviewed.
- `git diff --check` passed.
- No runtime app tests were run because this pass created the implementation
  plan only.

## Notes

The likely regression source is the 2026-06-25 frontend performance phase that
changed sibling editor table handling from eager refetch to invalidation only.
That performance goal should stay intact; this packet should add write-time
freshness rather than restoring eager sibling refetch.
