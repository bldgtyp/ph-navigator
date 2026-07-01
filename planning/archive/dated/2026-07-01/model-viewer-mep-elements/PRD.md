---
DATE: 2026-07-01
TIME: -
STATUS: Draft — reviewed by Ed 2026-07-01 (row/segment focus behavior
  accepted); ready for implementation planning.
AUTHOR: Claude (for Ed)
SCOPE: Product/behavior contract for grouping duct/pipe segment
  selection to the parent Element in the Ventilation and Hot Water
  lenses of the Model tab, surfacing per-element and per-segment
  length prominently, linking the inspector's segment table to the 3D
  scene, and evaluating automatic dimension-line overlays.
RELATED:
  - planning/archive/dated/2026-06-13/model-viewer/UI_SPEC.md (accepted
    Model tab UI definition — this feature amends §3 lens table and §6
    selection/inspector for the two line-based lenses only)
  - planning/archive/dated/2026-06-13/model-viewer/PRD.md (MVP PRD —
    D-14 selection tokens, Q-VIEW-4 pipe fields)
  - context/user-stories/40-model-viewer.md (US-VIEW-4/6, Q-VIEW-4)
  - frontend/src/features/model_viewer/ (current implementation)
  - backend/features/model_viewer/schemas/honeybee_phhvac.py
  - PLAN.md, phases/ (implementation sequence, once authored)
  - README.md, STATUS.md (this folder)
---

# Model Viewer — MEP Element Selection & Length Reporting

## 0. Problem & design intent

Today, clicking a duct or pipe in the Ventilation / Hot Water lens
selects and describes **one line segment** — an implementation detail
of how the HBJSON geometry happens to be chunked, not a unit anyone
outside the model actually cares about. Certifiers reviewing a model
don't ask "how long is this segment?" — they ask **"how long is this
duct run / this pipe run, total?"** That number has to be visible in
under a second, and it has to be trustworthy (it's a certification QA
number, not decoration).

Design intent, one sentence: **clicking any part of a duct or pipe run
selects the whole run as one thing, and the very first number you see
is its total length — with the segment-by-segment breakdown one glance
further in, and the specific segment you care about reachable in one
more click, never hidden behind hunting.**

This is a **progressive-disclosure** problem, not just a grouping
problem: total length is the headline; segment detail is the
supporting evidence; and the 3D view and the segment table are two
synchronized views of the same list once you're inside an element —
not two separate things you have to reconcile by eye.

## 1. Scope

**In scope:**
- Ventilation lens: `DuctElementModelData` (supply + exhaust).
- Hot Water lens: `PipeElementModelData` at every level it currently
  renders as an independent unit — trunk, branch, fixture, and recirc
  (§3 explains why these are already four separate "Elements", not one
  tree).
- Click/hover selection semantics for these two lenses only.
- The inspector panel content for these two lenses only, including the
  bidirectional link between the 3D scene and the segment table once
  an element is selected.
- Backend: exposing per-segment and per-element total length as typed
  wire fields (ducts don't currently ship a length value at all; pipes
  ship it per-segment but not per-element).
- Feasibility call + recommendation on automatic dimension-line
  overlays for the selected element's segments.

**Explicitly not in scope** (see §11 for the full list): editing
duct/pipe data, multi-element selection, changes to the other four
lenses, changes to how honeybee_ph/HBJSON models are authored in
Rhino, or any change to what geometry is exported.

## 2. Current behavior (baseline, verified against code)

Ducts and pipes are the two lenses that deliberately **stayed off the
`BatchedMesh` substrate** ([[project_model_viewer_batched_substrate]],
D-6) — each segment renders as its own `@react-three/drei` `<Line>`
(`scene/BuildingLens.tsx` `LineObject`), because segment counts are far
smaller than face counts and per-object picking is simpler. This is
good news for this feature: the per-object architecture is exactly
what element-level grouping needs to hook into, and segment counts are
small enough that grouping overhead is a non-issue.

Concretely, today:
- `loaders/building.ts` builds one `LineRenderable` per segment. The
  renderable `id` already **embeds the parent element's identifier**:
  `duct:${element.identifier}:${segmentKey}` and
  `pipe:${pipeKind}:${element.identifier}:${segmentKey}`
  (`addDuctElements` / `addPipeElement`, `loaders/building.ts:260-379`).
- `BuildingModel.metaById: Map<string, ModelObjectMeta>` is a flat
  lookup, one entry per renderable, built once in `buildBuildingModel`
  (`loaders/building.ts:68-90`). `ModelViewerStage.tsx:155` resolves
  the inspector's `meta` with a single
  `model?.metaById.get(selectionId)` and passes it straight to
  `<InspectorPanel meta={selectedMeta} />` (`ModelViewerStage.tsx:198`)
  — there is currently no notion of "a selection that isn't one
  renderable."
