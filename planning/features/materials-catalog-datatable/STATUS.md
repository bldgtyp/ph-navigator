---
DATE: 2026-06-04
TIME: 00:30 EDT
STATUS: Implemented on `feat/materials-catalog-datatable`; ready for
        review. Three known UX gaps recorded below as follow-up work,
        none of which block landing the rewrite (the legacy
        modal-based UI it replaces was even more limited).
AUTHOR: Claude (Opus 4.7)
SCOPE: Status ledger for the Materials Catalog DataTable migration.
RELATED:
  - README.md
  - PRD.md
  - PLAN.md
---

# STATUS — Materials Catalog DataTable

## Current state

- Branch: `feat/materials-catalog-datatable` (PR pending).
- Planning packet committed (`200dcbf`).
- **Phases 1 + 2 (backend) merged into one commit** (`763b7d5`):
  destructive Alembic; CatalogOrigin nullable version slots;
  ProjectMaterial reshape; envelope drift collapsed to field-value
  comparison; `data-model.md` §7.2 / §7.4 folded.
- **Phase 3 (frontend) landed** (`1c7d17d`): shared `<DataTable>`
  replaces the hand-rolled table + modal; built-in nine-field FieldDefs
  with locks + fixed `numberUnits` for density / specific_heat /
  conductivity; twelve-option Category single_select; REST→WriteOp
  `useMaterialsCatalogController`; specific_heat added to the
  `NUMBER_UNIT_TYPES` registry; ProjectMaterial / CatalogOrigin / drift
  type reshape across envelope + tests;
  `frontend-viewer-units.md` §11.5.5 fold-back.
- **Phase 4 (verification + closeout)** finished:
  - `make format` + `make ci` from repo root: green (1003 frontend
    tests, 440 + 1 skipped backend tests).
  - Playwright MCP browser smoke run against the live `/catalog/materials`
    page; screenshots in gitignored `working/phase4-smoke/`.

## Smoke verification — what works

- Page mounts with all ten columns + tail `+` cell; the per-column
  unit chips render the active SI unit label.
- REST list loads three seeded rows; categories render as option
  labels (single_select pill UI), color cells show swatch + hex,
  numbers right-aligned, "3 materials" count + footer `COUNT 3`.
- SI → IP toggle (via the user preference endpoint) flipped the unit
  chips and converted values correctly:
  Density `35 / 7850 / 650 kg/m3 → 2.2 / 490.1 / 40.6 lb/ft3`;
  Specific Heat `1500 / 500 / 1700 J/(kg-K) → 0.358 / 0.119 / 0.406 Btu/(lb-F)`;
  Conductivity `0.034 / 52 / 0.13 W/(m-K) → 0.020 / 30.045 / 0.075 Btu/(h-ft-F)`.
- Category popover opens with the twelve fixed options listed in PRD
  order; current value is marked `[selected]` and the option list is
  scrollable.
- Plain Number cell edit fires PATCH end-to-end: typing in the
  Density cell for OSB drove `650.0 → 650.07` server-side and the
  "Density updated." status announcement rendered.

## Smoke verification — gaps to fix in follow-ups

1. **Single_select cell commit does not fire `onWrite`.** Clicking a
   different option in the Category popover closes it without
   reaching `useMaterialsCatalogController.onWrite`. Same gesture on
   the Rooms slice-controller works, so the wiring lives somewhere
   between `SingleSelectPopover.onCommit` and the cell-write pipeline
   that the REST adapter is missing. Likely 1-day fix, post-merge.
2. **Shift-Enter on the empty grid does not insert a row.** Symptom
   only on a zero-row table: the DataTable fires the rowInsert with
   empty `fieldDefaults`, and the REST controller skips because the
   POST body needs `name` + `category`. Two fixes possible: (a)
   pre-fill `name: "Untitled"` + `category: "insulation"` in
   `buildCreatePayload`'s fallback, then let the user rename in place;
   (b) only allow Shift-Enter when there's at least one anchor row.
3. **Row delete via the selection-checkbox + Delete key does not fire
   the DELETE.** Same gesture isn't wired through to `op.rowDelete`
   on the REST adapter path. Will investigate alongside #1 — likely
   the same upstream commit gap.
4. **No global SI/IP toggle UI.** The `ModalUnitToggle` exists only
   inside dialogs (`ProjectMaterialEditor`, `MaterialDrift`,
   `LengthDialog`). The catalog page has no inline toggle, so this
   smoke flipped the preference via the server PATCH endpoint and
   reloaded. Adding a global toggle to `WorkspaceTopbar` is out of
   this feature's scope.

## Next step

Open PR, hand to review. Follow-ups #1–#3 above will land in a
separate slice after this PR; #4 belongs to a topbar-UX feature.

## Blockers

None.

## Verification

- [x] PRD documents the nine-field contract and category options.
- [x] PRD documents drift comparator changes.
- [x] Backend implementation landed; `uv run pytest` green.
- [x] Frontend implementation landed.
- [x] `make ci` from repo root green.
- [x] Context doc fold-back: `data-model.md`,
      `frontend-viewer-units.md`.
- [x] Playwright MCP smoke captured.
- [ ] PR opened.
