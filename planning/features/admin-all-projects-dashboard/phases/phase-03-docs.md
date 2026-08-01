---
DATE: 2026-08-01
TIME: 08:25 EDT
STATUS: Planned — blocked on phase-02
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Phase 3 — docs fold-back and closeout.
RELATED: ../PRD.md, ../decisions.md, ./phase-02-frontend.md
---

# Phase 3 — Docs and closeout

## Edits

| Target | Change |
| --- | --- |
| `context/ui/pages/dashboard.md` | The admin grouped view: who sees it, grouping/ordering rule, disabled-checkbox behavior for non-owned rows |
| `context/GLOSSARY.md` | "owner" as a project relationship, if the enforcement refactor did not already add it |
| `context/ui/pages/admin-users.md` | Cross-reference: the Admin preset now also implies all-project reach and the grouped dashboard |

Keep the access-model contract itself in the enforcement refactor's docs —
this feature's docs should point at it, not restate it.

## Closeout gate (`CLAUDE.md`)

1. `simplify` skill on the diff; wait for it.
2. `docs-pass` skill on the diff; wait for it.
3. `make format`
4. `make ci`
5. Re-inspect and rerun if format changed files.

## Archive

On merge, per `planning/.instructions.md`:

- Move `planning/features/admin-all-projects-dashboard/` to
  `planning/archive/dated/<merge-date>/admin-all-projects-dashboard/`.
- Add one newest-first line to `planning/archive/README.md`.
- Do the same for
  `planning/archive/dated/2026-08-01/project-ownership-enforcement/` if it merged first and is
  complete.

## Deploy

Deploying is **Ed's call**, never an agent's. Merging to `main` does not deploy.

Flag for the deploy decision: the enforcement refactor changes who can reach
which project in production. Its Phase 3 §3.5 production owner-distribution
query should be reviewed before that deploy, not after.
