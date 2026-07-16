---
DATE: 2026-07-15
TIME: 20:44 EDT
STATUS: ✅ COMPLETE — all phases built + CI-green 2026-07-16 (branch `feature/project-public-alias`)
AUTHOR: Claude (Opus 4.8) for Ed May
SCOPE: Disposition + phase map for project-public-alias.
RELATED: ./README.md; ./PRD.md
---

# STATUS — Project public alias

**State:** ✅ COMPLETE — all four phases implemented and `make ci`-green
2026-07-16 on branch `feature/project-public-alias` (backend 1395, frontend 2203).
Open questions resolved with Ed (below). Merge/deploy is Ed's call.

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

- **Phase 1 — Data + API. ✅ DONE (`355870e4`).** `public_alias` column +
  migration `20260716_0007`; `ProjectSummary.public_alias` + server-derived
  `display_name` field (plain field, not a computed property, so it appears in
  both the validation and serialization JSON schemas — FastMCP validates tool
  output against the former); `UpdateProjectRequest.public_alias`; repository
  column lists; client-viewer `name` redaction in `service.get_project_detail`.
  Covered by `backend/tests/test_project_public_alias.py`.
- **Phase 2 — Settings UI. ✅ DONE (`f7b57f23`).** Editable "Public alias" field
  in `ProjectSettingsModal.tsx`; `public_alias`/`display_name` on the frontend
  `ProjectSummary` type; `public_alias` on `UpdateProjectPayload`.
- **Phase 3 — Display resolution. ✅ DONE (`f7b57f23`).** Title sites render the
  backend `display_name`: breadcrumb + project header (`ProjectShell`) and the
  dashboard project list (`ProjectList`; `Dashboard` delegates to it). No
  frontend viewer-branch helper — the backend owns the one resolution rule.
- **Phase 4 — Audit. ✅ DONE.** The only remaining raw `project.name` renders are
  editor-only operational surfaces (settings-name editor, delete-confirm modal,
  trash panel); those are auth-only or already server-redacted to the alias for
  anonymous viewers (Phase 1), so no public surface leaks the internal name.
  There is **no** per-project HTML `<title>`/OG metadata in the app (the tab
  title is the static `PH-Navigator V2`), so the PRD's `<title>` concern is moot.
  API/MCP exposure is covered server-side by the Phase 1 redaction.

## Verification

- `make ci` green 2026-07-16 (backend 1395 passed, frontend 2203 passed, build ok).
- Backend behaviour locked by `backend/tests/test_project_public_alias.py`:
  anonymous+alias → name redacted to alias (`"Ayers" not in response`);
  anonymous+no-alias → real name; editor → real `name`, `display_name` = alias;
  clearing the alias restores `display_name` = name.
- Frontend `ProjectSettingsModal.alias.test.tsx`: alias field renders/edits and
  sends `public_alias` (set + clear) in the update payload.
- Deferred / out of scope (PRD open Q #4): other identifying fields
  (location/address, client, file names) are not aliased — that stays with the
  access-model track.
