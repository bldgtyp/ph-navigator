---
DATE: 2026-06-19
TIME: 19:04 EDT
STATUS: Complete
AUTHOR: Ed (via Codex)
SCOPE: Persisted table-view-state regression coverage.
RELATED:
  - planning/features/data-table-regression-suite/PLAN.md
  - frontend/src/features/table_views/hooks.ts
  - frontend/src/shared/ui/data-table/feature/useSliceTableController.ts
---

# Phase 06 - Table-View-State Persistence

> Split note: this phase was split out of the original "Phase 05 - Deep links
> and view state". Linked-record flows are Phase 05; this phase owns the
> persisted view-state matrix. See `STATUS.md`.

## Goal

Prove sort / filter / hide-show / reorder / group state persists by
`(projectId, tableKey)` and survives a route reload, and that the four
heat-pump leaf tables keep independent state by their stable, distinct keys.

## Planned Table-View-State Flows

1. Hide/show a column and reload.
2. Reorder a column and reload.
3. Sort and reload.
4. Filter and reload.
5. Group and reload where grouping is supported.
6. Verify heat-pump leaf tables keep independent state by stable `tableKey`
   (changing one leaf's view does not bleed into another).

## Coverage Selection

Run view-state checks against:

- Rooms
- one standard Equipment table
- all four heat-pump leaf tables
- Thermal Bridges

This avoids testing the same shared view-state behavior 14 times while still
covering the table-key families that have been risky.

## Verification

```bash
cd frontend && E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec playwright test tests/e2e/table-regression --grep @table-view-state
```

## Outcome (implemented)

`table-view-state.spec.ts` (tagged `@table-view-state`) — **4 tests, ~28s,
green**, no row seeding:

1. **Rooms** — sort + filter + group + hide all persist and survive reload.
2. **Pumps** — hide + keyboard column reorder persist and survive reload.
3. **Thermal Bridges** — sort + group persist and survive reload.
4. **Heat-pump leaves independence** — hide a distinct column on each of the
   four leaves; the read-back proves each leaf keeps only its own hide (no
   bleed), and each survives reload.

### How it works / lessons

- View-state persists to the **backend** table-views API
  (`GET/PUT /api/v1/projects/{id}/table-views/{tableKey}`), keyed
  `(user, project, tableKey)` — so distinct heat-pump `tableKey`s give fully
  independent rows, and the read-back must run as the same signed-in user.
- Saves are **debounced**, so `expectViewStatePersisted` polls the read-back
  (which doubles as the "save landed" gate before reload) instead of a fixed
  wait.
- **Column** gestures (sort/filter/group/hide/reorder) persist regardless of
  row count, so the spec seeds nothing — this also sidesteps the heat-pump
  unit-leaf add-dialog seeding entirely. (Group *rows* only render with data;
  `view.group` still saves.)
- Reorder uses the **keyboard** protocol (focus header → Space → Arrow →
  Space), far more stable in Playwright than the dnd-kit pointer drag.
- Gestures are driven from the **header context menu** ("Sort A → Z",
  "Filter by this field", "Group by this field", "Hide field"); the toolbar
  axis chips ("Sorted by …" / "Filtered by …" / "Grouped by …") and the
  hidden-header absence are the DOM signals.

### Known flake (deferred to Phase 07)

One full-directory run (`tests/e2e/table-regression`, 50 tests) flaked on the
Phase 04 `thermal-bridges` behavior test — a lingering `modal-backdrop`
intercepted the add-row click and the run reported "browser has been closed"
(load/timing over the ~3min run). Every tag passes in isolation. Phase 07
owns recording flake points and the CI decision.
