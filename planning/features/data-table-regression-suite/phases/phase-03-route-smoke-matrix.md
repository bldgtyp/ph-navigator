---
DATE: 2026-06-19
TIME: 19:04 EDT
STATUS: Planned
AUTHOR: Ed (via Codex)
SCOPE: Browser smoke coverage for all target table routes.
RELATED:
  - planning/features/data-table-regression-suite/PLAN.md
  - frontend/tests/e2e
---

# Phase 03 - Route Smoke Matrix

## Goal

Prove that every target table route mounts the expected DataTable surface
without conflating route/render failures with edit-behavior failures.

## Planned Tasks

1. Parameterize a Playwright smoke spec over the table matrix.
2. Open each route through the real project UI or deterministic route helper.
3. Assert table/subtab title or selected navigation state.
4. Assert expected headers are present.
5. Assert the grid exists and exposes at least one cell or valid empty-state
   affordance.
6. Assert no browser console/runtime error appears during mount.
7. Keep smoke assertions shallow and failure messages table-specific.

## Target Tables

- Space Types
- Rooms
- Ventilators
- Heat Pumps - Equipment Outdoor
- Heat Pumps - Equipment Indoor
- Heat Pumps - Units Outdoor
- Heat Pumps - Units Indoor
- Pumps
- Fans
- Hot Water Heaters
- Hot Water Tanks
- Electric Heaters
- Appliances
- Thermal Bridges

## Verification

```bash
cd frontend && E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec playwright test tests/e2e/table-regression --grep @table-smoke
```

