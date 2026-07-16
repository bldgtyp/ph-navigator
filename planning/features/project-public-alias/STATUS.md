---
DATE: 2026-07-15
TIME: 20:44 EDT
STATUS: Active
AUTHOR: Claude (Opus 4.8) for Ed May
SCOPE: Disposition + phase map for project-public-alias.
RELATED: ./README.md; ./PRD.md
---

# STATUS — Project public alias

**State:** Active — scoped 2026-07-16. Open questions resolved with Ed (below);
Phase 1 built.

## Resolved model (2026-07-16, Ed)

- **Display rule (supersedes the PRD's viewer-branch helper):**
  `display_name = public_alias ?? name`, **server-computed** and shown to
  **everyone** (a universal override — an alias, once set, replaces the name for
  signed-in users too, not just the public). No frontend `displayName(viewer)`
  branch is needed; title sites just render `display_name`.
- **Open Q #2 (null-alias fallback):** no fallback token — with no alias the
  **real `name`** shows, publicly included. Privacy is **opt-in**: it only kicks
  in once an alias is set. (The PRD's "non-identifying fallback" is dropped.)
- **Open Q #1 (which contexts are public) + #3 (API/MCP exposure):** the boundary
  is the existing `PROJECT_VIEW_PRIVATE` capability. Once an alias is set, the
  service redacts the internal `name` to the alias for principals lacking that
  capability (anonymous/`client`), so the real name never reaches them — enforced
  server-side, so API/MCP client-scoped tokens are covered too. Members (and the
  future `certifier`) still receive the real `name`.

## Phase map

- **Phase 1 — Data + API. ✅ DONE (2026-07-16).** `public_alias` column +
  migration `20260716_0007`; `ProjectSummary.public_alias` + computed
  `display_name`; `UpdateProjectRequest.public_alias`; repository column lists;
  client-viewer `name` redaction in `service.get_project_detail`. Covered by
  `backend/tests/test_project_public_alias.py`.
- **Phase 2 — Settings UI.** Edit field in `ProjectSettingsModal.tsx`.
- **Phase 3 — Display resolution.** Swap every title site to render the backend
  `display_name` (breadcrumb, dashboard cards, page/document titles, HTML
  `<title>` + share/OG metadata).
- **Phase 4 — Audit.** Grep every render of `project.name` on public surfaces to
  confirm none leak (MCP/API exposure already covered server-side in Phase 1).

## Next step

Phase 2 — surface `public_alias` in `ProjectSettingsModal.tsx` and the frontend
project types.

## Blockers

- None. (The "which surfaces are public" question is resolved above.)

## Verification (when built)

- Set an alias; load the project's public surface unauthenticated → alias shown.
- Load the same project authenticated → internal name shown.
- Clear the alias; confirm the agreed fallback (not the real name) on public.
