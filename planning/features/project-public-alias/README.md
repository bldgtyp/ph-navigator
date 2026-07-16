---
DATE: 2026-07-15
TIME: 20:44 EDT
STATUS: Active — scoped 2026-07-16; Phase 1 (Data + API) built, frontend Phases 2–4 pending
AUTHOR: Claude (Opus 4.8) for Ed May
SCOPE: Add a user-settable, public-facing `public_alias` to projects, used in
  public-facing titles instead of the internal project name (which may carry
  identifying info). Backend field + migration, settings UI, and a display
  resolution rule.
RELATED:
  - backend/features/projects/models.py (project model — new field + migration)
  - backend/features/projects/service.py
  - backend/features/projects/access.py (ties to per-project access_mode)
  - frontend/src/features/projects/components/ProjectSettingsModal.tsx (edit affordance)
  - frontend/src/features/projects/routes/ProjectShell.tsx (breadcrumb / title display)
  - frontend/src/features/projects/routes/Dashboard.tsx (project cards)
  - context/PRD.md + memory: access-model review 2026-06-27 (access_mode per project)
---

# Project public alias

## Read order

1. `PRD.md` — behavior, resolution rule, open questions.
2. `STATUS.md` — disposition + phase map.

## One-liner

Projects have an internal name ("Ayers Home", "Linde Home") that can carry
identifying info we don't want exposed on public-facing pages. Add a settable
**`public_alias`** ("Manhattan Townhouse") and use it wherever a project title is
shown publicly, keeping the real name for authenticated/internal contexts.

## Item 8 (verbatim intent)

Add a public-facing alias for projects. Internally we refer to "Ayers Home" /
"Linde Home"; on public pages we don't want names or identifying information. Let
users set a public alias used in all titles where the name is referenced.

## Why it matters here

This repo is public and the product has an anonymous/public read surface (see the
2026-06-27 access-model review — per-project `access_mode`). A public alias is
the display-layer complement to that boundary: `access_mode` decides *whether* a
project is publicly readable; `public_alias` decides *what name* the public sees.
