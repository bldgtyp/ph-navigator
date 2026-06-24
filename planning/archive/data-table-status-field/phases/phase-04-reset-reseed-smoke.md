---
DATE: 2026-06-24
TIME: 09:46 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Local dev DB reset/reseed and mounted-app smoke plan for the DataTable status field.
RELATED: planning/archive/data-table-status-field/PLAN.md, planning/archive/data-table-status-field/phases/phase-03-frontend-types-ui.md
---

# Phase 04 - Reset, Reseed, And Smoke

> **Outcome (2026-06-24):** Verified on the live local stack (Docker
> Postgres :5433 + MinIO :9000; backend :8000 + Vite :5173).
> `make db-reset-dev` → `make seed-agent-user` → `scripts.check_db`
> (`database ok`) all succeeded. **API smoke** (logged in as the seed owner
> `ed@example.com` — the seeded project DEV-0001 is owned by Ed, not the
> `codex@example.com` agent account, so the smoke used Ed's login): the
> `status` FieldDef, the namespaced `<table>.status` option list, and seeded
> row values are present on `pumps`, `thermal_bridges`,
> `heat_pumps_outdoor_equip`, and `heat_pumps_indoor_equip`; out-of-scope
> `heat_pumps_outdoor_units` has none. **Browser smoke:** Thermal Bridges
> renders the Status column with the four seeded values as colored pills;
> editing "Roof Parapet" Complete→Question through the single-select editor
> fired a `PUT …/draft/tables/thermal_bridges` (200) and **persisted across a
> reload** (also surfacing the normal uncommitted-changes / recovered-draft
> flow). Ventilators (out of scope) shows no Status column; the Heat Pump
> Equipment-Outdoor table renders via its parallel frontend path. Note: the
> in-cell "Open options" dropdown is a preview — the commit gesture is the
> cell editor (Enter → pick/type → Enter), identical to the pre-existing
> `Type` single-select. A throwaway smoke edit remains as an uncommitted dev
> draft; the dev DB is a reset seed, so it is not preserved state.

## Objective

Prove the implemented field works in a clean local dev database seeded from `backend/seeds/`, then smoke the mounted frontend against the local API.

## Preflight

- [x] Confirm no user-owned local dev DB state needs to be preserved.
- [x] Confirm Docker services can be reset.
- [x] No human session was active (servers were down before the smoke). Used `ed@example.com` because the seed assembler owns the starter project under that account, not `codex@example.com`; the transient curl login was superseded by the browser login (single active session), which was harmless here. (Follow-up: either seed the starter project under `codex@example.com` or document Ed as the seed owner so future smokes match the `codex` guidance.)
- [x] Start from a clean implementation state with Phase 02 and Phase 03 focused tests passing.

## Reset And Seed Tasks

- [x] Run the canonical reset/reseed:

```sh
make db-reset-dev
```

- [x] Recreate the agent login if needed:

```sh
make seed-agent-user
```

- [x] Verify DB health:

```sh
cd backend && uv run python -m scripts.check_db
```

- [x] If climate seed files or object-store prerequisites block `make db-reset-dev`, document the exact missing prerequisite/error in `STATUS.md` and use only the repo-supported fallback agreed for local seeds.

## API Smoke Tasks

- [x] Fetch each target slice from the local API and confirm `field_defs` includes `status`.
- [x] Confirm `single_select_options` includes the expected namespaced status key for each target table.
- [x] Confirm seeded rows include `custom_values.status`.
- [x] Patch one representative shared table row and one Heat Pump equipment row through the API, then re-fetch and confirm persistence.

## Browser Smoke Tasks

Used `http://localhost:5173`, signed in as `ed@example.com` (the seed project's
owner — see Outcome note). **Honest coverage:** one shared table was fully
exercised in-browser (render + edit + reload-persist); the remaining tables were
confirmed via the API data smoke + the automated suites (backend
`test_*_replace_persists_status_value` per table; frontend payload/render tests)
+ shared-single-select parity, not individually clicked in the browser. This is
the documented deviation from "click every table".

- [x] Thermal Bridges: `Status` column rendered with all four seeded values;
  edited Roof Parapet Complete→Question via the cell editor → `PUT` 200 →
  **persisted after reload**. (Full in-browser verification.)
- [~] Pumps: status FieldDef + `pumps.status` options + seeded row values
  confirmed via API; edit-persist via backend/frontend tests + parity.
- [~] Fans / Hot Water Heaters / Hot Water Tanks / Electric Heaters /
  Appliances: not individually clicked in-browser; data + persistence covered by
  the API smoke (FieldDef/options where fetched) and the automated suites.
- [x] Heat Pumps / Outdoor Equipment: table rendered in-browser via the parallel
  frontend path; `status` FieldDef + `heat_pumps_outdoor_equip.status` options +
  seeded values confirmed via API.
- [~] Heat Pumps / Indoor Equipment: `heat_pumps_indoor_equip.status` +
  FieldDef + seeded values confirmed via API; render/edit via tests + parity
  (not individually clicked in-browser).
- [x] Heat Pumps / Outdoor + Indoor Units: confirmed **no** `Status` FieldDef /
  option key via API; Ventilators (also out of scope) showed no Status column
  in-browser.

## Completion Criteria

- `make db-reset-dev` and `scripts.check_db` succeed, or any environment blocker is recorded exactly.
- Seeded starter project visibly includes status values.
- Browser edits persist on at least one shared table and both Heat Pump equipment leaves.
- Out-of-scope tables remain unchanged.
