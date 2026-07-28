---
DATE: 2026-07-28
TIME: 09:39 EDT
STATUS: Review complete — all findings verified against code and folded into
  PRD/decisions/phases 2026-07-28 (see STATUS.md); dispositions per the table
  at the end of this file
AUTHOR: Claude (Opus 5) for Ed May
SCOPE: Independent review of the aperture void ("Empty") panels planning packet
  (PRD, decisions, phases 1–5) against the live backend, frontend, and the
  honeybee_grasshopper_ph_plus Rhino/GH consumer code.
RELATED: ../PRD.md, ../decisions.md, ../phases/, ../STATUS.md
---

# Review — aperture void ("Empty") panels planning packet

## Verdict

The packet is unusually well-grounded: every line reference in the PRD checks
out against the current code, and the core design — a `kind` enum on
`ApertureElement` that preserves the coverage invariant — is the right call.

Two findings are load-bearing (F-1 GH column placement, F-2 frame semantics at
a void boundary). The rest are gaps, one wrong file pointer, and one missing
decision record. Nothing here invalidates the approach or the phasing.

## Verified as accurate

Checked directly against the code, not taken from the PRD:

| Claim | Verified |
| --- | --- |
| `ApertureElement`:491, `ApertureTypeEntry`:532, coverage invariant | ✅ `backend/features/project_document/envelope_models.py` |
| U-value element loop at :61; `content_hash_for_aperture` at `cache.py`:77 | ✅ |
| Route-3 `_element` at :56; route-4 identifier `{name}_C{col}_R{row}` | ✅ |
| `document.py`:451 is the `__all__` re-export region | ✅ (`ApertureElement` at :42/:451) |
| Spec report / `use_sites` needs no change | ✅ `apertures/selectors.py` only records non-null refs — voids never appear |
| Aperture drift needs no change | ✅ `aperture_drift/detector.py` compares picked refs only |
| `replace_table` + MCP `get_aperture_type` carry the field automatically | ✅ both go through Pydantic / `entry.model_dump(mode="json")` |
| S15 builds correctly in Rhino with voids omitted | ✅ traced the row reversal (see below) |

**The cache-key point is load-bearing, not pedantry.** Today a void element and
an unassigned glazed element hash *identically* — all four frames `None`,
`glazing_id` `None`. Without `kind` in the hashed subtree, Phase 3's U-value
skip returns a stale, wrong cached result. Phase 3 is right to call this out.

**Existing structural handlers survive untouched.** `flip.py`,
`_add_along_axis` / `_delete_along_axis` (`dimensions.py`), and
`apply_duplicate_aperture_type` (`sidebar.py`) all propagate through
`model_copy` / `model_dump` round-trips, so `kind` flows without edits. Only
`merge_split.py` constructs `ApertureElement(...)` fresh (:55, :105) — and
Phase 2 covers both sites.

**S15 through GH — traced.** `ApertureTypeData.reverse_elements_row_order`
computes `R - row_number - row_span`. For the 4-row S15: door r2/span2 →
flipped row 0 (floor); sidelite r2/span1 → flipped row 1, placed at
`cum_row_heights[1] = h3` (sitting on the base height); voids omitted → nothing
built in those cells, wall stays wall. `create_hbph_window_unit_types` then
sums `get_row_height_m` over the flipped indices, which re-reverses internally
and lands on the right heights. PRD §6 is correct *for this shape*.

---

## F-1 — "Zero GH changes" breaks on a fully-void grid column

**Severity: high (silent wrong geometry). Blocks the §6 / A-3 wording.**

`honeybee_ph_plus_rhino/gh_compo_io/hb_tools/win_create_types.py`
`WindowUnitType.build()`, lines 233-237:

```python
for i, col_element_lists in enumerate(self.elements_by_column(self.elements)):
    column_elements_origin_plane = copy(origin_plane)
    col_width_in_doc_units = convert(cum_col_widths_m_[i], "M", rh_doc_units)
```

`i` is the **enumeration position over occupied columns**, not the column
index. `elements_by_column` groups by `element.col` and returns one list per
*distinct* value, sorted — so the mapping from `i` to a real grid column only
holds while every column has at least one element starting in it.

Rows are safe: `cum_row_heights_m_[row_element.row]` (:247) indexes **by
value**, so a fully-void row leaves a correct horizontal gap.

