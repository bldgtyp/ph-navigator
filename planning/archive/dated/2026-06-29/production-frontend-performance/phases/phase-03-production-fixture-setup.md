---
DATE: 2026-06-29
TIME: 17:49 EDT
STATUS: Implemented locally - production command not executed.
AUTHOR: Codex
SCOPE: Guarded production fixture setup path for frontend perf testing.
RELATED:
  - planning/refactor/production-frontend-performance/PLAN.md
  - backend/scripts/seed_perf_stress_fixture.py
  - backend/scripts/README.md
  - backend/tests/test_seed_perf_stress_fixture.py
---

# Phase 03 - Production Fixture Setup

Implemented in `backend/scripts/seed_perf_stress_fixture.py`.

## Command Shape

Run from the production API environment only:

```bash
cd backend
uv run python -m scripts.seed_perf_stress_fixture \
  --confirm-production \
  --email codex@testing.com \
  --table-rows 250 \
  --equipment-rows 250
```

If `--password` is omitted, the command prompts for the testing-account
password and does not print it.

## Behavior

- Refuses to run unless `settings.environment == "production"`.
- Refuses production fixture reset without `--confirm-production`.
- Refuses production fixture setup for any email other than
  `codex@testing.com`.
- Refuses production fixture setup for any BT number other than `PERF-STRESS`.
- Creates or repairs the `codex@testing.com` testing account.
- Creates or resets the same `PERF-STRESS` project in place.
- Seeds 250 Spaces / Space Types / Thermal Bridges rows.
- Seeds 250 rows in the existing equipment stress tables.
- Reuses the starter Envelope assemblies and Apertures fixture data.
- Clears and re-seeds the project-scoped Climate location/source rows.
- Leaves 3D Model data absent.
- Prints the resulting `PERF_PROJECT_ID` and a read-only production matrix
  command with password placeholder only.

## Reset Policy

Reset in place. Keep the stable `PERF-STRESS` project id unless a future run
finds a documented reason to recreate the fixture.

## Verification

Commands run locally:

```bash
cd backend && uv run ruff check scripts/seed_perf_stress_fixture.py tests/test_seed_perf_stress_fixture.py
cd backend && uv run pytest tests/test_seed_perf_stress_fixture.py
```

Results:

- Ruff passed.
- Focused backend tests passed: 4 tests.
- The pure fixture-shape test validates the 250-row document shape and confirms
  Envelope/Apertures seed data are present.
- Guard tests validate the production-environment requirement, explicit
  confirmation requirement, and exact production account/project scope.

Not run:

- The production fixture setup command.
- Any direct production DB mutation from this workspace.
