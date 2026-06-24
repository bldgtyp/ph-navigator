---
DATE: 2026-06-24
TIME: 17:45 EDT
STATUS: Planned (blocked on prerequisite + Phase 0)
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 1 — route-based Apertures sub-tabs + panel shells + query plumbing.
RELATED: ./phase-00-backend-read-api.md, ../PRD.md
---

# Phase 1 — Routing + panel shells + query plumbing

Stand up the navigation and data wiring; render the two panels as
`MaterialsPanel` clones with real data but minimal column polish (Phase 2
finishes columns + editing).

## Routing — make the Apertures sub-tabs route-based

The Apertures sub-tab bar already lists "Apertures · Glazings · Frames"
(`frontend/src/features/apertures/routes/AperturesTab.tsx:38-42`) but uses
**state** (`AppSubTabButton`, `activeSubtab`). Convert to **route-based**,
mirroring Envelope (`EnvelopePage.tsx:298-312` using `AppSubTabLink`):

- Add `frontend/src/features/apertures/paths.ts` (mirror
  `features/envelope/paths.ts`): `aperturesBuilderPath`,
  `aperturesGlazingsPath`, `aperturesFramesPath`, an `isApertureSubroute`
  helper, and an `apertureSubpath` extractor.
- In `AperturesTab.tsx`, render `AppSubTabs` + three `AppSubTabLink`s, and switch
  body content on the subpath: builder (existing) / `GlazingsPanel` /
  `FramesPanel`. Bare `/apertures` redirects to `/apertures/builder` (the
  current single page) — mirror Envelope's `/envelope → /envelope/assemblies`.
- Confirm the project router already catches `/:tab/*` so
  `/apertures/glazings` resolves through `ProjectShell` → `ProjectTabContent` →
  the apertures tab (it does — same mechanism as envelope).

## Query plumbing — mirror envelope hooks/api

- `frontend/src/features/apertures/api.ts`: add `fetchApertureSpecReport` (the
  Phase-0 endpoint) + `fetchApertureCatalogDrift`, mirroring
  `features/envelope/api.ts:14-24,55-65`.
- `frontend/src/features/apertures/hooks.ts`: add `useApertureSpecReportQuery`
  + `useApertureCatalogDriftQuery`, mirroring `features/envelope/hooks.ts:26-97`;
  add query keys to `apertures/query-keys.ts`.
- Types: add `ProjectGlazing`, `ProjectFrame`, `ProjectGlazingRead`,
  `ProjectFrameRead`, use-site + drift types to `apertures/types.ts` (mirror
  `features/envelope/types.ts`).

## Panel shells — clone MaterialsPanel

- `frontend/src/features/apertures/components/GlazingsPanel.tsx` and
  `FramesPanel.tsx`: copy `MaterialsPanel.tsx` structure (props, status filter,
  three-section grouping, `ReportTable`, expansion). Start with the primary name
  + status columns rendering; stub datasheet/use-site wiring for Phase 2.
- Wire them into `AperturesTab.tsx` for the two subroutes, passing the query data
  + the command/attachment dispatchers (reuse the existing apertures mutation
  pathway, extended for the documentation commands).

## Verification

- `pnpm run format`; frontend type-check; `make frontend-dev-check`.
- Navigating `/apertures/glazings` + `/apertures/frames` renders a report table
  of real glazing/frame rows with a working status filter chip row.

## Exit criteria

- Sub-tabs deep-link; both panels render rows; type-check + lint clean.
