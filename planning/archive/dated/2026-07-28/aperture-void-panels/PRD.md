---
DATE: 2026-07-28
TIME: 09:17 EDT
STATUS: Complete — accepted decisions implemented and verified; Opus review
  (reviews/2026-07-28-plan-review.md) folded in same day; ready for Phase 1
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Product/behavior contract for void ("Empty") aperture elements, with a
  reserved-but-deferred extension path for solid spandrel panels.
RELATED: ./README.md, ./decisions.md, ./phases/,
  context/ui/pages/apertures-tab.md, context/GLOSSARY.md
---

# PRD — Aperture void ("Empty") panels

## §0 Problem

The Aperture Builder assumes every window unit is a fully-glazed rectangle:
the grid (`row_heights_mm` × `column_widths_mm`) must be completely tiled by
elements, and every element is a sash (frames + glazing + operation).

Project trigger: a storefront unit (S15) where the **double doors extend below
the sill line of the flanking sidelites** — the region below each sidelite is
wall (wood base), not window. There is no way to describe this today:

- The unit cannot be chunked into separate rectangular apertures without
  cutting through the continuous transom band, inventing phantom mullions at
  the cut lines, corrupting per-side frame accounting, and forcing multiple
  placement elevations in Rhino.
- Leaving cells uncovered violates the coverage invariant (holes are a
  validation error).

This layout is common for storefront glazing (doors-to-floor with raised-sill
sidelites), and the same mechanism covers any notched unit (e.g. around
structure).

The fix: a **void element kind** — an element that participates in the layout
(occupies grid cells, satisfies coverage) but is *not part of the aperture*:
no frames, no glazing, no operation, excluded from U-value aggregation and
from every export. S15 then models as a normal grid:

```text
                 col: sidelite | door-L | door-R | sidelite
r0 transom band:      glazed   | glazed | glazed | glazed
r1 upper lites:       glazed   | glazed | glazed | glazed
r2 main lites:        glazed   |  door (spans r2–r3)  | glazed
r3 base height:       VOID     |   (door cont'd)      | VOID
```

## §1 Current model (verified 2026-07-28)

- **Schema** — `backend/features/project_document/envelope_models.py`:
  `ApertureElement` (:491) = `id`, `name`, inclusive `row_span`/`column_span`,
  `frames` (4 × `pfrm_` id), `glazing_id` (`pglz_` id), `operation`.
  `ApertureTypeEntry` (:532) enforces the coverage invariant via
  `check_aperture_coverage` (`apertures/coverage.py`): every cell covered by
  exactly one element — no holes, no overlaps.
- **Commands** — closed discriminated union `ApertureCommand`
  (`project_document/aperture_commands/models.py`), handlers under
  `aperture_commands/handlers/` (picks.py, paste.py, merge_split.py,
  element.py, sidebar.py, dimensions.py, flip.py, refresh.py,
  manufacturer_filters.py). Every gesture is one command; `extra="forbid"`.
- **U-value** — `aperture_u_value/service.py`: ISO 10077-1 per element;
  window U = area-weighted average over **all** elements; missing assignments
  produce warnings + a 0.0 element value that still counts area. Results
  cached by `content_hash_for_aperture` (`cache.py:77`), which deliberately
  excludes `name`/`operation`/`catalog_origin`.
- **Route-3 GH export** — `gh_api/aperture_types_export.py`: denormalized
  grid JSON per type; every element emitted with `row_number`/`column_number`
  (absolute grid indices) + span counts + inlined glazing/frames.
- **Route-4 HBJSON export** — `aperture_hbjson_export/service.py`: one
  `WindowConstruction` per element, identifier `{name}_C{col}_R{row}`.
- **GH consumer** — `honeybee_ph_plus_rhino/gh_compo_io/ph_navigator/v1/`
  (`apertures_get.py`, `window_types_schema.py`) parses route 3 and reuses the
  frozen V0 build pipeline. `create_hbph_window_unit_types`
  (`v0/window_types_get.py:157-177`) **iterates elements, not grid cells**,
  and places each `WindowElement` by its absolute column/row indices inside
  the full grid dims. Cells with no element simply build nothing.