- `store.ts` holds one `selectionId: string | null`. `LineObject`
  compares `state.selectionId === object.id` to decide whether *this
  segment* renders highlighted (`scene/BuildingLens.tsx:132`).
- Click resolves to `setSelectionId(objectId)` where `objectId` is the
  **segment's** renderable id (`scene/BuildingLens.tsx:202-211`);
  double-click does the same plus a camera zoom
  (`scene/BuildingLens.tsx:213-218`).
- `CameraRig.tsx`'s `zoomTo` resolves one `targetId` via
  `model.metaById.get(targetId)` and fits camera bounds to that one
  object's vertices (`scene/CameraRig.tsx:29-31`).
- Pipe segments already carry a `length` field on the wire
  (`PipeSegmentModelData.length`, meters) and it's already shown in
  the segment inspector (`lib/fieldConfigs.ts:177-182`, per Q-VIEW-4).
  **Duct segments carry no length field at all** — not in the backend
  schema, not on the wire, not in the inspector.
- Nothing today sums segment lengths into an element total, for either
  duct or pipe.
- `ModelViewerStage.tsx`'s keyboard handler also resolves
  `selectionId` → `meta` for `Esc` (clear selection, line 102) and
  `⌘/Ctrl+C` (copy `meta.identifier`, line 114) — both currently
  assume a single-renderable selection too.

## 3. Domain model — what "Element" means here, precisely

This matters because Hot Water's data shape is a 4-level tree
(`HotWaterSystemModelData` → trunk → branch → fixture), and it is
**not** one big pipe per system — it's several independent
`PipeElementModelData` objects stitched into a tree:

```
HotWaterSystem
├─ distribution_piping: { trunk_id → PipeTrunk }
│    PipeTrunk.pipe_element        ← ONE PipeElement (the trunk run itself)
│    PipeTrunk.branches: { branch_id → PipeBranch }
│         PipeBranch.pipe_element  ← ONE PipeElement (the branch run itself)
│         PipeBranch.fixtures: { fixture_id → PipeElement }  ← ONE PipeElement each
└─ recirc_piping: { id → PipeElement }  ← ONE PipeElement each
```

The current loader (`pipeRenderables`, `loaders/building.ts:296-313`)
already calls `addPipeElement` **once per `pipe_element` it finds** —
trunk, each branch, each fixture, each recirc run — so "one Element" in
this feature is exactly what the loader already treats as one
independent group today. No new hierarchy needs inventing; this
feature groups segments up to the boundary the backend/loader already
draws, nothing more.

Ducts are simpler: `VentilationSystemModelData.supply_ducting` /
`exhaust_ducting` are flat lists of `DuctElementModelData`, each with
its own `segments` dict. One list entry = one Element.

**Decision D-1: an Element's identity for selection purposes is the
loader's existing per-`addDuctElements`/`addPipeElement`-call
grouping** — i.e. a duct element, or one trunk/branch/fixture/recirc
pipe run. Not the whole ventilation system, not the whole distribution
tree. This matches the user's ask ("select the entire Element") and
requires no redesign of the data model.

## 4. New behavior — Element-level selection & highlight

