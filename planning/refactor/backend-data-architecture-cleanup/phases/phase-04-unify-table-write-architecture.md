---
DATE: 2026-06-24
TIME: 18:25 EDT
STATUS: Promoted out — see sibling refactor. (Phase number retained for stable references.)
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Redirect — the table-write-architecture unification is now its own refactor.
RELATED: planning/refactor/table-write-architecture-unification/
---

# Phase 4 — Unify the Table-Write Architecture  → PROMOTED OUT

This was Phase 4 of this refactor. Per decision **D5** (Ed, 2026-06-24) it has
been promoted to its **own sibling refactor** because it is cross-stack (it
requires a significant frontend rewire of the heat-pumps editor) and is a
distinct concern — *application write-path architecture / extensibility* rather
than *DB-schema / data-shape cleanup*.

**It now lives at:**
`planning/refactor/table-write-architecture-unification/`

- Backend: fold heat-pumps onto the registered table contract; extract one
  shared draft/ETag/size/validate write spine; drop the double-validate (DOC-3,
  DOC-4).
- Frontend: rewire `src/features/equipment/heat-pumps/` onto the generic
  table-write client used by the other equipment tables.

The phase number `04` is left as this stub so existing cross-references (e.g.
"Phase 5 runs after 3/4") remain stable; this folder's remaining phases keep
their numbers (05 relational baseline, 06 pre-deploy hardening, 07 deferred
migration mechanism).

## Sequencing note for this folder
The sibling write-unification refactor depends on this folder's **Phase 3**
(single current-schema validator + body-size guard) and on the aperture v12 WIP.
It runs in parallel with this folder's **Phase 05** (relational squash) — they
touch independent surfaces.