- **Frontend** — `frontend/src/features/apertures/`: `types.ts` mirrors the
  backend union; canvas (`ApertureSvgCanvas.tsx` + overlay/hit targets),
  element card stack (`ApertureElementCard.tsx`: `FramesPanel`, `GlazingRow`,
  `OperationRow`, `UValueChip`), `pick-paste-machine.ts`,
  `merge-validation.ts`.

## §2 Design — element `kind`

Add one field to `ApertureElement` (backend + wire + TS):

```python
kind: Literal["glazed", "void"] = "glazed"
```

- **Enum, not bool** — so a future `"solid"` spandrel kind (§7) is additive.
- **Default `"glazed"`** — every existing document, draft, and wire payload
  validates unchanged. No migration, no document upgrade step. `replace_table`
  browser-parity payloads carry the field automatically once it is in
  `ApertureTypeEntry`.
- **Void invariant** (new model validator on `ApertureElement`): if
  `kind == "void"` then all four `frames` slots are null, `glazing_id` is
  null, and `operation` is null. Name is allowed (defaults "Unnamed").
- **Coverage check: unchanged.** Voids tile the grid like any element; merge/
  split/add-row/add-column/flip geometry machinery is untouched.
- An all-void aperture validates (no schema special-casing) but is **never
  silent**: it triggers the `no_glazed_elements` warning and blocks route-3
  export (§4) — reachable via `deleteRow`/`deleteColumn` dropping the last
  glazed element (review F-5).

## §2.1 Frame semantics at a void boundary (review F-2)

An edge between two glazed elements is a **mullion**; an edge between a glazed
element and a void is a **jamb / sill / head** — a real window-to-wall
junction with a different width, U_f, and critically a real Ψ_install (mullion
frame types conventionally carry 0). Converting a cell to Empty re-classifies
the adjacent elements' edges *without touching their frame assignments* —
U_w, install-psi, and the spec report would silently inherit the mullion.

Mitigations (all in scope):

- The glazed→void confirm dialog and the shared Empty tooltip both remind the
  user to re-check frames on adjacent edges (§5).
- A soft warning through the existing `ApertureUValueWarning` channel:
  `mullion_frame_at_void_boundary` — element X carries a frame with a mullion
  `mull_type` on an edge adjacent to a void. `mull_type` already exists on
  `FrameRef`/`ProjectFrame` (`envelope_models.py:102/:397`), so the adjacency
  check is cheap (Phase 3).
- The GLOSSARY entry states the rule.

## §3 Command surface

One new command (multi-element, mirroring `pasteAssignment` — review F-3: the
canvas is multi-select aware and a notched unit means converting several cells
at once; N single-element commands would mean N draft writes + N audit rows
and a half-converted state on partial failure):

```text
setElementKind { aperture_type_id, element_ids: [..], element_kind: "glazed" | "void" }
```

- All-or-nothing across `element_ids` (one document write, one audit row).
- glazed→void **clears** the six assignment slots (4 frames, glazing,
  operation) server-side in the same command. The frontend shows a confirm
  when assignments exist (§5, D-3 confirm-then-clear); the edit lands in the
  draft, so it is discardable.
- void→glazed produces bare unassigned elements (normal "unfinished" state).
- Elements already at the requested kind are a no-op within the batch.
- Audit kind: `project_version_aperture_element_set_kind`.
- Reaches MCP automatically via `apply_aperture_command`'s union.

Guards on existing commands (409/422 command errors, mirroring existing
handler error style):

| Command | Void behavior |
| --- | --- |
| `pickFrame` / `pickGlazing` / `setElementOperation` | refuse when target is void |
| `pasteAssignment` | refuse when any target is void; refuse void source |
| `mergeElements` | all sources must share one `kind` (void+void merge OK; result keeps the kind) |
| `splitElement` | works as-is; each child inherits `kind` (assignments already null for voids) |
| `setElementName`, `flipLeftRight`, `editDimension` | unchanged |
| `addRow` / `addColumn` | unchanged code — but the straddle rule (`_add_along_axis`, `dimensions.py`) **extends a void's span** when inserting through it. Intended (the "not window" region grows with the grid) but it is a second void-creation path: documented + tested in Phase 2 (review F-6) |
| `deleteRow` / `deleteColumn` | unchanged code — orphaned elements are dropped, so deleting the last glazed row/column leaves an **all-void aperture**. Not blocked; surfaced by the `no_glazed_elements` warning + route-3 export guard (§4, review F-5) |
| `refreshRefFromCatalog` | unreachable for voids (no refs) — no change needed |

