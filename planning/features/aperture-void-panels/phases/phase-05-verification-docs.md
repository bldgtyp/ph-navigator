---
DATE: 2026-07-28
TIME: 09:17 EDT
STATUS: Not started
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Phase 5 — end-to-end + cross-repo verification, glossary/docs updates, closeout.
RELATED: ../PRD.md §6 §8 §11, context/GLOSSARY.md, context/ui/pages/apertures-tab.md
---

# Phase 5 — Verification + docs

## Cross-repo GH smoke (the one external contract)

1. On the local stack, build the S15 layout in a fixture project (Phase 3/4
   artifacts) and fetch the route-3 payload.
2. Parse it with the *unmodified* GH schema —
   `honeybee_ph_plus_rhino/gh_compo_io/ph_navigator/v1/window_types_schema.py`
   can be exercised under CPython for this (it is 2.7-compatible plain
   Python): assert every element parses, absolute row/column indices survive
   the bottom-to-top reversal, and no void ever appears.
3. **Ed's manual step**: pull the project through the real
   `PH-Nav Get Apertures` component in Rhino/GH; confirm the door spans to the
   floor row, sidelites sit on the sill, nothing is built in the void cells,
   and `WindowConstruction`s exist only for glazed elements.
4. Export route 4 (`ExportHbjsonAction` in the UI) and confirm constructions
   count = glazed-element count.

## Docs updates (same diff)

- `context/GLOSSARY.md`: add **Empty panel (void element)** — grid-tiling
  element with `kind: "void"`; occupies layout cells; excluded from U-value,
  spec report, and all exports. UI label "Empty"; wire value `void`.
- `context/ui/pages/apertures-tab.md`: void rendering (near-transparent +
  dashed outline), kind toggle + shared tooltip, confirm dialog, guard
  behaviors.
- Check `context/technical-requirements/*` + `context/mcp.md` for any
  aperture-command enumeration that must list `setElementKind`.
- `graphify update .` after the code changes.

## Closeout gate (per repo CLAUDE.md)

1. `simplify` skill over the full feature diff; wait.
2. `docs-pass` skill; wait.
3. `make format`; re-inspect diff if it changed files.
4. `make ci` — all green before reporting done.

## Feature closeout

- Update `STATUS.md` ledger + set status per the planning vocabulary
  (`Implemented on branch` → `Merged to main` → `Complete`).
- Merge is a PR onto `main`; **deploy remains Ed's explicit action** (Deploy
  Production workflow), never part of this feature's closeout.
- On completion, archive the folder to
  `planning/archive/dated/<date>/aperture-void-panels/` + one line in
  `planning/archive/README.md`.
