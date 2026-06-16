---
DATE: 2026-06-16
TIME: 12:55 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Final verification, docs pass, and closeout for Heat Pumps link
  fields.
RELATED:
  - planning/features/heat-pump-link-fields/STATUS.md
  - planning/features/heat-pump-link-fields/PRD.md
  - context/user-stories/30-tables-equipment.md
---

# Phase 04 - Verification Closeout

## Preconditions

- Phase 02 and Phase 03 implementation complete.
- Focused frontend/backend tests pass.

## Tasks

1. Update durable docs:
   - `planning/features/heat-pump-link-fields/STATUS.md`
   - `planning/features/heat-pump-link-fields/PRD.md` if decisions
     changed during implementation.
   - `context/user-stories/30-tables-equipment.md` if the current
     Heat Pumps user-story language still says these are single-select
     pickers in a way that conflicts with implemented behavior.
2. Run format and CI:
   - `make format`
   - `make ci`
3. Browser smoke:
   - frontend `http://localhost:5173`
   - backend `http://localhost:8000`
   - login `codex@example.com` / `password`
   - Equipment -> Heat Pumps -> Units - Indoor
   - Equipment - Indoor reverse column
   - Units - Outdoor reverse column
4. Record verification evidence in `STATUS.md`.

## Acceptance Criteria

- Full closeout gate passes.
- Browser smoke confirms all link fields and reverse surfaces render in
  the starter project.
- No stale docs describe `indoor_equip_id` or `outdoor_unit_id` as
  single-select fields unless explicitly referring to pre-refactor
  history.

## Stop Conditions

- Do not mark complete while `make ci` is red.
- Do not archive this folder until the implementation is landed and
  durable docs are updated.

## Verification

Required final commands:

```bash
make format
make ci
```

## Progress - 2026-06-16

Focused verification passed before closeout:

```bash
cd frontend
pnpm exec vitest run src/features/equipment/heat-pumps/__tests__/HeatPumpsPanel.test.tsx src/features/equipment/heat-pumps/__tests__/IndoorUnitsTable.test.tsx src/features/equipment/heat-pumps/__tests__/OutdoorUnitsTable.test.tsx
```

Final closeout passed:

- `$simplify`
  - Applied cleanup for shared heat-pump link helpers, true read-only
    reverse linked-record fields, precomputed reverse indexes, modal
    query gating, and `.ts` helper module naming.
- `$docs-pass`
  - No additional durable docs needed beyond this feature packet,
    `planning/STATUS.md`, and `context/user-stories/30-tables-equipment.md`.
- `make format`
- `make ci`
  - Backend: `874 passed, 2 skipped`.
  - Frontend: `169 passed` test files / `1630 passed` tests.
  - Production build passed with the existing Vite chunk-size warning.
- `graphify update .`
  - No code-graph topology changes detected; outputs left untouched.
- Browser smoke:
  - `curl -i http://localhost:8000/api/v1/auth/session` returned the
    expected `401 not_authenticated`.
  - `curl -I http://localhost:5173` returned `200 OK`.
  - Logged in as `codex@example.com`.
  - Used local `DEV-CODEX-HP` smoke project with starter heat-pump data
    copied into its Working version.
  - Verified `Units - Indoor` linked headers/pills for `Equipment`,
    `Outdoor unit`, and `Rooms`.
  - Verified reverse `Indoor units` linked columns on
    `Equipment - Indoor` and `Units - Outdoor`.
