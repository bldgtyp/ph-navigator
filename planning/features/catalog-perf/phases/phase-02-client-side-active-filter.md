---
DATE: 2026-06-04
TIME: 09:15 ET
STATUS: PENDING — implementation has not started.
AUTHOR: Claude (Opus 4.7)
SCOPE: Stop refetching the materials list when the "Show deactivated"
       checkbox toggles. Fetch with `include_inactive=true` once and
       filter rows in memory.
RELATED:
  - ../PRD.md §P3 Phase 2
  - planning/code-reviews/2026-06-04/materials-catalog-performance-review.md §6
  - frontend/src/features/catalogs/routes/MaterialsCatalogPage.tsx
  - frontend/src/features/catalogs/hooks.ts
  - frontend/src/features/catalogs/api.ts
---

# Phase 2 — Client-side `is_active` filter

## P0. Goal

The "Show deactivated" checkbox currently triggers a fresh API call
(`?include_inactive=true`) and a full re-render to show 3 extra
rows. After this phase, the toggle is a pure local filter operation
against the already-cached row set.

## P1. Files touched

- `frontend/src/features/catalogs/hooks.ts` — `useMaterialsQuery`
  signature change.
- `frontend/src/features/catalogs/routes/MaterialsCatalogPage.tsx` —
  derive `displayMaterials` by filtering on `is_active`.
- `frontend/src/features/catalogs/__tests__/` — update tests that
  assert on `useMaterialsQuery(true)` vs `useMaterialsQuery(false)`.
- (Optional, follow-up): the same pattern can apply to the
  FrameTypes / GlazingTypes catalogs if they have the same toggle.
  Out of scope here unless trivially adjacent.

## P2. Implementation steps

1. Change `useMaterialsQuery` to always fetch with
   `include_inactive=true` and drop the `includeInactive` parameter
   from the query key:
   ```ts
   export function useMaterialsQuery(enabled = true) {
     return useQuery({
       queryKey: catalogQueryKeys.materialsList(), // no arg
       queryFn: ({ signal }) => listMaterials(true, signal),
       enabled,
       select: (payload) => payload.items,
     });
   }
   ```

2. Update `catalogQueryKeys.materialsList` to take no argument.
   Audit `query-keys.ts` and `query-keys.test.ts` for the change.

3. In `MaterialsCatalogPage.tsx`:
   - Keep `includeInactive` local state and the checkbox UI unchanged
     visually.
   - Replace the `materialsQuery.data ?? EMPTY_MATERIALS` line with
     a `useMemo` that filters:
     ```ts
     const allMaterials = materialsQuery.data ?? EMPTY_MATERIALS;
     const materials = useMemo(
       () =>
         includeInactive
           ? allMaterials
           : allMaterials.filter((m) => m.is_active),
       [allMaterials, includeInactive],
     );
     ```
   - The downstream `rows` `useMemo` continues to depend on
     `materials` and rebuilds when the filter flips. This is fine
     once Phase 3 (virtualization) lands — until then, the re-render
     cost on toggle is unchanged but the network round-trip is gone.

4. Update the unit tests in `__tests__/MaterialsCatalogPage.test.tsx`
   that mock `useMaterialsQuery` with a `(true)` / `(false)`
   distinction; collapse to one call.

5. Audit other catalog pages
   (`FrameTypesCatalogPage`, `GlazingTypesCatalogPage`) for the same
   pattern. If they share it, fix in this phase. If not, leave
   them.

## P3. Acceptance criteria

- Toggling the "Show deactivated" checkbox on `/catalog/materials`
  fires **zero** network requests (verify via DevTools Network).
- The deactivated rows appear in the table when the checkbox is on
  and disappear when off, matching today's behavior.
- The `rows` count badge in the toolbar updates to reflect the
  filtered count.
- The "Reactivate N materials" bulk action still works on selected
  deactivated rows.
- Reactivate / deactivate / create / delete mutations still trigger
  the right cache invalidation and the new row appears in the
  filtered view.
- `make ci` is green.

## P4. Verification commands

```bash
# Type + tests
cd frontend && pnpm test -- MaterialsCatalogPage

# Manual smoke
# 1. Open /catalog/materials with DevTools Network panel open.
# 2. Click "Show deactivated" — confirm zero new requests.
# 3. Toggle off — confirm zero new requests.
# 4. Select a deactivated row and reactivate — confirm the mutation
#    fires and the row updates.
```

## P5. Risk

- **Cache staleness.** Today the toggle effectively refreshes the
  data because it issues a new request. After this phase, only the
  initial fetch (within `staleTime: 15s` per `query-client.ts`) +
  mutation invalidations refresh the data. The user can't force a
  refresh via the toggle anymore. Acceptable; `staleTime` of 15 s
  is short enough.

## P6. Effort

~20 minutes. Single-purpose change with one matching test.

## P7. Hand-off notes

Pairs well with Phase 3 — the toggle's perceived freeze is largely
the table re-render, not the network round-trip. Phase 2 alone
removes one of the two stalls; Phase 3 removes the other.