New glazed elements from `addRow`/`addColumn` stay glazed; users convert
cells to Empty afterward.

## §4 Consumer behavior matrix

| Consumer | Behavior for `kind == "void"` |
| --- | --- |
| U-value (`aperture_u_value/service.py`) | Skipped entirely: excluded from `total_q` **and** `total_area`; no `missing_frame` / `missing_glazing` warnings; no per-element result row. `total_area_m2` therefore becomes the true window area (void region is wall). NB: today `total_area_m2`'s only consumer is a TS type in `hooks/useApertureUValues.ts` — the corrected semantics are right, but don't count "correct PHPP area" as a shipped deliverable (review note). |
| U-value warnings | Two **new warning kinds** through the existing `ApertureUValueWarning` channel: `no_glazed_elements` (aperture type contains only voids — review F-5) and `mullion_frame_at_void_boundary` (§2.1, review F-2). Warnings must not be suppressed by the void skip. |
| U-value cache (`cache.py:77`) | `kind` **must be added to the hash** — it changes the result, and a void hashes identically to an unassigned glazed element today (all refs null), so without this the Phase-3 skip returns stale cached results (review-confirmed, load-bearing). |
| Route-3 GH export (`gh_api/aperture_types_export.py`) | Void elements **omitted** from `elements`; grid dims stay full. No payload shape change → old GH definitions keep working. **Plus two export guards (422, alongside the existing duplicate-names guard):** (1) any aperture type with a **fully-void grid column** — the GH `WindowUnitType.build()` enumerates occupied columns positionally and would silently shift every later column left (review F-1, §6); (2) any **all-void aperture type** — GH would silently build nothing for faces using it (review F-5). |
| Route-4 HBJSON export (`aperture_hbjson_export/service.py`) | Skipped — no `WindowConstruction` emitted. Identifier scheme untouched. All-void types emit zero constructions; acceptable because route 3 is the geometry path and it hard-errors (above). |
| MCP `list_aperture_types` (`apertures_mcp/tools.py:77`) | `element_count` currently counts voids — add `glazed_element_count` so agents don't miscount (review note). |
| Orphaned refs | glazed→void clears ref ids but there is no `project_frames`/`project_glazings` GC — orphans linger in the spec report with empty `use_sites`. Pre-existing behavior (`deleteRow` already does this); voids make it routine. Verify-only this feature (Phase 3); GC is out of scope. |
| Spec report / use-sites (`apertures/` selectors) | No change needed — voids reference no frames/glazings, so they never appear in `use_sites`. Verify with a test. |
| Aperture drift (`aperture_drift/`) | No change needed — drift compares picked refs; voids have none. Verify with a test. |
| MCP read tools (`get_table`, `get_aperture_type`, …) | Field flows through automatically; `calculate_aperture_u_values` tool reflects the skip. |
| Total-dimensions caption | Unchanged — overall W×H stays grid-derived (the unit's bounding envelope). |

## §5 Frontend behavior

- **Canvas** (`ApertureSvgCanvas.tsx` + element layers): voids render as
  "not there" — near-fully transparent fill (very light, per D-4) with a
  **dashed outline** from design tokens; no glazing inset, no operation
  symbols, no U-value chip, no solid frame edges. Still selectable (needed to
  convert back / merge / name).
- **Element card** (`ApertureElementCard.tsx`): for a void, hide
  `FramesPanel` / `GlazingRow` / `OperationRow` / `UValueChip`; show a single
  caption: *"Empty — not part of the aperture. Excluded from U-value and
  exports."* plus the kind toggle.
- **Kind control**: a small "Empty" toggle (placement per apertures-tab page
  doc conventions) with a **clear tooltip** explaining the concept — e.g.
  *"Empty panel: occupies the layout but is not part of the window unit. The
  area is wall; it is excluded from U-value, spec report, and all exports."*
  The same explanation appears as the tooltip on void cells in the canvas.
  With a multi-element selection, the toggle also appears on the canvas
  toolbar beside Merge / Split (review F-3 — the toolbar already carries
  `selectionCount`). glazed→void with any assignment present opens a confirm
  dialog stating what will be cleared **and reminding that frames on adjacent
  glazed edges become window-to-wall junctions (jamb/sill/head, not mullion)
  and should be re-checked** (§2.1).
- **Kind branching**: components branch on `kind` via a switch / lookup
  table, not an `isVoid` boolean — the reserved `"solid"` slot (§7) must not
  require rewriting the canvas and element card (review note).
- **Paste-undo integrity** (review F-7): `undoLastPaste` in
  `hooks/usePickPasteHandlers.ts` awaits the paste command with no try/catch
  (unlike `pasteOnto`); converting a pasted-onto element to Empty and then
  undoing would fire a paste at a void → server refusal → unhandled
  rejection. `setElementKind` drops that element's undo entries, and
  `undoLastPaste` gets the same catch as `pasteOnto` for defense in depth.
- **Interaction guards** (mirror server): `pick-paste-machine.ts` — voids are
  invalid pick and paste targets/sources; `merge-validation.ts` — mixed-kind
  merges invalid with a reason string, consistent with existing invalid-merge
  messaging.
- **U-value display**: aperture-level chip unchanged (server value already
  excludes voids); no per-element chip on voids.

## §6 GH / Rhino contract

**Zero GH code changes for the S15 shape; one small GH fix + one PHN guard
for the general case** (review F-1 corrected the original "zero changes"
claim):

- Route 3 omits voids; `row_heights_mm` / `column_widths_mm` remain the full
  grid, so `WindowElement` placement indices stay valid, the bottom-to-top row
  reversal is unaffected, and no sash is built in void cells — the wall stays
  wall there. The door still spans to the floor row; sidelites sit on their
  sill. `_C{col}_R{row}` identifiers remain collision-free (voids emit
  nothing). Review-traced end-to-end for S15, including the row reversal.
- **The exception — fully-void grid columns** (`win_create_types.py`
  `WindowUnitType.build()` ~:233): the column origin uses the `enumerate`
  position over *occupied* columns (`cum_col_widths_m_[i]`), while rows index
  by value (`cum_row_heights_m_[row_element.row]`). A fully-void **row**
  leaves a correct gap; a fully-void **column** silently shifts every later
  column one slot left. (A latent col-span variant of this bug exists today;
  voids make it reachable.) Plan:
  1. **GH-side fix** in `honeybee_grasshopper_ph_plus`: derive the column
     index from `col_element_lists[0].col` instead of `enumerate` — one line,
     back-compatible, also fixes the latent bug (Phase 5, separate repo/PR).
  2. **PHN-side guard**: route-3 export 422s on fully-void columns (§4) —
     stays even after the GH fix ships, since old GH installs persist.
- Verification (Phase 5): CPython-parse the route-3 payload with the
  unmodified `v1/window_types_schema.py` **asserting column placement** (every
  grid column index appears as some element's `column_number`), then Ed's
  manual Rhino pull.

## §7 Solid (spandrel) panels — reserved, DEFERRED

A `"solid"` kind (opaque spandrel/infill panel: *is* part of the unit, sits in
frames, carries a panel U-value, no solar gain) is anticipated — storefront
systems have them routinely. **The enum reserves the slot now; the feature
waits for a driving project.** Rationale (decisions.md D-2):

1. **Cross-repo cost.** Unlike void (zero GH changes), solid requires the
   route-3 payload to carry `kind`, plus changes in `honeybee_ph`
   (`WindowElement` has no kind concept), the GH build pipeline, and PHX/WUFI
   export semantics. That is multi-repo scope with its own verification.
2. **Certifier-dependent semantics.** PHI and Phius treat spandrels
   differently (window-with-g≈0 vs opaque component with edge psi-values). A
   live project + certification pathway should settle which PHN encodes.
3. **Unresolved catalog fork.** Where does the panel U-value come from —
   reuse the glazing slot with "panel" glazing entries (g=0), or a dedicated
   panel-type catalog/table (new pickers, drift, spec-report)? A real project
   answers this.
4. **Escape hatch exists today — with a sharp edge** (review-corrected). A
   spandrel can be modeled as a glazed element with a g=0 "panel" glazing
   entry — standard PHPP practice: the panel's area counts in the window area
   and window U, which is what PHPP wants for a window-integrated spandrel.
   **Empty is NOT the spandrel workaround**: a void's area is absorbed into
   the host wall in Rhino (no unit-bounding surface is built), so an
   insulated spandrel modeled as Empty would silently get the *wall's*
   U-value. Criterion: **use Empty only when the region really is the host
   wall assembly** (S15's wood base — yes; a spandrel panel — no, use the
   g=0 glazing until `"solid"` exists).
5. **Partial support would be worse than none.** Shipping solid with
   void-style export omission would delete real unit geometry in Rhino.

When picked up, solid becomes its own feature folder referencing this PRD; the
schema work here (kind enum, per-kind validators, per-kind command guards) is
its foundation.

## §8 Naming

- Wire/schema value: `"void"`. UI label: **"Empty"** (Ed, 2026-07-28), with
  explanatory tooltips everywhere the label appears (§5).
- Add **Empty panel (void element)** to `context/GLOSSARY.md` in Phase 5.

## §9 Decisions (resolved by Ed, 2026-07-28)

| # | Question | Resolution |
| --- | --- | --- |
| D-1 | UI label for wire value `void` | **"Empty"**, with clear explanatory tooltips wherever it appears |
| D-3 | glazed→void with assignments | **Confirm-then-clear** |
| D-4 | Canvas treatment | **Near-fully transparent fill + dashed outline** — reads as "not there" (final tokens per design system during Phase 4) |

(D-2, solid deferral, accepted — see `decisions.md`.)

## §10 Phasing

Backend-first; every phase independently mergeable; `main` stays deployable.
See `phases/phase-0N-*.md` for full plans, file lists, and verification.

1. **Schema** — `kind` on `ApertureElement` (+ void invariant validator),
   wire + TS types. No behavior change anywhere yet. NB: until Phase 3 lands,
   a `replace_table`/MCP-authored void computes a U-value over real area and
   exports — accepted intermediate state, no UI authoring path exists yet
   (review note); phases 1–3 land before the feature is announced or used.
2. **Command** — `setElementKind` (multi-element) + guards on
   pick/paste/merge/operation; document + test void span growth via
   `addRow`/`addColumn` straddle.
3. **Consumers** — U-value skip + new warnings + cache-key inclusion, route-3
   omission + export guards, route-4 skip, MCP `glazed_element_count`; verify
   spec-report/drift/orphaned-refs behavior.
4. **Frontend** — canvas, element card + toolbar toggle, guards in
   `usePickPasteHandlers`/store + merge validation, confirm dialog,
   paste-undo integrity.
5. **Verification + docs** — e2e browser smoke, GH round-trip smoke (S15 +
   fully-void-column fixtures, column-placement assertion), the GH-side
   `win_create_types.py` fix (separate repo), GLOSSARY +
   `context/ui/pages/apertures-tab.md` updates, closeout.

## §11 Verification (feature-level)

- Backend: pytest coverage per phase (schema validators, command handlers +
  guards, U-value area semantics, both exports omitting voids, cache-key
  sensitivity to `kind`).
- Frontend: vitest for machine/merge guards + card states;
  `make frontend-dev-check`; agent-browser smoke building the S15 layout.
- Cross-repo: route-3 payload for an S15 fixture parsed by
  `v1/window_types_schema.py` unchanged (no `is_void` field ever reaches GH);
  Rhino visual check is Ed's manual step.
- `make ci` green before each merge.
