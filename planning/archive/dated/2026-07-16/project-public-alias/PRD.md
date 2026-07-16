---
DATE: 2026-07-15
TIME: 20:44 EDT
STATUS: ✅ COMPLETE — all phases built + CI-green 2026-07-16; see STATUS.md.
AUTHOR: Claude (Opus 4.8) for Ed May
SCOPE: Behavior contract for project public alias.
RELATED: ./README.md; ./STATUS.md
---

# PRD — Project public alias

> **Resolved 2026-07-16 (Ed).** The open questions below are settled and the rule
> simplified. Final model: `display_name = public_alias ?? name`, computed
> **server-side** and shown to **everyone** (a universal override, not a
> viewer-branch). With **no alias, the real name shows** — privacy is opt-in.
> Once an alias is set, the internal `name` is additionally redacted to the alias
> for principals without `PROJECT_VIEW_PRIVATE` (anonymous/`client`), server-side,
> so API/MCP client tokens can't read it either. See STATUS.md §"Resolved model".
> Sections below are kept as the original contract; where they differ (the
> `displayName(viewer)` helper, the non-identifying fallback) the resolved model
> wins.

## Problem

The internal project name may include a client/family name or other identifying
information. On any public-facing surface, showing that name leaks information the
user wants private.

## Goal

- Add a nullable **`public_alias`** string to the project (user-settable).
- Anywhere a project title/name is rendered in a **public / anonymous** context,
  show the alias instead of the internal name.
- In **authenticated / internal** contexts, keep showing the real internal name
  (that's the name the user knows the project by).

## Data model

- New column on the project: `public_alias TEXT NULL` (backend
  `features/projects/models.py` + Alembic migration; surface through
  `service.py` and the project read/update payloads).
- Editable via `ProjectSettingsModal.tsx`.

## Display resolution rule (the crux)

Define a single helper for "name to display" so the rule lives in one place:

```
displayName(project, viewer):
  if viewer is public/anonymous:   return project.public_alias ?? <fallback>
  else (authenticated/internal):   return project.name
```

Apply it at every title site: breadcrumb (`ProjectShell.tsx`), page/document
titles, dashboard cards (`Dashboard.tsx`), and — importantly — the **HTML
document `<title>`** and any share/OG metadata on public pages.

**Open Q — fallback when no alias set on a public page.** Options: (a) show the
real name (defeats the purpose — reject), (b) show a neutral placeholder like the
project's short code / id, (c) hide the title. Recommend (b): fall back to a
non-identifying token (e.g. project number "2613") rather than the name.

## Open questions

1. **Which contexts count as "public"?** Presumably anonymous readers of a
   project whose `access_mode` allows public read. Confirm the exact surfaces
   that are reachable unauthenticated, and that none of them render `project.name`
   directly today.
2. **Fallback** when `public_alias` is null on a public page (see above).
3. **MCP / API exposure.** Should read tools that can be hit by a public/agent
   token return `name` or only `public_alias`? Align with the token scope model.
4. **Other identifying fields.** Alias covers the *name*. Are there other public
   surfaces that leak identity (location/address, client field, file names)? Out
   of scope for this item but worth noting for the access-model track.

## Acceptance

- A user can set/clear `public_alias` in project settings.
- Public/anonymous pages (including `<title>` and share metadata) show the alias
  (or the agreed fallback), never the internal name.
- Authenticated internal views still show the internal name.
- No public surface renders `project.name` directly (audited).
