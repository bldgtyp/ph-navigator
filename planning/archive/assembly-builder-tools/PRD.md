---
DATE: 2026-06-04
TIME: 12:00
STATUS: Draft
AUTHOR: Ed May
SCOPE: Assembly Canvas (Envelope > Assemblies sub-tab) — to-scale SVG rendering + direct edit affordances
RELATED:
  - context/user-stories/20-envelope.md (US-ENV-2..US-ENV-10 — behavioral source)
  - research/v1-assembly-builder-reference.md (§9 canvas, §11 header)
  - frontend/src/features/envelope/components/AssemblyCanvas.tsx (current code to replace)
  - frontend/src/features/envelope/canvas-constants.ts (constants to drop)
---

# Assembly Canvas — PRD

## 1. Goal

Replace the current HTML+CSS flexbox canvas in
`features/envelope/components/AssemblyCanvas.tsx` with a
**to-scale SVG canvas** that achieves visual parity with the V1
vaulted-roof reference (`assets/v1-reference-to-scale.png`), and
restore the direct edit affordances that V1 had but V2 currently
lacks (hover-`+` add-segment / add-layer buttons, click-to-edit
thickness dimension labels, eyedropper / paint-bucket flow).

The V2 result must be a CAD-like cross-section: layer heights
strictly proportional to `thickness_mm`, segment widths strictly
proportional to `width_mm`, both axes sharing one scale factor at
all times. No clamps that distort aspect ratio.

## 2. Why this is a refactor, not a tweak

The current `AssemblyCanvas.tsx` is HTML+CSS only and carries
three "soft" clamps that structurally prevent true to-scale
rendering:

