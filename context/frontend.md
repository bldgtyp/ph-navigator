# Frontend Structure & Conventions

React + TypeScript SPA (MUI). Feature‑first organization; contexts & hooks drive data and units.

## 1. Tech Stack

- React 19, TypeScript
- MUI (DataGrid, theming, styled components)
- TanStack Query (React Query v5) for server state (caching, dedup, background refetch)
- React Context for UI state and as thin wrappers over TanStack Query hooks
- REST API calls via `fetchApi.ts` (throws on error) for TanStack Query, legacy `*WithAlert` helpers (return null) for non-migrated code
- ESLint + Prettier

## 2. Directory (High-Level)

```
frontend/
  src/
    api/
      fetchApi.ts           (fetch wrapper that THROWS on error — used by TanStack Query)
      queryClient.ts        (shared QueryClient instance with default options)
      queryKeys.ts          (centralized query key factory)
      getWithAlert.ts       (legacy fetch wrapper — returns null on error, shows alert)
      postWithAlert.ts      (legacy)
      patchWithAlert.ts     (legacy)
      deleteWithAlert.ts    (legacy)
    data/
    features/
        auth/               (login and auth)
        project_view/       (single project view)
            data_views/
                <domain>/
                    _hooks/         (TanStack Query hooks: use<Domain>Query, use<Domain>Mutation)
                    _contexts/      (thin wrapper contexts delegating to _hooks/)
        project_browser/    (admin view of all user's projects)
        types/
    formatters/             (common utilities used to format values for rendering)
    styles/                 (MUI theme & palette)
    index.tsx
    App.tsx                 (entry point — wraps app in QueryClientProvider)
```

## 3. Naming Patterns

- Context provider file: `<Domain>.Context.tsx`
- Query hook: `use<Domain>Query.ts` (in `_hooks/`)
- Mutation hook: `use<Action><Domain>Mutation.ts` or `use<Domain>Mutations.ts` (grouped, in `_hooks/`)
- General hook: `use<Thing>.ts / .tsx`
- Data grids: `<Domain>.DataGrid.tsx`
- Column def hook: `<Domain>.TableFields.tsx` or `use<Domain>Columns.ts`
- Feature pages: PascalCase folders

## 4. Context Responsibilities

### UI-Only Contexts (no server state)
- UserContext: auth/session (login, logout, JWT token)
- UnitSystemContext: 'SI' | 'IP' toggle (all DB values remain SI)
- ApertureViewDirection / Zoom: pure UI state
- AssemblySidebar / ApertureSidebar: pure UI state
- DimensionsContext: pure UI state
- CopyPaste contexts: UI state, mutations delegate to parent contexts
- MediaUrlsContext: client-side Maps, receives data from other contexts

### Server-State Contexts (thin wrappers over TanStack Query)
These contexts keep the same interface for consumers but internally delegate to TanStack Query hooks:

- **ProjectStatusDataContext** — read-only, wraps `useProjectStatusQuery`
- **MaterialsContext** — read-only, wraps `useMaterialsQuery` (keeps `setMaterials` for Assembly.Context compatibility)
- **FrameType.Context** — read + refresh mutation, wraps `useFrameTypesQuery` + `useRefreshFrameTypesMutation`
- **GlazingTypes.Context** — read + refresh mutation, wraps `useGlazingTypesQuery` + `useRefreshGlazingTypesMutation`
- **ManufacturerFilter.Context** — read + update mutation, wraps `useManufacturerFilterQuery` + `useUpdateManufacturerFilterMutation`
- **Assembly.Context** — full CRUD, wraps `useAssembliesQuery` + 8 mutation hooks from `useAssemblyMutations.ts`
- **Aperture.Context** — full CRUD, wraps `useAperturesQuery`, mutations call `ApertureService` and update cache via `queryClient.setQueryData()`

## 5. Unit Conversion Pattern

