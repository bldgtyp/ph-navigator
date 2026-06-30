---
DATE: 2026-06-29
TIME: 21:35 EDT
STATUS: Not started
AUTHOR: Claude (Opus 4.8)
SCOPE: Fetch all of a page's table-views once and have each per-table hook read
  from that shared result instead of issuing its own GET.
RELATED:
  - ../README.md
  - ../PLAN.md
  - ./phase-01-backend-batch-endpoint.md
---

# Phase 02 — Frontend: page-scoped batch context + read-through

## Goal

On an editor page with N tables, fetch the N view configs in **one** request and
let each `useProjectTableViewState` read its config from that shared result,
skipping its own per-table GET. Preserve the load-gate UX (no default-flash) and
the debounced-save / reset paths verbatim. A table rendered without the provider
(deep-link, other page) still falls back to today's per-table fetch.

## Why context, not props

`useProjectTableViewState` (`frontend/src/features/table_views/hooks.ts`) is not
called by pages directly — it is invoked **inside `useSliceTableController`**
(`frontend/src/shared/ui/data-table/feature/useSliceTableController.ts`), once
per table, at many call sites. Threading a "preloaded view" prop would touch
every controller caller. A **React context** the page populates and the hook
reads needs zero call-site changes.

## Preferred Implementation Shape

1. **API** — `frontend/src/features/table_views/api.ts`, add:
   ```ts
   export async function fetchTableViews(
     projectId: string,
     keys: string[],
     signal?: AbortSignal,
   ): Promise<Record<string, TableViewResponse>>
   ```
   building `/api/v1/projects/${projectId}/table-views?keys=…&keys=…` and
   returning the response's `views` map.

2. **Context** — new module under `frontend/src/features/table_views/`
   (e.g. `batchContext.tsx`):
   - `ProjectTableViewsBatchProvider({ projectId, tableKeys, enabled, children })`
     — fetches the batch once (guard on `enabled` so it only runs for editors
     with a version), exposes `{ ready: boolean, get(tableKey): TableViewResponse
     | undefined, prime(tableKey, response): void, drop(tableKey): void }` via
     context.
   - `useProjectTableViewsBatch()` — reads the context; returns a no-op/`ready:
     false` default when no provider is mounted (so consumers outside a batched
     page behave exactly as today).

3. **Read-through in `useProjectTableViewState`** — minimal, surgical change:
   - Pull the batch context (`useProjectTableViewsBatch()`).
   - In the load effect, **before** starting the network fetch: if `enabled` and
     `batch.ready` and `batch.get(tableKey)` exists, seed `view` from that
     entry's `view_state.view_state` (mirroring the existing
     `if (response.view_state) setView(response.view_state.view_state)`), set
     `isLoading = false`, and **return without calling `fetchTableView`**.
   - Otherwise run today's `fetchTableView` path unchanged.
   - Keep the scope-guard (`scopeKeyRef`), abort, and `defaults`-flash handling
     intact — only the *source* of the first value changes.

4. **Keep saves/deletes per-table, refresh the shared entry** — in `flushSave`
   success and in `reset`'s delete, call `batch.prime(tableKey, …)` /
   `batch.drop(tableKey)` so a later remount of that table reads the fresh value
   from context rather than a stale seed. The hook already owns the live `view`,
   so this is remount-correctness, not a hot path.

5. **Mount the provider per page** — wrap the table area with
   `ProjectTableViewsBatchProvider`, passing the page's enabled `tableKeys`
   (from Phase 00):
   - equipment: `frontend/src/features/equipment/routes/EquipmentPageBody.tsx`
     (covers the 7 `*TableSlot`s; include heat-pump sub-tables / rooms if Phase
     00 shows they mount on load).
   - spaces: the spaces page route.
   - assets/ThermalBridges: that page route.
   - **Land equipment first**; the per-table fallback means a not-yet-wrapped
     page simply keeps fanning out (correct, just unoptimized).

## Code Areas

- `frontend/src/features/table_views/api.ts`
- `frontend/src/features/table_views/batchContext.tsx` (new)
- `frontend/src/features/table_views/hooks.ts`
- `frontend/src/features/equipment/routes/EquipmentPageBody.tsx` (+ spaces /
  thermal-bridges page routes)
- tests: `frontend/src/features/table_views/__tests__/`

## Tests / Acceptance

- New: with a provider seeding `pumps`, mounting `useProjectTableViewState({
  tableKey: "pumps", enabled: true })` yields the seeded view and issues **zero**
  `fetchTableView` calls (spy asserts 0).
- New: with the key **absent** from the batch (or no provider), the hook still
  calls `fetchTableView` exactly once (fallback intact).
- Existing `__tests__/useProjectTableViewState.test.ts` and
  `useLocalTableViewState.test.ts` pass unchanged.
- Save still PUTs and `reset` still DELETEs; after a save, a remount reads the
  fresh value (context primed), not the original seed.
- `pnpm run format` clean; `make frontend-dev-check` green.

## Rejected alternatives

- **Migrate `useProjectTableViewState` to TanStack Query + `setQueryData`
  seeding** (Strategy B). Cleaner long-term and matches the data-slice pattern,
  but rewrites a debounced, abort-aware, scope-guarded, no-flash hook — higher
  regression risk for the same request-count win. Revisit only if the context
  read-through proves awkward.
- **Threading a prop through `useSliceTableController`** — touches every call
  site; context avoids that entirely.
