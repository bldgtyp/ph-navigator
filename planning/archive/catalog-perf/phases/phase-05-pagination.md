---
DATE: 2026-06-04
TIME: 09:45 ET
STATUS: DEFERRED — design only. Implementation waits until catalog
        row count or stakeholder ask warrants it. Current trigger:
        catalog grows past ~1,000 rows OR a user reports slow load
        on a remote (non-LAN) connection.
AUTHOR: Claude (Opus 4.7)
SCOPE: Add optional pagination to the catalog list endpoints.
       Backwards-compatible (no params = return everything).
       Frontend switches to `useInfiniteQuery` only above a
       threshold. Out of scope to ship now; document the design
       so the eventual implementation has a starting point.
RELATED:
  - ../PRD.md §P3 Phase 5, §P6
  - planning/code-reviews/2026-06-04/materials-catalog-performance-review.md §3
  - backend/features/catalogs/materials/routes.py
  - backend/features/catalogs/materials/service.py
  - backend/features/catalogs/materials/repository.py
  - frontend/src/features/catalogs/hooks.ts
---

# Phase 5 — Pagination (deferred)

## P0. Goal

When the materials catalog grows past ~1,000 rows, add optional
`limit` and `offset` (or cursor) parameters to the list endpoints
so the frontend can lazy-load pages instead of pulling the whole
catalog. Until the trigger condition is met, this phase stays
deferred.

## P1. Trigger

Ship this phase when **any one** of:

1. `SELECT COUNT(*) FROM catalog_materials` exceeds 1,000.
2. A user reports slow first-paint on the catalog page from a
   non-LAN connection (after Phases 1, 2, 3, 4 have shipped).
3. A stakeholder requests catalog search / pagination UI.

Until then, this doc is documentation of the agreed direction
rather than an implementation queue.

## P2. Open design questions

To be answered when this phase is picked up:

1. **Offset or cursor.** Offset is simpler; cursor scales better
   (no row-skipping cost as the offset grows). For ≤ 10K rows
   offset is fine. Pick offset for the first cut.
2. **Total count.** Include `total` in the response so the UI can
   render a "X of Y" label and a paging UI. Compute via a
   `SELECT COUNT(*)` alongside the page query. Cache the count if
   it becomes hot.
3. **Default page size.** 200 rows feels right — large enough to
   fill multiple viewports with virtualization (Phase 3) handling
   the render cost, small enough that wire payload stays under
   10 KB gzipped.
4. **Filter/sort interaction.** Today the frontend filters and
   sorts in memory. Once paginated, filter/sort must move
   server-side. This is the most invasive part of this phase and
   the reason it's deferred.

## P3. Sketch of the change

### Backend

`repository.py`:
```python
def list_materials(
    conn,
    *,
    include_inactive: bool = False,
    limit: int | None = None,
    offset: int = 0,
    name_search: str | None = None,
    category: str | None = None,
    sort_by: str = "name",
    sort_dir: Literal["asc", "desc"] = "asc",
) -> tuple[list[dict], int]:
    """Return (items, total_count)."""
    ...
```

`service.py`: pass the new params through, return a tuple.

`routes.py`:
```python
@router.get("/materials", response_model=CatalogMaterialPageResponse)
def get_materials(
    include_inactive: bool = False,
    limit: int = Query(default=None, le=500),
    offset: int = Query(default=0, ge=0),
    q: str | None = None,
    category: str | None = None,
    sort_by: str = "name",
    sort_dir: Literal["asc", "desc"] = "asc",
) -> CatalogMaterialPageResponse:
    items, total = service.list_materials(...)
    return CatalogMaterialPageResponse(items=items, total=total, limit=limit, offset=offset)
```

`limit = None` means "no pagination" — preserves the current
behavior for callers that haven't migrated.

### Frontend

`hooks.ts`:
```ts
export function useMaterialsInfiniteQuery() {
  return useInfiniteQuery({
    queryKey: catalogQueryKeys.materialsInfinite(),
    queryFn: ({ pageParam = 0, signal }) =>
      listMaterials({ limit: 200, offset: pageParam }, signal),
    getNextPageParam: (last) =>
      last.offset + last.items.length < last.total
        ? last.offset + last.items.length
        : undefined,
    select: (data) => data.pages.flatMap((p) => p.items),
  });
}
```

Server-side filter/sort UI is then driven by query params passed
to `listMaterials`; the `DataTable` view-state translates to those
params instead of being applied client-side.

### Indexes

Add or confirm:

- `(name, id)` for the default sort.
- `(category, name, id)` if category-filter becomes common.
- A trigram index on `name` if `q` (substring search) is wired up.

## P4. Acceptance criteria (for when this phase activates)

- `GET /catalogs/materials?limit=200` returns ≤ 200 items + a
  `total` count.
- `GET /catalogs/materials` with no params returns all items as
  today (backwards-compatible).
- Frontend renders an "X of Y" badge and lazy-loads on scroll
  (`useInfiniteQuery`).
- Server-side filter / sort work; corresponding DataTable
  view-state syncs to the URL.

## P5. Risk

- **Largest contract change in the feature.** Filter/sort moves
  from client to server. Mitigation: gate behind a frontend
  threshold — small catalogs continue to use `useQuery` and
  client-side filtering, so the migration is incremental.
- **`total` count cost.** A `COUNT(*)` over the filter set on
  every page request is wasted work. Mitigation: defer this until
  the simple version stops scaling.

## P6. Effort (estimate for when activated)

~1 day backend + ~1 day frontend + ~half a day to migrate the
DataTable view-state hook to server-side semantics. Best handled
as its own multi-phase sub-feature when the time comes.

## P7. Hand-off notes

When activating, update `STATUS.md` Phase 5 row to `Active` and
re-open this doc. Consider whether to spin this out as its own
top-level feature folder (`catalog-pagination/`) since the scope
is larger than a single phase of the current feature.