- Always store / fetch SI
- Display layer: useUnitConversion()
  - valueInCurrentUnitSystemWithDecimal(value, siUnit, ipUnit, decimals)
  - Headers & cells recomputed via useMemo on unitSystem
- Do not mutate raw data with converted values

## 6. DataGrid Conventions

- Columns arrays memoized (useMemo / custom hook) → prevents state loss & loops
- useDynamicColumns: derives minWidth from content + header
- Avoid stateful effects when pure derivation suffices
- Provide stable row id (id field from backend)

## 7. Error & Loading UI

- LoadingModal / skeleton placeholders at block level
- ErrorBoundary at App root
- Domain hooks ideally return { data, isLoading, error }

## 8. Adding a New Feature (Checklist)

1. Add query key(s) to `api/queryKeys.ts`
2. Create `_hooks/use<Domain>Query.ts` using `useQuery` + `fetchGet` from `fetchApi.ts`
3. If mutations needed: create `_hooks/use<Domain>Mutations.ts` using `useMutation` + `invalidateQueries`
4. Create or update context as thin wrapper (keep interface stable for consumers)
5. Add service functions if complex API logic (e.g. `ApertureService`)
6. Build column hook (dynamic headers if units)
7. Implement DataGrid component
8. Integrate into router & navigation

## 9. API Interaction

### Two fetch layers (do not mix)

| Layer | File | Behavior | Used by |
|-------|------|----------|---------|
| **New** | `api/fetchApi.ts` | **Throws** on error | TanStack Query hooks (`useQuery`, `useMutation`) |
| **Legacy** | `api/getWithAlert.ts`, etc. | Returns `T \| null`, calls `window.alert()` | Non-migrated code (e.g. `handleDownloadConstructions` blob download) |

When writing new data-fetching code, always use `fetchApi.ts` with TanStack Query. Do not use the `*WithAlert` helpers for new code.

### TanStack Query patterns

- **QueryClient** (`api/queryClient.ts`): `staleTime: 5min`, `retry: 1`, `refetchOnWindowFocus: false`. Default mutation `onError` calls `alert()`.
- **Query keys** (`api/queryKeys.ts`): centralized factory. Always add new keys here. Keys are `readonly` tuples.
- **Query hooks**: named `use<Domain>Query`, return `{ data, isLoading, error }`.
- **Mutation hooks**: named `use<Action><Domain>Mutation`, call `invalidateQueries` on success.
- **Cache updates**: for mutations that return updated data, use `queryClient.setQueryData()` for instant UI updates (avoids flicker). For simpler cases, `invalidateQueries` triggers a background refetch.
- **Error handling**: `fetchApi.ts` throws → TanStack Query catches → QueryClient default `onError` calls `alert()`. Individual mutation hooks can override with their own `onError`.
- **Thin wrapper strategy**: context interfaces remain unchanged so consumer components need zero changes. Context providers delegate internally to TanStack Query hooks.

## 10. Common Pitfalls

- Infinite re-render: columns recreated without memo; state set in render/memo
- Cascading deletes assumed without backend cascade → confirm API behavior
- Using delete-orphan logic assumptions in frontend (only reflect backend truth)
- Calling hooks at module scope (must be inside component/custom hook)

## 11. Styling/Theming

- MUI Theme extended in theme/ (palette, typography)
- Use sx prop for one-off tweaks; styled() for reusable variants
- Keep spacing & sizing tokens consistent (theme.spacing)

## 12. Window SVG Tooltips

- Frame edges in the Window SVG expose per‑side hover tooltips via MUI `Tooltip`.
- Hover highlight is scoped to the specific frame edge (top/right/bottom/left), not the full element.
- Tooltip text uses the frame type name from `element.frames.<side>.frame_type.name`.

## 13. Window Copy/Paste Tool

- Toolbar includes a Copy/Paste tool for window elements (frames, glazing, operation).
- Paste mode persists across aperture changes and exits on Esc or clicking outside a window element.
- Copy/paste state lives in a dedicated context provider scoped to the Windows view.