- `MIN_LAYER_HEIGHT_PX = 30` — clamps thin sheathing layers
  (0.5") to 30 px, identical visual height to a 3.5" stud cavity.
- `MIN_SEGMENT_WIDTH_PX = 72` — clamps narrow stud segments wider
  than their actual width.
- `MIN_LAYER_WIDTH_PERCENT = 12` + percent-of-max layer sizing —
  layers render as a percent of the widest layer's mm, not as
  absolute mm.

These exist because the flex-layout substrate cannot guarantee
aspect ratio under viewport changes. The fix isn't to tune the
constants — it's to swap the substrate. See §3.

## 3. Architectural decision: Option C — single `<svg>`, `viewBox` in mm, HTML overlay for chrome

The whole assembly draws into **one** `<svg>` element whose
`viewBox` is `0 0 maxLayerWidthMm totalThicknessMm` and whose
rendered `width` / `height` are
`maxLayerWidthMm * pxPerMm * zoom` /
`totalThicknessMm * pxPerMm * zoom`. Every segment is a `<rect>`
positioned by `x` / `y` / `width` / `height` in mm.

- **Aspect ratio is structurally enforced** by `viewBox` +
  `preserveAspectRatio="xMinYMin meet"`. CSS cannot squish it.
- **Zoom is a single multiplier.** Discrete steps
  `0.5 / 0.75 / 1.0 / 1.5 / 2.0 / 3.0` re-scale by updating the
  SVG's `width` / `height` props.
- **Chrome lives in an HTML overlay** absolutely positioned over
  the SVG: the left-side dimension column (per-layer thickness
  labels with click-to-edit), the top / bottom orientation labels,
  the hover-revealed `+` buttons, the per-segment edit / delete
  affordances, and any per-segment tooltips. The overlay reads
  the same layer / segment iteration that drives the SVG and
  derives screen-px positions from the same mm-to-px factor.
- **Hit testing** is native: each `<rect>` has its own
  `onMouseEnter` / `onClick`. No manual canvas hit math.

This is **not** what V1 did (V1 used one SVG per segment, each
holding a single decorative `<rect>`, with all layout done by
HTML flexbox). V1's approach worked but its to-scale guarantee
depended on flexbox respecting absolute pixel widths — fragile.
Option C moves the guarantee into the rendering primitive itself.

### What this unlocks (carry forward, even if not in v1)

- Native `<pattern>` fills for architectural hatching
  (insulation = diagonal lines, concrete = stipple, etc.).
- Trivial SVG-as-asset export (download an `.svg` of the
  assembly section for a spec sheet) once the visual is right.
- Cmd/Ctrl + scroll-wheel zoom is a one-liner via a wrapper
  `transform: scale()` — deferred but free.
- A "fit to viewport" zoom mode (US-ENV-4 criterion 9 `[Fit]`)
  is `Math.min(viewportW / maxLayerWidthMm, viewportH /
  totalThicknessMm)` — straightforward.

## 4. Scope

### In scope

- The SVG canvas itself (substrate, viewBox, per-segment rects).
- The HTML overlay chrome layered over the canvas:
  - Left-side **dimension column** with per-layer thickness
    labels; click a label to inline-edit; submit accepts mixed
    SI / IP input ("4 in", "156 mm", "2-1/2\"").
  - Top / bottom **orientation labels** ("exterior" / "interior"
    per `assembly.orientation`).
  - **Hover-revealed `+` buttons** at every layer top / bottom
    edge ("Add Layer Above" / "Add Layer Below") and every
    segment left / right edge ("Add Segment Before" / "Add Segment
    After") — magenta-circle style matching the V1 image
    (`assets/v1-add-segment-buttons.png`).
  - **Per-segment hover highlight** (subtle ring / fill shift) so
    the user sees what they're about to click.
  - **Click a segment** → opens the SegmentPropertiesModal
    (US-ENV-6, already specified — this PRD does not re-spec the
    modal contents).
- The **assembly header toolbar** that drives canvas-scoped
  modes:
  - Flip-Orientation (swap inside / outside labels).
  - Flip-Layers (reverse layer order).
  - Flip-Segments (reverse segment order in every layer) — NEW
    vs V1, requested in this PRD's user story §5.7.
  - Eyedropper (enter pick mode).
  - Paint-bucket (enter paste mode).
  - Zoom cluster `[−] 100% [+] [Fit]`.

### Out of scope (explicit non-goals)

- The assembly sidebar (US-ENV-2). Stays as today's
  `EnvelopeSidebar.tsx` — this PRD does not touch it.
- The header's name picker, Total Thickness label, Effective
  R-Value label (US-ENV-3) — those stay as currently
  implemented; this PRD only adds the toolbar buttons to that
  header.
- The Specifications sub-tab (US-ENV-13), Airtightness
  (US-ENV-14), Site Photos (US-ENV-15).
- The contents of `SegmentPropertiesModal`, `LayerHeightModal`,
  `AssemblyNameDialog`, etc. — they are entry points from the
  canvas but their internals are specified in US-ENV-5 /
  US-ENV-6 / US-ENV-2.
- The material picker mechanics (US-ENV-7).
- HBJSON export, drift / refresh-from-catalog,
  copy / paste payload shape, R-value computation. Those
  user stories already own that contract.
- Real CAD drawing tools, non-rectangular polygons, mouse-wheel
  zoom, drag-edge resize. Per the originating chat.

## 5. User stories

Each story below uses the format
`As a <role>, I want <behavior>, so that <reason>`. Where the
behavior already lives in `context/user-stories/20-envelope.md`,
this PRD cites that story and lists only the canvas-rendering /
direct-interaction acceptance criteria. Where the behavior is
NEW or expanded vs the existing user stories, it's flagged
**NEW** and fully specified here.

### 5.1 To-scale rendering of layers and segments

> As an editor, I want every layer drawn at a height proportional
> to its `thickness_mm` and every segment drawn at a width
> proportional to its `width_mm`, with both axes sharing the
> same scale factor at all times, so that the canvas reads as a
> true CAD section and I can spot proportion mistakes visually.

Cites US-ENV-4 (canvas) — this PRD's contribution is the
**substrate change** (HTML+CSS → single SVG with `viewBox` in mm).

Acceptance criteria:

1. The canvas substrate is a single `<svg>` element. Its
   `viewBox` is `0 0 maxLayerWidthMm totalThicknessMm`, computed
   from the active assembly's `tables.assemblies[a].layers[*]`.
   `preserveAspectRatio="xMinYMin meet"`.
2. Each segment renders as one `<rect>` with `x`, `y`, `width`,
   `height` in mm — never in px, never in percent. `fill` =
   resolved `project_material.color` (or the null-material
   pattern per criterion 7).
3. Each layer is a horizontal band. Within a layer, segments are
   laid out left-to-right by `segment.order`. The cumulative `x`
   of segment N is the sum of `width_mm` for segments
   `0..N-1` in that layer.
4. The SVG's rendered `width` / `height` props are
   `maxLayerWidthMm * BASE_PX_PER_MM * zoom` /
   `totalThicknessMm * BASE_PX_PER_MM * zoom`. No min-* clamps
   on either axis.
5. The three constants `MIN_LAYER_HEIGHT_PX`,
   `MIN_SEGMENT_WIDTH_PX`, `MIN_LAYER_WIDTH_PERCENT` in
   `canvas-constants.ts` are **deleted**. The new constants
   needed are `BASE_PX_PER_MM` (kept), `ZOOM_STEPS`
   (`[0.5, 0.75, 1.0, 1.5, 2.0, 3.0]`), and `MIN_CANVAS_WIDTH_PX`
   (a wrapper minimum so an empty assembly still draws a
   placeholder — does NOT clamp segment scale).
6. When the assembly's rendered width exceeds the viewport, the
   canvas's wrapper `<div>` scrolls horizontally
   (`overflow-x: auto`). Segments do NOT compress.
7. **Null-material segment** (per US-ENV-4 criterion 3): renders
   with no fill (or a faint diagonal-stripe `<pattern>`) and a
   dashed 1.5 px stroke. Hover still applies; click still opens
   the picker.
8. Layers shorter than ~2 px at the current zoom remain visible
   via the **dimension column callout** (criterion §5.5) — the
   user zooms in to interact. No min-height clamp.

### 5.2 Hover a segment and see it highlighted

> As an editor, when I hover any segment, it gets a clear visual
> highlight (ring + slight fill brightness shift) so I know what
> I'm about to click and can pick the right one in dense
> assemblies.

Cites US-ENV-4 criterion 3 (hover styles).

Acceptance criteria:

1. On `:hover`, each segment `<rect>` gets a `stroke-width: 2px`
   and `stroke` from CSS var
   `--construction-layer-segment-hover-stroke`. The fill
   brightens slightly via a CSS filter or by toggling to
   `--construction-layer-segment-hover-fill`.
2. Hover is suppressed when the canvas is in pick / paste mode
   (the pick / paste flow has its own hover treatment per §5.10).
3. Adjacent segments do not visually merge — the new SVG model
   means each `<rect>` has its own stroke; ensure
   `shape-rendering="crispEdges"` to avoid sub-pixel blur.

### 5.3 Click a segment to see and set details

> As an editor, I want clicking any segment to open the segment
> properties modal so I can change its material, width,
> continuous-insulation flag, steel-stud spacing, etc.

Cites US-ENV-6 (segment ops) for the modal contents. This PRD's
contribution is the click wiring on the SVG.

Acceptance criteria:

1. `onClick` on the SVG `<rect>` calls
   `onEditSegment(layer, segment)` (which opens
   `SegmentDialog`). The handler signature matches the current
   `AssemblyCanvas` props — no API change for callers.
2. Click is suppressed in pick / paste mode (the state machine
   in §5.10 intercepts instead).
3. Click is suppressed on a `<rect>` while one of the hover-`+`
   buttons (§5.4) is the actual event target — the `+` button
   sits in the HTML overlay above the SVG; `pointerEvents` on
   the overlay is the natural gate.
4. Keyboard equivalent: the canvas overlay tab-stops onto each
   segment in DOM order; `Enter` opens the modal. Accessible.

### 5.4 Add a new Segment left or right (hover-`+` buttons)

> As an editor, when I hover any segment, I see small magenta
> circular `+` buttons appear on its left and right edges with
> hover tooltips "Add Segment Before" / "Add Segment After", so
> I can split a layer into hybrid sections quickly.

Cites US-ENV-6 criterion 1 (add segment, two paths) for the
material-inheritance rule. This PRD specifies the **visual
presentation** (matching `assets/v1-add-segment-buttons.png`).

Acceptance criteria:

1. The `+` button is **HTML in the overlay layer**, not SVG —
   it's clickable / tab-able with native browser semantics.
2. Visual: circular, ~24 px diameter, magenta fill `#b2087c` per
   V1 parity (V1 ref §9.3). White `+` glyph centered. Subtle
   white halo / drop-shadow so the button reads clearly against
   any underlying segment fill color.
3. Position: floating **inside** the hovered segment, vertically
   centered in the layer, anchored a small inset from the
   segment's left and right edges (not on the boundary between
   adjacent segments). One button near the left edge, one near
   the right edge. Computed from the same `mmToPx(zoom)` factor
   that drives the SVG layout — when the segment is too narrow
   to fit both buttons without overlap (segment_render_width <
   ~60 px), they collapse to a single centered button whose
   click target is contextual (left half → Before, right half
   → After) OR are suppressed and the user zooms in. Lean:
   **collapse-to-center** for graceful narrow-segment handling.
   Mockup-resolve in Phase 02.
4. Visibility: hidden by default. Revealed on `:hover` of the
   segment (the segment wrapper has `:hover` which surfaces the
   buttons via the overlay layer's `pointer-events`). Hidden in
   pick / paste mode.
5. Tooltip: shadcn `<Tooltip>` with content "Add Segment Before"
   on the left button, "Add Segment After" on the right button
   (matches the V1 screenshot copy verbatim).
6. Click: calls
   `onAddSegment(layer, segment, "left" | "right")`. Behavior
   per US-ENV-6 criterion 1 (material inheritance from source
   segment, etc.).
7. Hidden entirely when `canEdit === false` (locked version or
   Viewer).

**Visual reference:** `assets/v1-segment-hover-plus-buttons.png`
shows the resolved treatment on a V1 vaulted-roof assembly —
the hovered wide yellow insulation segment (between two orange
stud-pair segments) carries two magenta `+` circles vertically
centered, anchored near the segment's inside edges (not on the
inter-segment boundaries with the orange neighbors). The
hovered segment itself shows a thin magenta dashed outline to
confirm the target. That outline is the hover-highlight per
§5.2. The left `+` button's "Add Segment Before" shadcn
tooltip is visible (per criterion 5); the right button's
"Add Segment After" tooltip would appear identically on its
own hover.

### 5.5 Dimension column — click a thickness label to edit

> As an editor, the left edge of the canvas is a CAD-style
> dimension column showing each layer's thickness as a numeric
> label, with thin dashed extension lines reaching across the
> layer. Clicking a label flips it into an inline input that
> accepts mixed SI / IP input ("4 in", "156 mm",
> "2-1/2 inch") and converts on submit.

Cites US-ENV-5 (layer ops) for the underlying mutation. This PRD
specifies the **dimension column presentation** plus the
**inline-edit affordance** (a NEW alternative to opening the
LayerHeightModal — both stay available).

Acceptance criteria:

1. The dimension column is an HTML strip ~48 px wide, on the
   left side of the canvas overlay. One label cell per layer.
   Cell height matches the layer's rendered height in px.
2. Each cell shows the thickness in the user's active display
   unit (mm or in). Format matches US-ENV-3 criterion 2:
   - IP: e.g. `3.500` (3 decimals).
   - SI: e.g. `88.9` (1 decimal).
3. A thin dashed horizontal extension line runs **from each
   cell's right edge to the left edge of the assembly SVG**
   (the small gap between the dimension column and the assembly
   itself). The line does **not** continue across the assembly
   body. Stroke `1px dashed #999`. One line at the top of each
   cell, one at the bottom — together they bracket the cell to
   its corresponding layer boundary. (Per Q-AB-2 resolved
   2026-06-04.)
4. **Click the label cell → inline edit.** The number flips to
   an `<input type="text">` with the current value selected;
   ESC cancels; Enter / blur submits.
5. **Input parsing** uses the shared quantity-aware units
   utility in `frontend/src/lib/units/` (PRD §11.5.3). Accepts:
   - Plain numbers — assumed to be in the active unit.
   - Numbers with a unit suffix — `"4 in"`, `"4 inch"`,
     `"156 mm"`, `"6.5 cm"`. The unit suffix wins regardless of
     the user's active display unit. **This is the requirement
     in the originating chat: "no matter the app-state, the
     system will auto-convert to the right input units."**
   - Fractional inches — `"2-1/2"`, `"2 1/2"`, `"2 1/2\""` —
     valid in IP-mode contexts.
6. Validation: parsed value must be `> 0`. Invalid input shows
   inline error tooltip; submit stays disabled until valid.
7. On submit: writes through the same draft-buffer JSON-Patch
   path as the LayerHeightModal — replaces
   `tables.assemblies[a].layers[l].thickness_mm`. Triggers
   R-value refetch.
8. **The LayerHeightModal still exists** (US-ENV-5
   criterion 2) and remains the canonical place to delete a
   layer; the inline edit on the dimension column is a faster
   path for thickness-only edits. Both routes feed the same
   patch.
9. Hover over a label cell reveals a small Edit icon hint so
   the affordance is discoverable.
10. Hidden / read-only when `canEdit === false`.

### 5.6 Add a new Layer and set its thickness

> As an editor, I want hover-revealed `+` buttons on every
> layer's top and bottom edges in the dimension column (matching
> the segment hover-`+` style) so I can insert a layer above or
> below any existing one.

