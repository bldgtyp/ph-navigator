---
DATE: 2026-07-28
TIME: 09:17 EDT
STATUS: Draft — awaiting Ed's sign-off on §9 open decisions
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Product/behavior contract for void ("Filler") aperture elements, with a
  reserved-but-deferred extension path for solid spandrel panels.
RELATED: ./README.md, ./decisions.md, ./phases/,
  context/ui/pages/apertures-tab.md, context/GLOSSARY.md
---

# PRD — Aperture void ("Filler") panels

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
- An all-void aperture is degenerate but valid (U-value 0.0 over 0 area,
  empty exports); no special-casing.

## §3 Command surface

One new command:

```text
setElementKind { aperture_type_id, element_id, kind: "glazed" | "void" }
```

- glazed→void **clears** the six assignment slots (4 frames, glazing,
  operation) server-side in the same command. The frontend shows a confirm
  when assignments exist (§5); the edit lands in the draft, so it is
  discardable. (Open decision D-3: confirm-then-clear vs hard-refuse.)
- void→glazed produces a bare unassigned element (normal "unfinished" state).
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
| `setElementName`, `flipLeftRight`, dimension commands | unchanged |
| `refreshRefFromCatalog` | unreachable for voids (no refs) — no change needed |

`addRow`/`addColumn` keep creating glazed elements; users convert cells to
Filler afterward.

## §4 Consumer behavior matrix

| Consumer | Behavior for `kind == "void"` |
| --- | --- |
| U-value (`aperture_u_value/service.py`) | Skipped entirely: excluded from `total_q` **and** `total_area`; no `missing_frame` / `missing_glazing` warnings; no per-element result row. `total_area_m2` therefore becomes the true window area (correct for PHPP/takeoffs — void region is wall). |
| U-value cache (`cache.py:77`) | `kind` **must be added to the hash** — it changes the result. (Adding the field to the hashed subtree also naturally invalidates stale entries.) |
| Route-3 GH export (`gh_api/aperture_types_export.py`) | Void elements **omitted** from `elements`; grid dims stay full. No payload shape change → old GH definitions keep working. |
| Route-4 HBJSON export (`aperture_hbjson_export/service.py`) | Skipped — no `WindowConstruction` emitted. Identifier scheme untouched. |
| Spec report / use-sites (`apertures/` selectors) | No change needed — voids reference no frames/glazings, so they never appear in `use_sites`. Verify with a test. |
| Aperture drift (`aperture_drift/`) | No change needed — drift compares picked refs; voids have none. Verify with a test. |
| MCP read tools (`get_table`, `get_aperture_type`, …) | Field flows through automatically; `calculate_aperture_u_values` tool reflects the skip. |
| Total-dimensions caption | Unchanged — overall W×H stays grid-derived (the unit's bounding envelope). |

## §5 Frontend behavior

- **Canvas** (`ApertureSvgCanvas.tsx` + element layers): voids render as
  visually inert cells — muted fill with a diagonal-hatch pattern from design
  tokens, no glazing inset, no operation symbols, no U-value chip, no frame
  edges. Still selectable (needed to convert back / merge / name).
- **Element card** (`ApertureElementCard.tsx`): for a void, hide
  `FramesPanel` / `GlazingRow` / `OperationRow` / `UValueChip`; show a single
  caption: *"Filler — not part of the aperture. Excluded from U-value and
  exports."* plus the kind toggle.
- **Kind control**: a small "Filler" toggle (placement per apertures-tab page
  doc conventions). glazed→void with any assignment present opens a confirm
  dialog stating what will be cleared.
- **Interaction guards** (mirror server): `pick-paste-machine.ts` — voids are
  invalid pick and paste targets/sources; `merge-validation.ts` — mixed-kind
  merges invalid with a reason string, consistent with existing invalid-merge
  messaging.
- **U-value display**: aperture-level chip unchanged (server value already
  excludes voids); no per-element chip on voids.

## §6 GH / Rhino contract

**Zero code changes required** in `honeybee_grasshopper_ph_plus` /
`honeybee_ph` for void support:

- Route 3 omits voids; `row_heights_mm` / `column_widths_mm` remain the full
  grid, so `WindowElement` placement indices stay valid, the bottom-to-top row
  reversal is unaffected, and no sash is built in void cells — the wall stays
  wall there. The door still spans to the floor row; sidelites sit on their
  sill. `_C{col}_R{row}` identifiers remain collision-free (voids emit
  nothing).
- Verification is still required (Phase 5): pull an S15-shaped fixture through
  route 3 into Rhino and confirm geometry + constructions.

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
4. **Escape hatch exists today.** A spandrel can be modeled as a glazed
   element with a g=0 "panel" glazing entry — standard PHPP practice — so no
   project is blocked while deferred.
5. **Partial support would be worse than none.** Shipping solid with
   void-style export omission would delete real unit geometry in Rhino.

When picked up, solid becomes its own feature folder referencing this PRD; the
schema work here (kind enum, per-kind validators, per-kind command guards) is
its foundation.

## §8 Naming

- Wire/schema value: `"void"`. UI label: **"Filler"** (reads best to
  non-developers; "None" is ambiguous next to unassigned slots).
- Add **Filler panel (void element)** to `context/GLOSSARY.md` in Phase 5.

## §9 Open decisions (Ed)

| # | Question | Default if unanswered |
| --- | --- | --- |
| D-1 | UI label "Filler" (wire `void`)? | Yes — "Filler" |
| D-3 | glazed→void with assignments: confirm-then-clear or hard-refuse? | Confirm-then-clear |
| D-4 | Canvas treatment: token-based diagonal hatch on muted fill? | Yes (final look per design system during Phase 4) |

(D-2, solid deferral, is recorded as accepted in `decisions.md` pending Ed's
confirmation of this PRD.)

## §10 Phasing

Backend-first; every phase independently mergeable; `main` stays deployable.
See `phases/phase-0N-*.md` for full plans, file lists, and verification.

1. **Schema** — `kind` on `ApertureElement` (+ void invariant validator),
   wire + TS types. No behavior change anywhere yet.
2. **Command** — `setElementKind` + guards on pick/paste/merge/operation.
3. **Consumers** — U-value skip + cache-key inclusion, route-3 omission,
   route-4 skip; verify spec-report/drift need no change.
4. **Frontend** — canvas, element card, machine/merge guards, confirm dialog.
5. **Verification + docs** — e2e browser smoke, GH round-trip smoke (S15
   fixture), GLOSSARY + `context/ui/pages/apertures-tab.md` updates, closeout.

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
