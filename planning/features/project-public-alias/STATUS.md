---
DATE: 2026-07-15
TIME: 20:44 EDT
STATUS: Active
AUTHOR: Claude (Opus 4.8) for Ed May
SCOPE: Disposition + phase map for project-public-alias.
RELATED: ./README.md; ./PRD.md
---

# STATUS — Project public alias

**State:** Active — captured from the 2026-07-15 UI batch. Not scoped to detailed
phases.

## Phase map (proposed)

- **Phase 1 — Data + API.** Add `public_alias` column + migration; expose in
  project read/update payloads and settings service.
- **Phase 2 — Settings UI.** Edit field in `ProjectSettingsModal.tsx`.
- **Phase 3 — Display resolution.** Central `displayName(project, viewer)` helper;
  swap every title site to use it; cover `<title>` + share/OG metadata.
- **Phase 4 — Audit.** Grep every render of `project.name` on public surfaces to
  confirm none leak; align MCP/API exposure (open Q #3).

## Next step

Resolve PRD open questions #1 (which contexts are public) and #2 (null-alias
fallback) with Ed. #1 depends on the current access-model surfaces — reconcile
with the 2026-06-27 access-model review before Phase 3.

## Blockers

- Soft: Phase 3 needs the "which surfaces are public" answer to be complete.

## Verification (when built)

- Set an alias; load the project's public surface unauthenticated → alias shown.
- Load the same project authenticated → internal name shown.
- Clear the alias; confirm the agreed fallback (not the real name) on public.
