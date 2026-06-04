---
DATE: 2026-05-26
TIME: 18:21 EDT
STATUS: Proposed implementation plan.
AUTHOR: Codex
SCOPE: Read-only Envelope routes, sidebar, canvas, and Specifications
       scaffold.
RELATED:
  - planning/archive/assembly-builder/PRD.md §§7-10
  - planning/archive/assembly-builder/phases/phase-01-backend-domain-contracts.md
  - context/UI_UX.md §2.7
  - context/user-stories/20-envelope.md US-ENV-1..4, US-ENV-13
  - context/technical-requirements/frontend-viewer-units.md
---

# Phase 2 - Read-Only Envelope Shell

## Goal

Build the browser-visible Envelope shell in read-only form. This phase
proves routing, data loading, layout, version/viewer/locked behavior,
and the basic assembly mental model before editor commands are added.

## In Scope

- Envelope tab routing:
  - `/projects/{id}/envelope`;
  - `/projects/{id}/envelope/assemblies`;
  - `/projects/{id}/envelope/assemblies/{assembly_id}`;
  - `/projects/{id}/envelope/specifications`.
- Bare `/envelope` redirect to `/envelope/assemblies`.
- Read-only assembly sidebar with natural sort.
- Assembly header with active picker, total thickness, placeholder
  thermal label, zoom controls, and disabled editor actions.
- Proportional canvas rendering for layers and segments.
- IP/SI-aware read-only labels for layer thickness, segment width,
  material conductivity / lambda, total thickness, and placeholder
  thermal states.
- Null-material visual treatment.
- Material legend.
- Specifications scaffold with one card per project material, use-site
  list including segment use-site notes, empty states, and viewer hiding
  of `na`/unused cards.
- Locked-version banner and viewer-mode read-only affordance behavior.
- Frontend feature package skeleton under
  `frontend/src/features/envelope/`.

## Out Of Scope

- Add/edit/delete actions.
- Material picker.
- Shared material editor.
- Asset upload and preview.
- Real thermal backend calls.
- Catalog drift refresh.
- MCP tools.

## Dependencies

- Phase 1 read endpoint and fixtures.
- Existing project workspace routing and version controls.
- Existing auth/viewer/locked-version state.

## Workstreams

### Route And Data Loading

Add route modules and TanStack Query hooks for the envelope read
endpoint. The route should tolerate:

- no assemblies;
- invalid active assembly id in the URL;
- draft source vs saved version source;
- locked versions;
- anonymous viewer mode.

### Canvas Rendering

Render the visual assembly as the primary object, not as a decorative
card. Preserve aspect ratio by sharing one zoom scale across layer
height and segment width. Horizontal overflow scrolls instead of
compressing segments.
Unit toggling must not change canonical geometry, scroll position, or
`canvasZoom`; it only changes labels, tooltips, and formatted physical
values.

### Specifications Scaffold

Render material cards from derived use-sites. Keep upload/edit controls
hidden for now. This phase should establish the sorting and viewer
visibility rules that later evidence workflows reuse. Use-site notes are
read-only in this phase but must appear on the correct segment row.
Material physical values should already use shared unit helpers so
Specifications does not start life with hard-coded SI labels.

## Verification Gates

Frontend:

- route tests for redirects and active assembly id handling;
- component tests for empty / populated / viewer / locked states;
- component tests that use-site notes render with the expected segment;
- component tests that toggling IP/SI changes labels/values without
  changing canvas dimensions or dirty state;
- build passes.

Browser:

1. Open seeded project as editor on unlocked version.
2. Navigate to `/envelope`; verify redirect.
3. Select assemblies by sidebar and header picker.
4. Open deep link to a specific assembly.
5. Switch to locked version; verify edit controls are absent/disabled.
6. Open anonymous viewer; verify visible evidence/cards obey viewer
   rules.
7. Toggle SI/IP and verify layer/segment/material labels update while
   canvas proportions stay stable.

Commands:

```bash
cd frontend
pnpm run format
pnpm test -- --run src/features/envelope
pnpm run build
```

Run `make smoke` if route changes affect the app shell.

## Success Criteria

1. A user can inspect seeded assemblies and project materials without
   editing anything.
2. Empty state makes a brand-new project coherent.
3. Locked and viewer modes are visually consistent with other project
   surfaces.
4. The UI establishes stable component boundaries for later command
   phases.

## Risks

- **Read-only shell grows into editor state too early.** Mitigation:
  keep controls disabled/hidden and avoid command payload work in this
  phase.
- **Canvas layout regressions on narrow widths.** Mitigation: browser
  screenshots for desktop and narrow viewport before phase closeout.
- **Specifications duplicates confusing users.** Mitigation: display
  project-material id/category/use count where duplicate names exist.

## Lessons To Capture

Add PRD lessons if the real UI changes:

- canvas scale/overflow policy;
- duplicate material disambiguation;
- viewer visibility rules;
- empty-state copy or routing.

## Implementation Progress Notes

Updated 2026-05-27:

- Added the read-only `frontend/src/features/envelope/` package with
  API/query hooks, typed read contracts, assembly routing, canvas,
  sidebar, legend, and Specifications scaffold.
- Routed project nested tab paths through `/projects/:projectId/:tab/*`
  so `/envelope/assemblies/...` and `/envelope/specifications` can be
  handled inside the Envelope feature boundary.
- Browser smoke used seeded project
  `50e5bd2e-50cc-446d-8356-bfae4aba678e` at
  `http://localhost:5175`, backend `http://localhost:8001`, and verified
  redirect, deep link rendering, editor read-only affordances, SI/IP
  label switching, and Specifications use-site display.
- `make smoke` was not runnable from this worktree because the shared
  Docker container name `phn-v2-postgres` was already owned by another
  compose project. Equivalent local checks used the existing healthy DB,
  `backend/scripts.check_db`, and the browser smoke above.
- Simplify pass tightened frontend DTO unions to the backend contract,
  centralized Envelope route path helpers, reused shared natural-name
  sorting, sorted Specifications materials by completion/use state, and
  added tests for invalid assembly ids and empty assemblies. Committed
  as `bd77dee` on `codex/assembly-builder-phase-02`.
- Post-simplify verification passed:
  `pnpm exec vitest run src/features/envelope/__tests__/EnvelopePage.test.tsx src/features/windows/lib.test.ts`,
  `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm run build`,
  `pnpm run check:shape`, and `git diff --check`.