Columns are not. A full-height void column removes the only elements starting
in that column, and every column after it is then placed one slot too far left
— silently, no error, no exception. PRD §0 explicitly claims "the same
mechanism covers any notched unit (e.g. around structure)"; that is exactly the
shape that triggers this.

(A latent version of this bug exists today for column-spans: if *every* row
skips a column start, the same shift occurs. The coverage invariant makes that
nearly unreachable in practice. Voids make it reachable.)

**Options**

- **(a)** One-line fix in `win_create_types.py` — derive the index from
  `col_element_lists[0].col` instead of `enumerate`. Also removes the latent
  col-span bug. Cross-repo, but trivial and back-compatible.
- **(b)** PHN-side guard: warn (or 422) on route-3 export when a grid column
  contains only void elements.
- **(c)** PHN normalizes fully-void columns out of the exported grid and
  reindexes `column_number`.

Recommend **(a) + (b)**. Either way, soften §6 and decisions A-3 from "zero code
changes required" to "zero changes for the S15 shape; one guard needed for
fully-void columns."

---

## F-2 — Frame semantics at a void boundary (Passive-House correctness)

**Severity: high (silently wrong U_w / Ψ_install). Not mentioned anywhere in
the packet.**

An edge between two glazed elements is a **mullion**. An edge between a glazed
element and a void is a **jamb / sill / head** — a real window-to-wall
junction. It carries a different width, a different U_f, and critically a real
Ψ_install, where mullion frame types are conventionally 0.

Converting a cell to Empty silently re-classifies the adjacent elements' edges
without touching their frame assignments. U_w, PHPP install-psi, and the spec
report all inherit the mullion. Nothing in the plan forces, warns about, or
even hints at re-picking those frames.

**Recommend**

- State it in the PRD, the glossary entry, and the confirm-dialog copy.
- Consider a soft warning through the existing `ApertureUValueWarning` channel:
  *"element X carries a mullion-type frame on an edge adjacent to an Empty
  panel."* `mull_type` already exists on `ProjectFrame`
  (`envelope_models.py`:397), so the check is cheap.

---

## F-3 — `setElementKind` should take `element_ids: list[str]`

The canvas is already multi-select aware: `ApertureCanvasToolbar` takes
`selectionCount` and Merge operates on a selection. A notched unit means
converting several cells at once.

PRD §3 defines a single-element command, so the UI must fire N commands = N
draft writes + N audit rows, and a partial failure leaves a half-converted
state. Mirror `pasteAssignment`'s `target_element_ids: list[str]`.

Related: Phase 4 puts the kind toggle only in the element card. With
multi-select it also belongs on the toolbar beside Merge / Split.

---

## F-4 — Missing decision record: "relax the coverage invariant to allow holes"

`decisions.md` A-1 rejects rectangular chunking and polygon outlines, but never
addresses the most obvious alternative: change coverage from *exactly one* to
*at most one* and treat uncovered cells as implicit voids.

The chosen design is better — explicit void elements are selectable, nameable,
mergeable, hit-testable, and distinguish "intentionally not window" from
"authoring mistake / not drawn yet" — but that reasoning should be written
down. A future reader will ask.

---

## F-5 — `deleteRow` / `deleteColumn` are unaddressed; all-void apertures are silent

Neither command appears in PRD §3's guard table nor in its "unchanged" list.
Deleting a row can drop the last glazed element and leave an **all-void
aperture type**.

PRD §2 waves this through ("degenerate but valid ... no special-casing"), but
the downstream consequence is silence, not an error:

- Route 3 emits `elements: []`.
- GH builds a `WindowUnitType` with zero elements — no exception, no geometry.
- Route 4 emits zero constructions.
- U-value = 0.0 over 0 m².

A face assigned that aperture type gets no window and nobody is told.
**Recommend** a validation warning ("aperture type has no glazed elements")
surfaced wherever the missing-frame / missing-glazing warnings surface, and/or
a 422 on route-3 export.

---

## F-6 — `_add_along_axis` grows voids silently

`dimensions.py`:244-251 — inserting a row or column *through* a void element
extends that element's span, so new grid cells become "not window" without the
user asking for it.

That is probably the behavior you want, but it is a second creation path for
void area besides `setElementKind`, and it is undocumented. State and test it
in Phase 2.

---

## F-7 — Phase 4 points at the wrong file for the pick/paste guard

`pick-paste-machine.ts` is a **pure mode machine** (idle → picking → pasting)
with no element knowledge at all. Target validity lives in
`hooks/usePickPasteHandlers.ts` (`pasteOnto`) and the Zustand store.