- **Click** on any segment of a duct/pipe run selects the **parent
  Element**, not the segment. Every segment belonging to that element
  gets the selection treatment simultaneously — it should read as one
  continuous highlighted run, not a set of separately-colored line
  pieces that happen to share a color. (§10 pins down the exact color
  tier once §6's row/segment focus is factored in.)
- **Hover** is promoted to element-level too (Decision D-2 below):
  hovering any segment lightly highlights the whole run. Rationale: if
  click groups but hover doesn't, the hover state visually lies about
  what a click is about to do — the object under the cursor would look
  like "just this piece" right up until the moment it selects
  "everything." Grouping hover keeps the affordance honest at zero
  extra cost (hover is already a cheap id-membership check, and
  element sizes here are small — single digits to a few dozen
  segments, not thousands).
- Selection remains a single value app-wide (no multi-element select)
  — consistent with every other lens today.
- Deselection (click empty space, `Esc`, lens switch) behaves exactly
  as it does now, and also clears the §6 segment-focus state (it
  cannot outlive the element selection it belongs to).
- **Zoom to** (button + double-click) fits the camera to the union of
  *all* the element's segment vertices, not just the clicked one.
- **Copy ID** (`⌘/Ctrl+C` or the inspector button) copies the
  *element's* identifier when an element is selected.

**Decision D-3:** selection state stays a single id
(`selectionId: string | null`), but for these two lenses that id now
names an **element**, resolved through a new, explicitly-namespaced id
space so it can never collide with an existing renderable id (e.g.
`element:duct:<identifier>` / `element:pipe:<pipeKind>:<identifier>`,
distinct from the segment renderable ids' `duct:<identifier>:<segmentKey>`
shape). `BuildingModel` gains a second lookup,
`elementsById: Map<string, ElementSummary>`, built alongside
`metaById` in the same loader pass; every `LineObject` whose segment
belongs to the selected element (via this same grouping) renders as
selected. This is a rendering-lookup and one-new-map change, not a
`selectionId` type change — the rest of the app's handling of it
(URL/keyboard/measure-mode interactions) is untouched, it just now
also needs to check `elementsById` alongside `metaById` at the handful
of call sites that resolve a selection to something to show
(`ModelViewerStage.tsx:114,155`, `CameraRig.tsx:29-31`).

## 5. New behavior — Element inspector card

Replaces the flat single-segment field list with a two-tier card for
`ductSegmentLine` / `pipeSegmentLine` selections specifically (every
other lens's inspector is unchanged):

```
┌──────────────────────────────────────────┐
│ PIPE ELEMENT                        ✕    │
│ HW_Trunk_02                        ⧉     │  ← display name; copy-ID
│ Distribution · Trunk                     │  ← role chip (D-6, optional)
│───────────────────────────────────────── │
│  TOTAL LENGTH                            │
│  42.6 m                                  │  ← large type, first thing seen
│  6 segments  ·  Ø 25 mm (typ.)           │  ← secondary, quiet
│───────────────────────────────────────── │
│  SEGMENTS                                │
│  ┌───┬─────────┬────────┬──────────┐     │
│  │ # │ Length  │ Ø      │ Material │     │
│  ├───┼─────────┼────────┼──────────┤     │
│  │ 1 │  8.2 m  │ 25 mm  │ Copper   │     │
│  │ 2 │ 11.0 m  │ 25 mm  │ Copper   │  ←  │  row hover/focus ↔ 3D (§6)
│  │ 3 │  6.4 m  │ 22 mm  │ Copper   │     │
│  │ … │   …     │  …     │   …      │     │
│  └───┴─────────┴────────┴──────────┘     │
│    ▸ Segment 3 — full detail (focused)   │  ← expanded row (accordion)
│      Insulation Thickness      19 mm     │
│      Insulation Conductivity 0.040 W/mK  │
│      Water Temp                  55 °C   │
│      Daily Period                18 h    │
│───────────────────────────────────────── │
│ [ ⊙ Zoom to element ]                    │
└──────────────────────────────────────────┘
```

- **Header total** is the whole point of this feature: large,
  high-contrast, unit-toggle-responsive, always visible without
  scrolling — this is the certifier's primary QA number.
- **Segment table** is a compact, purpose-built table (3-4 columns:
  stable display index, length, and 1-2 differentiating attributes per
  lens type — diameter for both, material for pipes, duct type doesn't
  vary within one element so it's not a column). **Not** the shared `<DataTable>`
  primitive (`context/technical-requirements/data-table.md`) — that
  component is scoped to full-width page surfaces (catalog managers,
  Rooms, Equipment tabs, bookshelf pickers); its own doc's consumer
  list doesn't include inspector panels, and a 320px slide-in panel
  can't fit a sort/filter/group toolbar. **Decision D-4:** build a
  small bespoke table styled on the existing `.model-inspector-*`
  token classes.
- **Row expand = the existing single-segment field list.** Every field
  currently in `inspectorConfigs.pipeSegmentLine` /
  `ductSegmentLine` (`lib/fieldConfigs.ts:129-216`) survives, just
  relocated from "the whole panel" to "one row's accordion." No field
  coverage is lost, and this reuses the existing config objects and
  formatters as-is. A row expands automatically when it becomes the
  §6 focused segment; clicking an already-focused row's header
  collapses it again.
- Segment numbering (`#` column) is **stable display order, not a
  physical path order, editable id, or authoritative segment id** — it
  exists purely so a certifier can say "segment 3 is short, that's the
  one under the joist" when talking to a colleague.
- All lengths respect the live IP/SI toggle, using the exact
  formatters already in `lib/fieldConfigs.ts`
  (`formatMetersAsLength` → `formatLengthFromMm`) — no new formatting
  code.

## 6. Row ↔ 3D focus linking (once an element is selected)

Only active while an element is selected and its inspector card (§5)
is open — before that, there is no table to link to, and hover keeps
its pre-selection meaning (§4: previews the whole *hovered* element,
not yet the selected one).

Two independent links, matching two different interaction weights
already used elsewhere in the app — hover is transient, click is
sticky:

- **3D hover → table row** (transient, reuses the existing `hoverId`
  store field — no new state needed for this direction). Hovering a
  segment that belongs to the *currently selected* element
  highlights/scrolls its row into view, and gives that one segment a
  distinct visual bump in 3D (§10 pins down the exact tier). Hovering a
  segment that belongs to a *different, unselected* element behaves
  exactly as it does today at the element level (§4's whole-element
  preview) — it does not touch the open table, because that segment
  isn't a row in it. No special-case logic is required to keep these
  from colliding: the table only ever looks for `hoverId` inside its
  own element's segment list, so a `hoverId` belonging to another
  element simply matches nothing there.
- **Table row click → 3D segment** (sticky, new
  `focusedSegmentId: string | null` store field, scoped to "a segment
  id within the currently selected element"). Clicking a row sets it
  as the focused segment: expands that row's full detail (§5) and
  gives that one segment the strongest highlight tier in 3D — one step
  brighter than the rest of the selected element, so it reads as "this
  one, within the whole" — and it *persists* while the user orbits/pans
  away from the table to go look at it (unlike hover, which disappears
  the moment the cursor leaves). Clicking the same row again
  collapses/un-focuses it; clicking a different row swaps focus (only
  one segment can be focused at a time, consistent with the
  single-selection model everywhere else in this app).

**Why click, not hover, for row → segment:** hovering a row is
transient by nature — it vanishes the instant the cursor leaves the
table to go operate `OrbitControls` in the canvas, which is exactly
the moment the user needs the highlight to still be there. Click also
avoids a real ambiguity: if clicking a segment *in 3D* re-set
`selectionId` to that one segment, it would silently break out of
"select the whole element" (§4) — keeping 3D clicks meaning only
"select the element," and routing segment-level clicks through the
table, avoids that collision entirely.

**Interaction with hover when a segment is already focused:** hover
and focus almost never compete, because they are independent
*per-segment* states, not a single scene-wide "who wins" flag — a
hovered segment gets the hover bump, the focused segment (if a
different one) keeps its stronger focus treatment, and both can be
visible at once if the user is pointing somewhere else in the same
element while a row stays focused. If the user hovers the
*already-focused* segment, nothing changes visually — the focus
treatment already dominates for that one segment because it's the
strongest tier that segment can have (§10). (Note: this corrects a
looser description from earlier discussion — "hover beats selection"
is not how `LineObject` behaves today; `isSelected` already takes
priority over `isHovered` for the *same* object in the current color/
width logic, `scene/BuildingLens.tsx:141-148,183-190`. The two tiers
here don't need to compete at all, because they are almost never
describing the same segment.)

**Reset:** `focusedSegmentId` clears on every path that already clears
`selectionId` today — `Esc`, click empty space, lens switch, selecting
a different element. It should never outlive the element selection it
belongs to; there is no "focus a segment, then have it survive after
deselecting the element" state.

**Decision D-7:** the row↔segment link is hover (3D → row, transient)
in one direction and click (row → 3D, sticky) in the other, gated to
only activate once the owning element is already selected. Rationale
above; this is the shape Ed confirmed 2026-07-01.

## 7. Total length — data source & backend changes

Per the repo's hard rule ("All calculations and data manipulation live
in the backend"), the frontend must not be the source of truth for the
headline total-length number — it sums nothing itself for display; it
displays a number the backend computed. This also sidesteps float
summation-order drift between what PHN shows and what the certifier's
PHPP/WUFI source model reports for the same run.

**Pipes — already computed upstream, at every tree level, just not
wired through.** `honeybee_phhvac.hot_water_piping.PhHvacPipeElement
.length` already exists as a Python property (`sum(s.length for s in
self.segments)`, `hot_water_piping.py:327-330`), and its
`to_dict(_include_properties=True)` already emits it as `d["length"]`
(`hot_water_piping.py:411-419`). `extraction.py`'s hot-water path
**already calls `to_dict(_include_properties=True)`**
(`extraction.py:250`) at the top of the tree, and the flag **verified
to propagate all the way down**: `PhHotWaterSystem.to_dict()` passes
`_include_properties` into every `distribution_piping`/`recirc_piping`
entry (`hot_water_system.py:238-244`), and `PhHvacPipeTrunk`/
`PhHvacPipeBranch.to_dict()` each pass it into their own
`pipe_element.to_dict(_include_properties)` and into their nested
branches/fixtures (`hot_water_piping.py:669-672`, `927-930`). So
**every** `pipe_element` dict at every level of the tree — trunk,
branch, fixture, recirc — already has `length` sitting in the
extraction dict today; it's dropped only because
`PhHvacPipeElementSchema` (`schemas/honeybee_phhvac.py:85-91`) doesn't
declare a `length` field to catch it. The same `to_dict()` call also
already produces length-weighted `water_temp`, `daily_period`,
`material_name`, and `diameter` for each element
(`hot_water_piping.py:420-423`) — free bonus context if wanted for the
§5 summary line (`Ø 25 mm (typ.)` could be this exact length-weighted
value instead of a frontend-computed mode/first value). **Also
free at the whole-system level** (not this feature's scope, see §11):
`PhHotWaterSystem.to_dict(_include_properties=True)` additionally
emits `total_distribution_pipe_length`, `total_home_run_fixture_pipe_length`,
and `total_recirc_pipe_length` (`hot_water_system.py:250-253}`) — a
future "system summary" card would be similarly free to build.

**Decision D-5:** wire `length` (required for this feature) plus the
four bonus aggregate fields (low-cost, already computed) onto
`PhHvacPipeElementSchema` and the matching `PipeElementModelData` TS
type.

**Ducts — needs one small addition, ducts don't ship length at all
today.** `honeybee_phhvac.ducting.PhDuctSegment.length` and
`PhDuctElement.length` (`sum` of segment lengths) already exist as
Python properties too (`ducting.py:61-64`, `286-289`) — but
`PhDuctSegment.to_dict()` / `PhDuctElement.to_dict()` never serialize
them (no `_include_properties` gate exists on the duct classes at
all, unlike pipes). Two viable paths:

  a. **(Recommended for this feature) Compute locally in PHN.** Add a
     Pydantic `@computed_field` to `PhHvacDuctSegmentSchema` deriving
     `length = sqrt(v.x² + v.y² + v.z²)` from the already-present
     `geometry.v` — mathematically identical to
     `LineSegment3D.length`, the same formula honeybee_phhvac itself
     uses. Add the same to `PhHvacDuctElementSchema` as
     `sum(segment.length for segment in segments.values())`. Zero
     upstream dependency, ships in this repo alone, no version-bump
     coordination.
  b. **(More "correct," not required for v1) Fix upstream.** Add an
     `_include_properties`-style flag to `PhDuctSegment.to_dict()` /
     `PhDuctElement.to_dict()` in `honeybee_phhvac/ducting.py`
     (BLDGTYP-owned, `PH-Tools/honeybee_ph`), mirroring the existing
     pipe pattern exactly, then bump the `honeybee-ph` dependency in
     `ph-navigator-v2/backend`. This is the right long-term home for
     the logic (one computation, defined once, in the domain library),
     but it adds a cross-repo release + `uv add` bump to this
     feature's critical path for no v1 benefit.

  **Recommendation, confirmed 2026-07-01: ship (a) now**, and file the
  upstream fix (b) as a small follow-up in `honeybee_ph` separately —
  not a blocker here, but worth doing eventually so PHN doesn't carry
  logic that duplicates (even if correctly) what the source library
  already knows how to compute.

**UI label note:** the wire field name should stay `length` on the
element schema (matches the upstream property name 1:1, "no field
renames" convention) even though it represents a sum — the *inspector
label* says "Total Length" (labels already diverge from field names
throughout `fieldConfigs.ts`, e.g. `weighted_floor_area` → "Weighted
Area"), so there's no wire/UI naming conflict to invent.

## 8. Camera / zoom-to for elements

`CameraRig.tsx`'s `zoomTo` currently resolves one `targetId` to one
object's vertices via `model.metaById.get(targetId)`
(`scene/CameraRig.tsx:29-31`). For an element-level "Zoom to," this
needs to fit the union of every segment's vertices belonging to the
selected element. Recommended approach given D-3's new
`elementsById` map: `zoomTo` tries `model.elementsById.get(targetId)`
first; if found, union the bounds of every one of that element's
segment vertex lists; otherwise fall back to today's single-object
`metaById` lookup unchanged. `cameraRequest.targetId` stays a single
string — no shape change to the camera-request contract. Left to
implementation planning to finalize the exact bounds-union helper,
flagged here so it isn't missed as "free" when it isn't.

## 9. Dimension lines — feasibility & recommendation

**Verdict: feasible, and worth building — but scoped, not ambient.**
The user's own stated concern (don't overwhelm the view, don't add
rendering overhead) has a clean answer that falls directly out of §4:
**render dimension lines only for the segments of the currently
*selected* element**, never for a whole lens. This bounds the overhead
to single digits–to–a few dozen extra line objects (an element's
segment count), never the hundreds that a "whole model" or "whole
lens" version would cost, and it turns dimension lines into exactly
the kind of "drill in one more level" affordance the rest of this PRD
is already built around — not new chrome, the natural next step after
selecting.

**Decision D-6: dimension lines are selection-scoped, always-on for
the selected element only, no separate toggle in v1.** No "show
dimensions for the whole ventilation lens" mode — if that's wanted
later, it's a real perf/legibility redesign (see risk below), not a
checkbox to add casually.

**Visual language** (standard CAD dimension convention, adapted to an
arbitrary-direction 3D segment):

```
              8.2 m
        ⊣───────────⊢        ← dimension line + end ticks, offset to the side
        |             |       ← extension lines back to the true endpoints
        •─────────────•       ← the actual duct/pipe segment
      start           end
```

For each segment: two extension lines (true endpoint → offset point),
one dimension line between the offset points with tick marks at each
end, and one midpoint label. This is new geometry construction (offset
+ ticks), but it is **not** a new rendering technique — it composes
directly from primitives already proven in this codebase:

- `scene/MeasureOverlay.tsx` already renders exactly this
  line-plus-midpoint-label pattern for user-drawn measurements: a drei
  `<Line>` plus a canvas-scoped drei `<Html>` label
  (`<Html position={midpoint} center className="model-measure-label"
  pointerEvents="none">`, `MeasureOverlay.tsx:139-148`) — canvas-scoped
  specifically to avoid the V1 `document.body`-attached-label leak
  this codebase already fixed once.
- `lib/measure.ts`'s `formatMeasureDistance` is already unit-toggle
  aware (`formatFeetInches` / meters) — the same formatter (or the
  `formatMetersAsLength` already used for segment length in
  `fieldConfigs.ts`) covers dimension labels with no new formatting
  code.
- **Offset direction:** recommend a camera-facing perpendicular offset
  (`normalize(cross(segmentDirection, cameraViewDirection))`),
  recomputed as the camera moves, rather than a fixed world-axis
  offset. Duct/pipe runs travel in arbitrary directions in 3D
  (including vertical risers), so a fixed-axis offset degenerates for
  some runs (e.g. a vertical riser offset "up" would overlap itself).
  A camera-facing offset always reads as "to the side" from whatever
  angle the run is being viewed at, and it's the same per-frame-reproject
  cost the existing `<Html>` labels already pay — not a new
  complexity class, just applied to a couple more objects.
- Offset distance, tick length, and label decluttering for very short
  segments are implementation-level tuning, not product decisions —
  flagged in §13, not specified here.

**Perf guardrail (borrow the existing pattern):**
`__tests__/perfGate.test.ts` already asserts the BatchedMesh substrate
stays O(1) regardless of face count, specifically so a future refactor
can't silently reintroduce per-object rendering
(`perfGate.test.ts:1-13`). Recommend an analogous gate here: a unit
test asserting the dimension-line object count added to the scene
scales with **the selected element's segment count**, not the lens's
total segment count — so a future "helpful" change (e.g. "let's also
show dimensions on hover") can't accidentally make this ambient across
a 500-segment Hillandale-scale ventilation system without the test
noticing.

**Named risk, explicitly not solved here:** drei `<Html>` labels are
real DOM nodes, reprojected every frame — cheap in the single digits
(today's Measure feature proves that), untested at "every segment of
every element in a large lens simultaneously." Because D-6 keeps this
selection-scoped, that scenario doesn't arise in v1. If a future
"dimension the whole run visibly at all times" ask comes up, it should
be scoped as its own follow-up with its own perf validation (possibly
swapping DOM `<Html>` for a billboard SDF-text technique like
troika-three-text) — not assumed to fall out of this feature for free.

**If dimension lines turn out to be more work than expected:** they
are additive polish on top of §5's segment table, which already gives
a certifier the per-segment length list in scannable form without any
3D annotation. Recommend not letting dimension-line scope creep block
shipping §4-§7.

## 10. Visual language & tokens

Extends, rather than replaces, the existing D-14 `--highlight` family
and the line-specific hover color already in `lib/colors.ts` /
`scene/BuildingLens.tsx` — no new hues to design, only new
*assignments* of existing tokens to the newly-distinguished states:

| State | Token | Existing precedent |
|---|---|---|
| Default segment (element not selected, not hovered) | per-lens-style color (supply blue / exhaust red / distribution / recirc dash) | unchanged, `lineStyleDefinition` |
| Segment under the cursor right now (`hoverId`), owning element **not yet selected** | `VIEWER_LINE_HOVER_COLOR`, applied to **every** segment of the hovered element (D-2 whole-element preview) | same token used today for single-segment hover; scope widens from 1 segment to N |
| Every segment of the **selected** element, except a focused one | `tokens.highlightSoft` (`--highlight-light`, already resolved in `lib/colors.ts:46` but not yet threaded into `LineObject`) | new usage for lines; already used elsewhere in the viewer for soft/light emphasis |
| The one **focused** segment (`focusedSegmentId`, §6) | `VIEWER_HIGHLIGHT_FALLBACK` / `tokens.highlight` (full `--highlight`) | exactly what "selected" already looks like today, pre-this-feature — just re-scoped from "the whole click target" to "the one focused-via-table segment" |
| A non-focused segment of the selected element that also happens to be under the cursor (`hoverId`) right now | `VIEWER_LINE_HOVER_COLOR` (same as row 2, just scoped to one segment instead of the whole element, since the element itself is already showing its selected/soft state) | same token, third context |

Net result: hover color always means "your cursor is here, right now"
(scoped to one segment or a whole not-yet-selected element depending
on context); the full highlight color always means "committed, sticky"
(scoped to one focused segment once inside a selection, matching
exactly what full-strength highlight meant before this feature
existed); the new soft/light tier means "part of the current
selection, not specifically focused." No token means two different
things at once, and nothing new needs to be designed — only wired up.

**Implementation note:** `LineObject` (`scene/BuildingLens.tsx`)
currently hardcodes `VIEWER_HIGHLIGHT_FALLBACK` directly rather than
reading `tokens.highlight`/`tokens.highlightSoft` the way `BatchedLens`
does; this feature should thread `tokens: ViewerTokens` into
`LineObject` as a prop so all tiers resolve through the same
CSS-var-aware path `BatchedLens` already uses, rather than adding a
second hardcoded constant.

**Sequencing note:** the soft/full split only matters once a "focused
vs. rest" distinction exists at all. Until §6 ships, "selected element"
can safely render every one of its segments at full highlight (i.e.
exactly today's single-segment look, just applied to N segments) —
that is a complete, coherent, independently-shippable visual state on
its own. The soft/full split and the `tokens` threading belong to the
phase that ships §6, not the phase that ships §4.

## 11. Explicitly out of scope

- Editing duct/pipe geometry, segments, or attributes. The viewer
  stays read-only (§11.4 of `context/technical-requirements/frontend-viewer-units.md`
  — viewer is display-only per the V2 disconnect-from-builder-data
  decision).
- Multi-element selection (select two runs at once). Single global
  `selectionId` stays single.
- Any change to Building, Spaces, Floor Areas, or Site & Sun lenses.
- Any change to how honeybee_ph/Grasshopper authors or exports
  duct/pipe geometry, or to segment count/order in the source model.
- A "show dimensions for the whole lens" mode (see D-6 / §9 risk).
- Surfacing Trunk/Branch or whole-**system**-level rollups (e.g. "total
  HW distribution piping across the whole system") — out of scope for
  this pass since the user asked for Element-level total length
  specifically. Worth noting for later: `PhHvacPipeBranch.total_length`
  (branch + all its fixtures, `hot_water_piping.py:624-627`) and
  `PhHotWaterSystem.total_distribution_pipe_length` /
  `total_home_run_fixture_pipe_length` / `total_recirc_pipe_length`
  (whole-system, `hot_water_system.py:250-253`) all already exist
  upstream too — a future "system summary" card would be similarly
  cheap to build. Not proposed here.

## 12. Design decisions (summary)

| # | Decision | Rationale |
|---|---|---|
| D-1 | An "Element" = the loader's existing per-`addDuctElements`/`addPipeElement`-call group (duct element; trunk/branch/fixture/recirc pipe run) | Matches existing data/loader boundaries; no data-model redesign |
| D-2 | Hover is also promoted to element-level (not just click) | Hover must not visually contradict what a click is about to do |
| D-3 | `selectionId` stays a single string id; for these two lenses it now names an element in a new, explicitly-namespaced id space (`element:duct:…` / `element:pipe:…`), resolved via a new `elementsById` map alongside the existing `metaById` | Minimal state-shape change; guarantees no id collision by construction; rest of the app (URL, keyboard, measure mode) is untouched |
| D-4 | Segment table is a bespoke small component, not the shared `<DataTable>` | `<DataTable>`'s own contract scopes it to full-width page surfaces; doesn't fit a 320px panel |
| D-5 | Pipe element `length` (+ free length-weighted `diameter`/`water_temp`/`daily_period`/`material_name`) wired from already-existing upstream computation, verified to propagate through every tree level | Already computed, already on the wire dict, just not declared in the Pydantic schema |
| D-6 | Dimension lines render only for the selected element's segments, no lens-wide toggle in v1 | Directly answers the "don't overwhelm the view" concern; keeps DOM-label count bounded |
| D-7 | Row↔segment linking is hover (3D→row, transient) one direction and click (row→3D, sticky) the other; gated to only activate once the owning element is already selected; duct length computed locally (§7a), not via an upstream `honeybee_ph` release | Hover must stay ephemeral so it doesn't survive the user leaving the table to orbit the camera; click must own segment-level sub-selection so a 3D click can safely keep meaning "select the element," with no ambiguity; local duct-length compute avoids a cross-repo release blocking this feature |

## 13. Settled implementation notes

1. **Segment dict insertion order is not physically meaningful.**
   Verified 2026-07-01 against the canonical fixture and Hillandale
   `Hillandale_Gateway_NAR_260402.hbjson`: endpoint-to-next-start
   chaining fails for 2 of 3 multi-segment canonical elements and 61
   of 94 multi-segment Hillandale elements. The `#` column remains a
   stable display index only; the UI/docs must not claim it walks the
   run start-to-end.

## 13a. Remaining follow-up questions

1. Should the pipe element card show a **role chip** ("Distribution ·
   Trunk" / "Distribution · Branch" / "Distribution · Fixture" /
   "Recirculation") per the §5 mockup? Requires the loader to stash a
   `pipe_role` onto meta (`pipe_kind` already exists;
   trunk/branch/fixture doesn't yet). Small addition, not required for
   the core feature — confirm it's wanted before adding scope.
2. Exact dimension-line offset distance, tick size, and short-segment
   label decluttering rule (§9) — implementation-level tuning to
   settle during the phase plan, not a product decision.

## 14. Acceptance criteria

1. In the Ventilation lens, clicking any duct segment selects and
   highlights every segment belonging to that duct element as one
   continuous highlighted run.
2. In the Hot Water lens, clicking any pipe segment selects and
   highlights every segment belonging to that pipe element (trunk,
   branch, fixture, or recirc run — whichever it belongs to) as one
   continuous highlighted run.
3. Hovering any segment of an element lightly highlights the whole
   element (not just that segment) when nothing is selected yet.
4. The inspector shows, without scrolling: element type, display name,
   and **Total Length** in the active unit system, updating live on
   IP/SI toggle.
5. The inspector shows a stable per-segment table with at minimum
   display index and length per segment; every field currently shown
   for a single segment today remains reachable (via row expand).
6. Once an element is selected: hovering a segment belonging to *that*
   element highlights/scrolls its row into view and gives it a
   distinct 3D bump; hovering a segment belonging to a *different,
   unselected* element does not affect the open table.
7. Once an element is selected: clicking a table row gives that
   segment the strongest highlight tier in 3D and expands its full
   detail; the highlight and expansion **persist** through camera
   orbit/pan away from the table. Clicking the same row again
   collapses/un-focuses it; clicking a different row swaps focus.
8. Segment focus (`focusedSegmentId`) resets whenever element
   selection changes or clears (`Esc`, click empty space, lens switch,
   selecting a different element) — it never outlives its element.
9. "Zoom to" fits the camera to the whole element's bounds, not one
   segment. Copy ID copies the element's identifier.
10. Duct elements report a correct total length (verified against the
    sum of `PhDuctSegment.geometry` vector magnitudes for a known
    fixture).
11. Pipe elements report a correct total length (verified against
    `PhHvacPipeElement.length` for a known fixture, at every tree
    level — trunk, branch, fixture, recirc).
12. If dimension lines ship: they appear only for the selected
    element's segments, are unit-toggle-responsive, and do not appear
    for any other element or when nothing is selected.
13. `make ci` green; no regression in the existing Ventilation/Hot
    Water Playwright specs (which currently assert single-segment
    inspector behavior and will need updating, not just passing
    incidentally).

## 15. Testing considerations

- Unit: segment→element grouping/lookup (given a set of renderables,
  correct partition by element id); element total-length aggregation
  correctness for both duct (computed) and pipe (pass-through) paths;
  IP/SI formatting of the new total-length field (reuse existing
  round-trip test pattern per `frontend-viewer-units.md` §11.5.2); the
  §10 four-tier color-resolution function in isolation (given
  hoverId/selectionId/focusedSegmentId + a segment's owning element id,
  assert the correct tier — this should be one small pure function,
  not a ternary chain grown in place inside `LineObject`).
- Backend: golden-fixture length assertions for both canonical and
  Hillandale fixtures (Hillandale already has 48 duct elements + 1 HW
  system with 10 trunks — good coverage for "many elements, varied
  segment counts"); assert pipe length is present at every tree depth
  (trunk/branch/fixture/recirc), not just the top level.
- Perf: the §9 dimension-line object-count gate, analogous to
  `perfGate.test.ts`.
- E2e: update `model-viewer-lenses.spec.ts`'s existing duct/pipe
  selection assertions (currently written against single-segment
  inspector behavior, per Phase 4 status notes) to assert
  element-level highlight + the new card content; add a case selecting
  a multi-segment element and asserting all segments highlight; add a
  case hovering a segment of the selected element and asserting its
  row highlights, then clicking a different row and asserting the 3D
  focus follows and survives a simulated camera orbit.

## 16. Risks

- **Duct length correctness risk is low** — the formula is a straight
  vector-magnitude sum, verifiable against the upstream library's own
  `length` property on the same fixtures used for existing golden
  tests.
- **Dimension-line DOM-label perf is the main technical risk**,
  mitigated by scoping to selection-only (D-6) — see §9's named risk
  for what's explicitly deferred if that scoping isn't enough.
- **Segment-order assumption (§13.1) was the main product-correctness
  risk** — it was verified false before closeout, so the shipped `#`
  column is documented as stable display order only.
- **State-resolution complexity risk:** §6/§10 add a third and fourth
  per-segment visual tier on top of the existing hover/selected pair.
  Keep the tier-resolution logic as one small, unit-tested pure
  function consumed by `LineObject`, not an inline ternary chain that
  grows unreadable as tiers are added.
