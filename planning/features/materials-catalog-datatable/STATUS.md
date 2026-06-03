---
DATE: 2026-06-03
TIME: 20:30 EDT
STATUS: Active — planning packet complete; implementation has not begun.
AUTHOR: Claude (Opus 4.7)
SCOPE: Status ledger for the Materials Catalog DataTable migration.
RELATED:
  - README.md
  - PRD.md
  - PLAN.md
---

# STATUS — Materials Catalog DataTable

## Current state

- Research complete (catalog/envelope linkage; bookshelf is snapshot,
  not link; version layer not load-bearing).
- Scoping confirmed with Ed:
  - Plan first, then implement.
  - Fixed nine fields only; no user-authorable custom fields v1.
  - Drop the version layer.
  - Destructive migration is fine — app in dev, no users.
- PRD, PLAN, and four phase plans drafted.

## Next step

Begin **Phase 1 — Backend Schema** on a new branch. See
`phases/phase-01-backend-schema.md`.

## Blockers

None.

## Verification (planning packet)

- [x] PRD documents the nine-field contract and category options.
- [x] PRD documents drift comparator changes.
- [x] Phases ordered so backend lands before frontend; envelope
      drift fix lands between schema and UI.
- [x] Closeout gate (Phase 4) calls out `make ci` and Playwright MCP
      smoke.
- [ ] Implementation begun.