Also: `undoLastPaste` awaits `onPasteAssignment` with **no** try/catch, while
`pasteOnto` has one. Convert an element to Empty after pasting onto it and
"Undo paste" fires at a void → server refusal → unhandled rejection.
`setElementKind` should drop that element's undo entries (or `undoLastPaste`
needs the same catch).

---

## Smaller notes

- **`total_area_m2` has no real consumer.** PRD §4 frames the corrected area as
  "correct for PHPP/takeoffs" — true as intent, but the only consumer today is
  a TS type in `hooks/useApertureUValues.ts`. Don't count it as a deliverable.
- **MCP `list_aperture_types`** returns `element_count` including voids
  (`apertures_mcp/tools.py`:77). Add `glazed_element_count` or exclude voids;
  an agent reading it will otherwise miscount.
- **Orphaned refs.** glazed→void clears the element's frame/glazing ids, but
  there is no GC for `project_frames` / `project_glazings`, so orphans linger in
  the spec report with empty `use_sites`. Pre-existing (`deleteRow` already does
  this), but voids will make it routine. Worth a line in Phase 3 verification.
- **Route-4 / route-3 identifier row mismatch.** Route 4 keys constructions by
  the top-down `row_span[0]`; GH's route-3 surfaces and constructions use the
  **reversed** row (`ElementData.type_name`, `win_create_geom.create_names`).
  Inert today — `v1/apertures_get.py` deliberately never calls route 4 — but if
  anyone ever joins them by name the rows are flipped. Not this feature's
  problem; recorded here because Phase 5 touches both routes.
- **"Empty" naming.** Fine and unambiguous. Just make sure the glossary entry
  distinguishes it from the existing empty-state UI term
  (`ApertureEmptyState.tsx`).

---

## On deferring "solid" (D-2 / PRD §7)

Agree with the deferral, with one correction to the rationale.

Escape hatch #4 ("model a spandrel as a g=0 glazing") is weaker than stated,
and the asymmetry cuts both ways:

- **g=0 glazing** puts the panel's area into `total_area_m2` and into the
  window U — which *is* what PHPP wants for a window-integrated spandrel. Fine.
- **Void** has the opposite failure: the void area is absorbed into the host
  wall's assembly in Rhino (`build()` only extrudes per-element surfaces; there
  is no unit-bounding surface, so the wall keeps that area). An insulated
  spandrel modeled as a void would silently get the *wall's* U-value, not the
  panel's.

For S15 — a real wood-base wall — void is correct. Write the criterion into §7
so it stays correct: **use Empty when the region really is the host wall
assembly**, and don't let it become the spandrel workaround.

Also worth stating in §7: the reserved enum slot is cheap in the schema but not
in the UI. Phase 4 should branch on `kind` through a switch / lookup table, not
an `isVoid` boolean, or adding `"solid"` later means rewriting the canvas and
the element card.

---

## Phase-level notes

- **Phase 1** — "no consumer branches on `kind` yet" leaves a window where a
  `replace_table`-authored void computes a U-value over real area and exports a
  bogus `WindowConstruction`. Only reachable via MCP, but either note the
  intermediate state explicitly or merge phases 1–3 together.
- **Phase 3** — good call making the S15 fixture shared. Add a second fixture
  with a **fully-void column**; that's the shape that breaks GH (F-1).
- **Phase 5** — the CPython parse of the route-3 payload against the unmodified
  `v1/window_types_schema.py` is cheap and worth it, but assert **column
  placement**, not just that it parses: at minimum, assert every grid column
  index appears as some element's `column_number`.

---

## Suggested disposition

| # | Finding | Suggested action |
| --- | --- | --- |
| F-1 | GH column placement breaks on fully-void columns | Fix `win_create_types.py` + add PHN export guard; reword §6 / A-3 |
| F-2 | Mullion vs. jamb frames at void boundaries | Document + soft warning; add to confirm-dialog copy |
| F-3 | `setElementKind` single-id | Change to `element_ids: list[str]`; add toolbar affordance |
| F-4 | "Allow holes" alternative unrecorded | Add to `decisions.md` as a rejected option |
| F-5 | All-void aperture types are silent | Add a validation warning; put deleteRow/Column in the §3 table |
| F-6 | `_add_along_axis` grows voids | Document + test in Phase 2 |
| F-7 | Wrong file pointer + undo-stack hole | Retarget Phase 4 to `usePickPasteHandlers.ts`; clear undo entries on kind change |
