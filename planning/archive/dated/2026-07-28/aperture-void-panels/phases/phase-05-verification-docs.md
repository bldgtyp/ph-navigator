---
DATE: 2026-07-28
TIME: 09:17 EDT
STATUS: Complete — Ed verified the real Rhino/GH import against the dev server
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Phase 5 — end-to-end + cross-repo verification, glossary/docs updates, closeout.
RELATED: ../PRD.md §6 §8 §11, context/GLOSSARY.md, context/ui/pages/apertures-tab.md
---

# Phase 5 — Verification + docs

## GH-side fix (separate repo — `honeybee_grasshopper_ph_plus`)

Per review F-1 / PRD §6: in `hb_tools/win_create_types.py`
`WindowUnitType.build()` (~:233), derive the column origin index from
`col_element_lists[0].col` instead of the `enumerate` position — one line,
back-compatible, also fixes the latent col-span variant. Own PR in that repo
with a fully-void-column regression test; PHN's route-3 422 guard stays
regardless (old GH installs persist).

## Cross-repo GH smoke (the one external contract)

1. On the local stack, build the S15 layout in a fixture project (Phase 3/4
   artifacts) and fetch the route-3 payload.
2. Parse it with the *unmodified* GH schema —
   `honeybee_ph_plus_rhino/gh_compo_io/ph_navigator/v1/window_types_schema.py`
   can be exercised under CPython for this (it is 2.7-compatible plain
   Python). Assert **placement, not just parseability** (review): every
   element parses; every grid column index appears as some element's
   `column_number`; absolute row/column indices survive the bottom-to-top
   reversal; no void ever appears in the payload.
3. Confirm the fully-void-column fixture 422s on route 3 (guard from
   Phase 3) rather than reaching GH at all.
4. **Ed's manual step**: pull the project through the real
   `PH-Nav Get Apertures` component in Rhino/GH; confirm the door spans to the
   floor row, sidelites sit on the sill, nothing is built in the void cells,
   and `WindowConstruction`s exist only for glazed elements.
5. Export route 4 (`ExportHbjsonAction` in the UI) and confirm constructions
   count = glazed-element count.

Recorded, no action (review note): route 4 keys constructions by the
top-down `row_span[0]` while GH's route-3-derived names use the reversed row —
inert today because `v1/apertures_get.py` deliberately never calls route 4,
but do not join the two by name.

## Docs updates (same diff)

- `context/GLOSSARY.md`: add **Empty panel (void element)** — grid-tiling
  element with `kind: "void"`; occupies layout cells; excluded from U-value,
  spec report, and all exports. UI label "Empty"; wire value `void`. The
  entry must also state: (1) the boundary rule — edges between glazed and
  Empty are window-to-wall junctions (jamb/sill/head), not mullions (PRD
  §2.1); (2) Empty is for regions that really are the host wall — a spandrel
  panel is NOT an Empty, use a g=0 glazing entry until `"solid"` exists (PRD
  §7); (3) it is distinct from the empty-*state* UI term
  (`ApertureEmptyState.tsx` — the no-apertures-yet placeholder).
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

## Implementation result — 2026-07-28

- Companion repo `honeybee_grasshopper_ph_plus` now derives each occupied
  column origin from the element's absolute `col` index. Local branch
  `fix/window-type-absolute-column-origin`, commit `963becb`; its isolated
  fully-void-column regression, Ruff, and Black checks pass.
- `backend/tests/test_aperture_void_cross_repo.py` parses the exact S15 route-3
  serializer payload with the unmodified companion V1 schema when that repo is
  available. It asserts void omission, all four absolute columns, bottom-up row
  reversal, spans, and route-4 construction count.
- The fully-void-column fixture now has an HTTP route-level 422 regression in
  addition to the serializer guard test.
- A saved local browser fixture was fetched through routes 3 and 4. The
  unmodified GH schema parsed three glazed elements in absolute columns 0/1/2
  with correct reversed row origins; route 4 emitted three constructions.
- Durable vocabulary, data-model, REST-command, HBJSON-export, cache, and
  Apertures UI docs now describe Empty panels and `setElementKind`.
- Full-feature simplify reuse/quality/efficiency reviews are clear after
  centralizing assignment snapshot copying and isolating the companion test's
  dependency stubs.
- `make format` made no changes; Graphify was refreshed; final `make ci`
  passed with backend `1629 passed, 7 skipped` and frontend `247` files /
  `2312` tests plus the production build.

## Manual acceptance result

Ed completed the real `PH-Nav Get Apertures` Rhino/GH check against the
PH-Navigator dev server on 2026-07-28. The components imported the Empty
(`void`) panels as expected. Automated placement/count checks and this manual
consumer check complete Phase 5.
