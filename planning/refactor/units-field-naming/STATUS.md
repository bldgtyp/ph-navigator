---
DATE: 2026-08-02
TIME: 18:54 EDT
STATUS: Complete — implementation and all verification gates passed
AUTHOR: Claude with Ed May
SCOPE: Execution state for the units-field-naming refactor.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./decisions.md
---

# STATUS — Units metadata & field-naming truthfulness

**State:** Complete. The full PRD contract is implemented and verified on
`codex/units-field-naming`. Simplify, docs-pass, Graphify, full CI, mounted
localhost API/UI verification, and production-build checks all passed. Only
archive routing and the final closeout commit remain.

## Implemented

- All six outdoor- and indoor-equipment capacity fields publish fixed `power`
  units metadata from the backend registry: canonical `kw`, IP display
  `kbtu_h`, and explicit SI/IP precision.
- Indoor capacity keys are now `cooling_cap_kw`, `heating_cap_kw_47f`, and
  `heating_cap_kw_17f`; pump flow is now `flow_l_min`.
- v8→v9 preserves the two already-kW capacities and the already-l/min pump
  value, converts legacy 17F heating capacity by `3412.141633 Btu/h per kW`,
  and refreshes persisted built-in FieldDefs.
- The shared field-definition render merge preserves backend `numberUnits`
  when feature render metadata is applied.
- Heat-pump feature production code carries no duplicate power-units contract.
- Frozen v1/v4/v7 inputs remain unchanged; their v9 golden outputs and a new
  representative v8→v9 corpus case cover the migration chain.
- The simplify pass centralized heat-pump conversion constants in
  `backend/features/heat_pumps/units.py` and reused the existing heat-pump
  default-hidden-column definitions in the route controller.

## Already done (context, not this repo's work)

- Linde 2524 production data corrected and saved: AH-1 8.79 / 9.96 kW;
  P-1 flow 56.8 l/min.
- claude-plugins `source/phn-workflow.md` (→ generated `skills/phn/SKILL.md`)
  gained a "Write values in SI units" section with the trap list — agent-side
  mitigation until the app-side fix lands.
- claude-plugins MCP transport fix written 2026-08-02 (idle-socket reopen +
  safe single retry; "never replay an indeterminate POST" invariant preserved;
  three new tests). **Uncommitted** at handoff time.

## Closeout

Archive this completed packet under `planning/archive/dated/2026-08-02/` and
update the planning archive/status indexes after the implementation commit.

## Blockers

None. The external claude-plugins release is outside this repository and is
not required for local API/browser verification.

## Verification

Focused implementation checks passed 2026-08-02:

- `cd backend && DATABASE_URL=postgresql://phn:phn_local_only@localhost:5433/ph_navigator_v2_test uv run pytest tests/features/heat_pumps/test_heat_pumps.py -k 'capacity_field_defs_publish_canonical_power_units or capacity_units_are_discoverable_from_table_api'`
  — 2 passed, 15 deselected.
- `cd frontend && pnpm exec vitest run src/shared/ui/data-table/lib/fieldDefs/renderOverrides.test.ts`
  — 2 passed.
- Focused migration/table backend suite — 33 passed.
- Focused heat-pump/pump frontend suite — 124 passed.
- Simplify reuse/quality/efficiency pass — complete; confirmed findings fixed.
- `graphify update .` — complete after the final code changes.
- `make ci` — passed: backend 1,776 passed / 7 skipped; frontend 2,373 passed;
  lint/contract checks and production build passed.
- `make agent-browser-ready` plus the isolated Playwright probe — passed on
  `AGENT-BROWSER-806ED34DE29D`. API reads exposed only the v9 keys and
  backend-owned units metadata. Mounted headers switched Cooling/Heating
  Capacity between `kW` and `kBtu/h`, and Flow between `L/min` and `gpm`, with
  zero page-console errors.
- Phius export suite — 27 passed; exported outdoor-equipment magnitudes remain
  unchanged.

No production project write or draft mutation was performed.
