---
DATE: 2026-06-24
TIME: 00:00 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Local dev DB reset/reseed and mounted-app smoke plan for the DataTable status field.
RELATED: planning/refactor/data-table-status-field/PLAN.md, planning/refactor/data-table-status-field/phases/phase-03-frontend-types-ui.md
---

# Phase 04 - Reset, Reseed, And Smoke

## Objective

Prove the implemented field works in a clean local dev database seeded from `backend/seeds/`, then smoke the mounted frontend against the local API.

## Preflight

- [ ] Confirm no user-owned local dev DB state needs to be preserved.
- [ ] Confirm Docker services can be reset.
- [ ] If Ed's browser/backend session is active, use the repo agent account (`codex@example.com`) and avoid invalidating Ed's session.
- [ ] Start from a clean implementation state with Phase 02 and Phase 03 focused tests passing.

## Reset And Seed Tasks

- [ ] Run the canonical reset/reseed:

```sh
make db-reset-dev
```

- [ ] Recreate the agent login if needed:

```sh
make seed-agent-user
```

- [ ] Verify DB health:

```sh
cd backend && uv run python -m scripts.check_db
```

- [ ] If climate seed files or object-store prerequisites block `make db-reset-dev`, document the exact missing prerequisite/error in `STATUS.md` and use only the repo-supported fallback agreed for local seeds.

## API Smoke Tasks

- [ ] Fetch each target slice from the local API and confirm `field_defs` includes `status`.
- [ ] Confirm `single_select_options` includes the expected namespaced status key for each target table.
- [ ] Confirm seeded rows include `custom_values.status`.
- [ ] Patch one representative shared table row and one Heat Pump equipment row through the API, then re-fetch and confirm persistence.

## Browser Smoke Tasks

Use `http://localhost:5173` and sign in as `codex@example.com` / `password`.

- [ ] Thermal Bridges: `Status` column appears, can be edited through all four options, and persists after reload.
- [ ] Pumps: `Status` column appears and edit persists.
- [ ] Fans: `Status` column appears and edit persists.
- [ ] Hot Water Heaters: `Status` column appears and edit persists.
- [ ] Hot Water Tanks: `Status` column appears and edit persists.
- [ ] Electric Heaters: `Status` column appears and edit persists.
- [ ] Appliances: `Status` column appears and edit persists.
- [ ] Heat Pumps / Outdoor Equipment: `Status` column appears and edit persists.
- [ ] Heat Pumps / Indoor Equipment: `Status` column appears and edit persists.
- [ ] Heat Pumps / Outdoor Units and Indoor Units: confirm no `Status` column appears.

## Completion Criteria

- `make db-reset-dev` and `scripts.check_db` succeed, or any environment blocker is recorded exactly.
- Seeded starter project visibly includes status values.
- Browser edits persist on at least one shared table and both Heat Pump equipment leaves.
- Out-of-scope tables remain unchanged.
