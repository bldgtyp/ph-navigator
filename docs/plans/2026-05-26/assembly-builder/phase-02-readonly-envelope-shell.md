---
DATE: 2026-05-26
TIME: 18:21 EDT
STATUS: Proposed implementation plan.
AUTHOR: Codex
SCOPE: Read-only Envelope routes, sidebar, canvas, and Specifications
       scaffold.
RELATED:
  - docs/features/assembly-builder-prd.md §§7-10
  - docs/plans/2026-05-26/assembly-builder/phase-01-backend-domain-contracts.md
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

### Specifications Scaffold

Render material cards from derived use-sites. Keep upload/edit controls
hidden for now. This phase should establish the sorting and viewer
visibility rules that later evidence workflows reuse. Use-site notes are
read-only in this phase but must appear on the correct segment row.

## Verification Gates

Frontend:

- route tests for redirects and active assembly id handling;
- component tests for empty / populated / viewer / locked states;
- component tests that use-site notes render with the expected segment;
- build passes.

Browser:

1. Open seeded project as editor on unlocked version.
2. Navigate to `/envelope`; verify redirect.
3. Select assemblies by sidebar and header picker.
4. Open deep link to a specific assembly.
5. Switch to locked version; verify edit controls are absent/disabled.
6. Open anonymous viewer; verify visible evidence/cards obey viewer
   rules.

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