Cites US-ENV-5 criterion 1.

Acceptance criteria:

1. `+` buttons live in the HTML overlay in the dimension column,
   visually anchored to each layer's top and bottom edges.
2. Same visual style as the segment add-`+` (criterion §5.4 #2).
3. Tooltip: "Add Layer Above" / "Add Layer Below" — verbatim.
4. Visibility gating identical to segment `+`: shown on layer
   hover; hidden in pick / paste mode; hidden when
   `canEdit === false`.
5. On click: calls `onAddLayer(layer, "above" | "below")`. The
   new layer's segment defaults per US-ENV-5 criterion 1a
   (last-picked material fallback per Q-ENV-3). New layer
   thickness defaults to **50.0 mm**, then opens the inline
   thickness editor (criterion §5.5) immediately so the user
   can type the actual value without a second click.

### 5.7 Flip operations (toolbar)

> As an editor, I want three flip operations exposed as toolbar
> buttons in the assembly header: flip orientation (swap inside /
> outside labels, layers untouched), flip layers (reverse layer
> order, orientation untouched), and **NEW: flip segments**
> (reverse segment order within every layer).

Cites US-ENV-8 for the first two (Flip Orientation, Flip Layers).
The **third flip is new** vs `context/user-stories/20-envelope.md`
and is added here because the originating chat explicitly listed
"can 'flip' Assembly up/down (reverse layer order) or left/right
(reverse segment order)."

Acceptance criteria:

1. Three icon buttons in the assembly toolbar, in this order:
   - **Flip Orientation** (`SwapVert` icon) — toggles
     `assembly.orientation`. Layers and segments untouched.
   - **Flip Layers** (`FlipVertical` icon) — reverses
     `assembly.layers[]` order and renumbers `layer.order`.
   - **Flip Segments** (`FlipHorizontal` icon) — for **every
     layer**, reverses `layer.segments[]` and renumbers
     `segment.order`. Operates on the whole assembly
     simultaneously, not per-layer (per Q-AB-1 resolved
     2026-06-04). NEW vs US-ENV-8.
2. All three apply as one JSON-Patch to the draft buffer per
   PRD §8.3. Trigger R-value refetch.
3. Buttons disabled when no assembly is selected, when in
   pick / paste mode, or when the active version is locked.
4. Visual feedback is the canvas update itself — no toast.

### 5.8 IP / SI input parsing (everywhere a length is entered)

> As an editor, when I type a length anywhere on this surface
> (layer thickness inline edit, segment width in the modal,
> steel-stud spacing), I can enter the value in either system
> — "4 inch", "156 mm", "2-1/2\"" — and the system auto-converts
> to the canonical SI mm stored in the document, regardless of
> my display-unit preference.

Cites US-ENV-5 criterion 2 (LayerHeightModal parsing) and
US-ENV-6 criterion 2.5 (SegmentPropertiesModal width). The
parser already exists at `frontend/src/lib/units/` per PRD
§11.5.3.

Acceptance criteria:

1. Every length input on the assembly canvas surface — the
   dimension-column inline edit, the LayerHeightModal width
   field, the SegmentDialog width / spacing fields — routes
   through the same shared parser.
2. Parser accepts:
   - Plain numbers (interpreted in active display unit).
   - SI suffixes: `mm`, `cm`, `m`. Case-insensitive. Optional
     space.
   - IP suffixes: `in`, `inch`, `inches`, `"`. Case-insensitive.
     Optional space.
   - Mixed-fraction IP: `"2-1/2"`, `"2 1/2"`. Treated as IP
     only when followed by an IP unit OR when the user's
     active display unit is IP.
3. Returns canonical SI mm (Pydantic on the backend stores SI
   only per PRD §11.5).
4. Invalid input → input shows inline error, submit disabled.
5. Already implemented in `frontend/src/lib/units/` — this PRD
   only requires that the new inline editor wires into it (no
   new parser code).

### 5.9 Delete segments and layers

> As an editor, I want delete to be reachable from inside the
> per-segment and per-layer edit modals — clicking a segment
> opens its modal (which has Delete), and clicking a layer's
> thickness label opens its modal (which has Delete). No
> hover-trash icons on the canvas.

Cites US-ENV-5 criterion 3 (layer delete with last-layer
guard) and US-ENV-6 criterion 3 (segment delete with
last-segment guard). Per Q-AB-4 resolved 2026-06-04 — delete
is **not** a hover-icon affordance on the canvas; the only
canvas-side delete path is "click segment → modal → Delete".

Acceptance criteria:

1. **Segment delete:** lives inside `SegmentDialog` only.
   Reached by clicking the segment body to open the modal,
   then Delete. shadcn `Dialog` confirm per US-ENV-6
   criterion 3. Last-segment guard per US-ENV-6 criterion 3
   (disabled with tooltip).
2. **Layer delete:** lives inside `LengthDialog` /
   `LayerHeightModal` only. Reached by clicking the thickness
   label in the dimension column to open the modal (the inline
   editor in §5.5 covers thickness-edit-only; opening the
   modal is the path to delete). Last-layer guard per
   US-ENV-5 criterion 3.
3. Both confirm via shadcn `Dialog` (not `window.confirm`).
   Both route through the draft buffer.
4. **No hover-trash icon anywhere on the canvas overlay.** Per
   Q-AB-4. Hover surfaces only the magenta `+` buttons (§5.4,
   §5.6); the segment body itself is the click target for
   edit / delete.

### 5.10 Eyedropper (pick) and paint-bucket (paste) on the canvas

> As an editor, I want to copy a segment's material assignment
> with an eyedropper click, then paint that assignment onto any
> number of target segments with a paint-bucket click each,
> without re-walking the material picker.

Cites US-ENV-9 (copy / paste) for the full state-machine
contract. This PRD specifies the **canvas-side rendering
behavior** during pick / paste mode.

Acceptance criteria:

1. **Pick mode** (`mode === "picking"`):
   - Cursor becomes the eyedropper SVG.
   - Every segment `<rect>` gains a 2 px green outline
     (`rgba(56, 142, 60, 0.8)`) — V1 parity. Implemented as a
     conditional `stroke` prop on the SVG rects.
   - Hover-`+` add buttons, edit buttons, delete buttons all
     hidden via the overlay's `data-mode="picking"` attribute.
   - Click a segment → captures its material assignment per
     US-ENV-9 criterion 3 → enters `picked` state.
2. **Picked state** (`mode === "picked"`):
   - Source segment shows a persistent green ring so the user
     remembers what's on the clipboard.
   - Cursor reverts to default.
3. **Paste mode** (`mode === "pasting"`):
   - Cursor becomes the paint-bucket SVG.
   - Hover on a segment yellow-tints it
     (`rgba(255, 193, 7, 0.12)` fill,
     `rgba(255, 193, 7, 0.8)` outline) — V1 parity.
   - Click a segment → applies the assignment per US-ENV-9
     criteria 3–4 → 600 ms `pastePulse` animation on the
     target. Stays in `pasting` mode (multi-target paste, V1
     parity).
4. ESC at any non-idle state → returns to `idle`, drops source.
5. Mousedown outside any `<rect>` (and outside the toolbar
   buttons) during `picking` / `pasting` → returns to `idle`.
6. Toolbar buttons (Eyedropper, Paint-Bucket, Undo-last-paste)
   live in the assembly header per §5.7's toolbar.

## 6. Files affected

Current state and the planned change for each:

| File | Current role | Planned change |
|---|---|---|
| `frontend/src/features/envelope/components/AssemblyCanvas.tsx` | HTML+CSS flex canvas with all interaction wiring | **Rewrite.** New shape: thin orchestrator that renders `<AssemblySvgCanvas>` (SVG substrate, §5.1) inside a `<AssemblyCanvasOverlay>` (HTML chrome, §5.2–§5.9). |
| `frontend/src/features/envelope/canvas-constants.ts` | 8 constants including the 3 problem clamps | **Trim.** Keep `BASE_PX_PER_MM` (rename to `BASE_PX_PER_MM_AT_ZOOM_1`), keep `ZOOM_MIN/MAX/STEP`, keep `MIN_CANVAS_WIDTH_PX` (wrapper only). Delete `MIN_LAYER_HEIGHT_PX`, `MIN_SEGMENT_WIDTH_PX`, `MIN_LAYER_WIDTH_PERCENT`. Add `ZOOM_STEPS` discrete list. |
| `frontend/src/features/envelope/lib.ts` | helpers (`materialById`, `materialColor`, `maxLayerWidthMm`, `layerWidthMm`) | **Extend.** Add `totalAssemblyThicknessMm(a)`, `segmentXOffsetMm(layer, segmentIdx)`, `layerYOffsetMm(assembly, layerIdx)` for the SVG geometry. |
| `frontend/src/features/envelope/envelope.css` | CSS for current canvas + chrome | **Restructure.** Drop flex-canvas rules. Add overlay-positioning rules, dimension-column rules, hover-`+` button rules (magenta-circle). Keep modal-related rules unchanged. |
| `frontend/src/features/envelope/components/AssemblyHeader.tsx` | name picker + Total Thickness + Effective R-Value | **Extend.** Add the toolbar cluster (flip x3, eyedropper, paint, undo, zoom cluster) per §5.7 and US-ENV-3 criterion 1. |
| `frontend/src/features/envelope/components/dialogs/LengthDialog.tsx` | LayerHeightModal equivalent | **Unchanged** — still the canonical layer-edit + delete entry point. The new inline dim-column edit is an alternative path; both feed the same parser + patch. |
| `frontend/src/features/envelope/components/dialogs/SegmentDialog.tsx` | SegmentPropertiesModal | **Unchanged** in this PRD's scope. |
| **NEW** `frontend/src/features/envelope/components/AssemblySvgCanvas.tsx` | — | New: the pure SVG substrate. Props: `assembly`, `materials`, `zoom`, `mode` (idle / picking / pasting), `copiedAssignment`. Emits `onSegmentHover`, `onSegmentClick`, `onSegmentEnter` for the overlay to position chrome over. |
| **NEW** `frontend/src/features/envelope/components/AssemblyCanvasOverlay.tsx` | — | New: HTML overlay layer with the dimension column, orientation labels, hover-`+` buttons, edit / delete icons, paste cursor / mode visuals. Absolutely positioned over the SVG. |

## 7. Visual fidelity targets

- **Image #2 (assets/v1-reference-to-scale.png).** The V1
  vaulted-roof rendering. By the end of Phase 02, this view
  must be reproducible at the same proportional fidelity in V2
  given the same `assembly` data.
- **`assets/v1-segment-hover-plus-buttons.png`.** The
  hover-`+` button visual treatment on a real V1 assembly.
  Magenta `#b2087c` circular button + shadcn tooltip
  "Add Segment Before" / "Add Segment After" on the left /
  right edges of the hovered segment, with a magenta dashed
  hover outline on the segment itself.

Visual diff acceptance: side-by-side screenshot of V1 and V2 on
the same assembly should show no perceivable proportion
differences (heights, widths). Color exactness is not required
(V2 will use the project_material `color` field rather than
re-fetching V1's AirTable palette).

## 8. Resolved questions (2026-06-04)

All six questions resolved in the originating chat
2026-06-04. No open questions block Phase 01 or Phase 02
drafting.

- **Q-AB-1: Flip Segments — per-layer or per-assembly?**
  **Resolved: per-assembly.** Mirror every layer
  simultaneously. Matches the "left/right mirror of the whole
  section" mental model; per-layer flip has no clean UX
  surface. See §5.7 criterion 1.

- **Q-AB-2: Dimension extension lines — span the full canvas
  width, or stop at the assembly?**
  **Resolved: stop at the left edge of the assembly.**
  Extension lines run from each dimension cell's right edge to
  the assembly SVG's left edge only — they do not continue
  across the assembly body. Matches the V1 reference image's
  treatment. See §5.5 criterion 3.

- **Q-AB-3: Dimension column units — active display unit only
  or both?**
  **Resolved: active display unit only (V1 parity).** The
  inline editor still accepts any valid length input with a
  unit suffix ("45 mm", "0.1 m", "4 in", "2-1/2\""), so the
  user can type in whichever system regardless of the active
  display unit. See §5.5 criteria 2 and 5; §5.8.

- **Q-AB-4: Per-segment hover icon layout.**
  **Resolved: magenta `+` buttons on left and right inside
  edges of the hovered segment, vertically centered. No
  separate trash or edit icons on hover — clicking the segment
  body opens the modal which carries both Edit and Delete.**
  Reference: Q-AB-4 mockup in the originating chat — a hovered
  wide yellow segment with two `+` circles vertically centered
  near the segment's inside edges, with a thin magenta dashed
  hover-outline on the segment itself. See §5.4 criterion 3
  and §5.9 criterion 4.

- **Q-AB-5: Click segment to open modal vs separate Edit
  icon?**
  **Resolved: click the segment body to open the modal (V1
  parity).** The `+` add buttons sit in the overlay above the
  SVG and capture their own clicks; clicks anywhere else on
  the segment body open `SegmentDialog`. See §5.3 criterion 1.

- **Q-AB-6: Zoom upper bound.**
  **Resolved: 3.0x.** Discrete steps
  `[0.5, 0.75, 1.0, 1.5, 2.0, 3.0]`. At 3.0x and default
  `BASE_PX_PER_MM = 0.18`, a 0.5" (12.7 mm) gypsum layer
  renders at ~6.9 px tall — enough to hover and interact
  reliably. V1 had no zoom; this is purely a V2 ergonomic
  add. See §5.1 criterion 4.

## 9. Non-goals (re-stated from §4 and the originating chat)

- Real CAD drawing controls.
- Non-rectangular polygons.
- Mouse-wheel zoom (CAD-style).
- Drag-edge resize on segments / layers.
- Per-material hatching patterns in v1 (the SVG substrate
  unlocks this; the visual design will land in v1.1+).
- HBJSON, drift, R-value calc, material picker mechanics —
  those user stories own those surfaces and stay where they
  are.

## 10. Cross-references

- `context/user-stories/20-envelope.md` — US-ENV-2..US-ENV-10
  are the behavioral source. This PRD only re-specifies the
  rendering substrate and the direct canvas interactions; it
  does not change the document model, the draft-buffer flow,
  or the modal contents.
- `context/UI_UX.md` — UI conventions (shadcn primitives,
  toast vs dialog, sticky tabs, etc.) are inherited.
- `context/CODING_STANDARDS.md` — backend / frontend code
  conventions that apply to the new component files.
- `research/v1-assembly-builder-reference.md` §9, §11 — V1
  canvas + header behavior; precedent reading for parity
  decisions.
- `planning/archive/assembly-builder-foundation/` — prior 16-phase
  plan, superseded by this folder. Read for context only.
