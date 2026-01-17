# Frontend Structure & Conventions

React + TypeScript SPA (MUI). Feature‑first organization; contexts & hooks drive data and units.

## 1. Tech Stack

- React 18, TypeScript
- MUI (DataGrid, theming, styled components)
- React Context + custom hooks (no Redux)
- REST API calls (fetch)
- ESLint + Prettier

## 2. Directory (High-Level)

```
frontend/
  src/
    api/                    (common API wrappers - fetch / post / etc...)
    data/
    features/
        auth/               (login and auth)
        project_view/       (single project view)
        project_browser/    (admin view of all user's projects)
        types/
    formatters/             (common utilities used to format values for rendering)
    styles/                 (MUI theme & palette)
    index.tsx
    App.tsx                 (entry point)
```

## 3. Naming Patterns

- Context provider file: <Domain>.Context.tsx
- Hook: use<Thing>.ts / .tsx
- Data grids: <Domain>.DataGrid.tsx
- Column def hook: <Domain>.TableFields.tsx or use<Domain>Columns.ts
- Feature pages: PascalCase folders

## 4. Context Responsibilities

- UserContext: auth/session
- UnitSystemContext: 'SI' | 'IP' toggle (all DB values remain SI)
- Domain contexts (Apertures, FrameTypes, GlazingTypes): cache + expose arrays + loading flags

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

1. Create context (optional if simple read) + fetch hook
2. Add service functions (API layer wrapper)
3. Build column hook (dynamic headers if units)
4. Implement DataGrid component
5. Integrate into router & navigation
6. Add documentation snippet in context/

## 9. API Interaction

- Central fetch helper (if added) handles base URL, auth header
- Keep domain mapping (snake_case → camelCase) localized if needed
- Batch/parallel fetches via Promise.all inside provider

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
