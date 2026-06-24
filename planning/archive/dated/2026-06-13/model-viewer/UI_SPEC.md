---
DATE: 2026-06-12
TIME: -
STATUS: Accepted 2026-06-12 — supersedes context/UI_UX.md §2.9
  (which now points here). Companion to PRD.md §4 deltas.
AUTHOR: Claude (for Ed)
SCOPE: UI definition for the Model tab — layout, components,
  interactions, visual language, states, keyboard map. Written for
  implementation agents; supersedes context/UI_UX.md §2.9 placeholder
  once accepted.
RELATED:
  - planning/archive/model-viewer/PRD.md
  - context/user-stories/40-model-viewer.md (US-VIEW-6 field configs)
  - context/UI_UX.md §1 (BLDGTYP token system, state indicators)
  - research/ph-nav-v1-screenshots/HBJSON-viewer/ (V1 precedent —
    composition NOT to be copied; behavior reference only)
---

# Model Viewer — UI Specification

## 0. Design intent

One sentence: **it should feel like inspecting a beautiful physical
model on a table, with smart labels — not like operating a CAD
program.**

Principles, in priority order:

1. **Zero-instruction viewing.** An owner with a project URL can
   orbit, click, and read. No tool must be armed before clicking
   works. Nothing important hides behind icon-only buttons.
2. **Domain language, not viewer jargon.** "Spaces", "Floor Areas",
   "Ventilation" — never "viz state", "color-by mode", "geometry".
3. **Quadrant layout, floating chrome.** The canvas is full-bleed
   under the project header. All controls float over it in fixed
   corners; nothing boxes the model into a panel.
4. **Calm visuals.** Soft light, contact shadows, faint fading grid,
   muted edge lines. Color appears only when it means something
   (themes, selection, supply/exhaust). BLDGTYP tokens throughout —
   selection uses the brand `--highlight` family systematically
   (D-14); no MUI blue, no off-palette hexes.
5. **Fluid motion.** Damped orbit, eased camera transitions
   (fit / focus), panels that slide rather than pop. Animations
   ≤250 ms; never block input.

## 1. Layout — the quadrant map

```
┌────────────────────────────────────────────────────────────────────────┐
│ Project header (existing chrome: name · version ▾ · save · IP/SI)      │
│ Tabs: Status | Windows | Envelope | Equipment | [Model]                │
├────────────────────────────────────────────────────────────────────────┤
│┌─────────────────┐    ┌─────────────────────────────┐   ┌────────────┐ │
││ ▦ Round 2 model │    │ Building Spaces Floor-Areas │   │(inspector  │ │
││   Apr 12 ▾      │    │ Site&Sun Ventilation HotW.  │   │ slides in  │ │
│└─────────────────┘    │  ·  Color: Boundary ▾       │   │ from right │ │
│  file chip (TL)       └─────────────────────────────┘   │ when sth   │ │
│                          lens bar + theme (TC)          │ selected)  │ │
│                                                         │            │ │
│                                                         │            │ │
│                        ╭───────────────╮                │            │ │
│                        │   3D MODEL    │                │            │ │
│                        │  (full-bleed  │                │            │ │
│                        │    canvas)    │                │            │ │
│                        ╰───────────────╯                │            │ │
│                                                         └────────────┘ │
│┌──────────────────┐                            ┌──────────────────────┐│
││ BOUNDARY         │                            │      ◇ gizmo         ││
││ ■ Outdoors  142  │                            │  [⤢ Fit] [⌂] [📏]    ││
││ ■ Ground     18  │                            └──────────────────────┘│
││ ■ Adiabatic  64  │                              camera + measure (BR) │
││ ■ Surface    96  │                                                    │
│└──────────────────┘                                                    │
│  legend card (BL)                                                      │
└────────────────────────────────────────────────────────────────────────┘
```

- **Top-left — file chip** (§2): which model you're looking at.
- **Top-center — lens bar + theme menu** (§3): what you see and how
  it's colored.
- **Bottom-left — legend card** (§4): what the colors mean. Also
  hosts the scene-info popover trigger.
- **Bottom-right — camera cluster + measure toggle** (§5, §7):
  orientation gizmo, Fit, Home, Measure.
- **Right — inspector panel** (§6): what you clicked.

Responsive: below ~1100 px canvas width, lens labels collapse to
icons + tooltips; the inspector overlays the canvas instead of
sharing width. Mobile is a non-goal (PRD §3) but nothing may break at
narrow widths.

## 2. File chip + file popover (US-VIEW-1)

**Chip** (top-left, floating): `▦ Round 2 model · Apr 12 ▾` —
elevated pill, BLDGTYP surface token, truncates long names at ~28 ch.
Read-only visitors see the same chip.

**Popover** (click chip; width ~360 px):

```
┌──────────────────────────────────────────┐
│ ┌──────────────────────────────────────┐ │
│ │   ⤓  Drop a .hbjson file here        │ │   ← editors only
│ │      or  [browse]                    │ │
│ └──────────────────────────────────────┘ │
│ ──────────────────────────────────────── │
│ ✓ Round 2 model                       ⋯  │   ← active row, check +
│   14.2 MB · 2 weeks ago · Ed             │     subtle bg highlight
│   "after slab redesign"                  │   ← notes, italic muted
│   Final cert model                    ⋯  │
│   18.9 MB · 3 days ago · John            │
│   Round 1 model                       ⋯  │
│   12.1 MB · Mar 2 · Ed                   │
│ ──────────────────────────────────────── │
│ ↻ Refresh list                           │
└──────────────────────────────────────────┘
```

The newest file's row carries a quiet `(Latest)` annotation after
its name (V1 parity — the active checkmark and "latest" are
different facts and can disagree when viewing an older upload).

Rows whose backend `extraction_status` is `failed` carry a quiet
destructive-token **"Failed to parse"** badge (tooltip =
`extraction_error`) — the file uploaded fine but honeybee can't
read it, so picking it will land on the permanent error state, not
a rendered model (D-16).

Behavior is exactly US-VIEW-1 criteria 1–14 (sort newest-first,
inline rename, notes editor, delete confirm w/ airtightness-pin
warning, content-hash dedup with "[Switch]" toast, 100 MB cap
(D-17), thin
progress bar across the drop zone during upload, new upload becomes
active). `⋯` menu: Rename · Edit notes · Download · Delete (editors;
viewers see Download only).

Picking a file: popover closes, viewer cross-fades to the loading
state (§8), URL updates `?file={id}`.

## 3. Lens bar + theme menu (US-VIEW-3/5, recomposed per PRD §4.1)

**Lens bar** (top-center, floating): a segmented control, one segment
always active. Labels with small lucide-style icons:

`[⌂ Building] [▢ Spaces] [▤ Floor Areas] [☀ Site & Sun] [⇄ Ventilation] [〰 Hot Water]`

- Click = switch lens. Smooth ≤200 ms crossfade between lens
  geometry sets (opacity fade, no camera move).
- Active segment: filled with the accent surface token; inactive:
  ghost. Keyboard: `1`–`6`.
- Lenses with no content in the loaded file (e.g. no hot-water
  piping in the HBJSON) render the segment disabled with tooltip
  "No hot-water piping in this model".

**Theme menu** — appears attached to the right end of the lens bar
*only when the active lens has themes* (Building, Spaces, Floor
Areas): `Color: Boundary ▾`. Dropdown lists that lens's themes (PRD
§4.1 table) with a check on the active one. Switching themes
recolors in place (no lens change, no camera move) and updates the
legend. Default per lens: Building→Shaded, Spaces→Shaded,
Floor Areas→Weighting Factor.

**Per-lens scene composition** (same as US-VIEW-3 crit. 4):

| Lens | Shows | Ghost context | Selectable |
|---|---|---|---|
| Building | faces + apertures, edges | — | faces, apertures |
| Spaces | space volumes (translucent) | building edges | spaces |
| Floor Areas | floor segments | building edges | floor segments |
| Site & Sun | building + shades (grey) + dashed sun path + compass | — | faces, apertures (shades not selectable, Q-VIEW-3) |
| Ventilation | ducts: supply blue / exhaust red, world-unit thickness | building edges | duct segments |
| Hot Water | piping: distribution + recirc (distinct line styles) | building edges | pipe segments |

"Ghost context" = building edge wireframe at low opacity so interior
lenses keep architectural orientation.

## 4. Legend card (US-VIEW-5)

Bottom-left floating card. Visible when the active lens+theme has a
legend (any non-Shaded theme; always for Ventilation / Hot Water as
a 2-row mini-key).

```
┌─────────────────────────┐
│ BOUNDARY            ⌃   │   ← theme name; collapse chevron
│ ■ Outdoors        142   │
│ ■ Ground           18   │
│ ■ Adiabatic        64   │
│ ■ Surface          96   │
└─────────────────────────┘
```

- **Counts** per bucket (new vs. V1) — computed client-side at theme
  application; cheap and high QA value ("why are 64 faces
  adiabatic?").
- Static themes use the fixed color maps; Construction / Window
  Construction themes build the dynamic map via the preserved cyrb53
  + golden-ratio hash (US-VIEW-5 crit. 6) and list construction
  names sorted alphabetically, scrolling internally past ~10 rows.
- Collapsible to its title bar; collapsed state remembered per
  session.
- Rows are **not** clickable in MVP (Q-VIEW-7 deferred) — but build
  each row as a real button rendered inert, so NEW-VIEW-2
  (legend-as-filter, near-priority post-MVP) is a behavior change,
  not a rebuild.

## 5. Camera + navigation (US-VIEW-2)

- **Z-up, perspective, FOV 45** — non-negotiable Rhino/honeybee
  convention. Initial camera `[-25, 40, 30]` looking at origin,
  then an immediate **fit-to-model** on first load (drei `<Bounds>`)
  — V1's fixed start position is a papercut on off-origin models.
- **OrbitControls** with damping; rotate 0.9 / zoom 3.0 speeds as
  V1-calibrated starting values. Right-drag or two-finger pan.
- **Bottom-right cluster** (vertical, floating):
  - **Orientation gizmo** (drei `<GizmoHelper>` + viewport cube,
    small, monochrome until hovered). Clicking a face snaps the
    camera to that orthographic-ish view with an eased transition.
  - **⤢ Fit** — frame the whole model (keyboard `F`).
  - **⌂ Home** — default 3/4 aerial view of the model (keyboard `H`).
  - **📏 Measure** — toggle, see §7 (keyboard `M`).
- **Double-click an object** — eased camera focus on that object
  (zoom-to, ~400 ms). Esc or Fit recovers.
- Scene styling: off-white background with a barely-there vertical
  gradient; drei `<ContactShadows>` under the model (soft, not the
  V1 hard PCF shadow plane); drei `<Grid>` infinite fading grid at
  z=0, very low contrast; SMAA only (no SSAO — V1 verdict stands,
  US-VIEW-2 crit. 7).

## 6. Selection + inspector (US-VIEW-4/6, recomposed per PRD §4.2)

**Hover** (always live, except during Measure): the object under the
cursor gets a subtle emissive/brightness lift + a small cursor-tether
tooltip with its display name (e.g. `Wall · N00_POOL_CELLAR`). Hover
never recolors neighbors and never flickers (raycast throttled to
frame rate).

**Click** (≤5 px from pointer-down — drags orbit, clicks select):
- Object gets the **selection treatment**: outline + slight emissive
  lift in the brand `--highlight` token (#E23489, theme-invariant —
  D-14). Hover uses a softer treatment from the same family
  (`--highlight-light` / reduced opacity) so hover and selected read
  as intensities of one idea. Tokens are resolved at viewer mount
  via `getComputedStyle` (Three materials can't read CSS vars);
  #E23489 is the literal fallback.
- **Inspector panel** slides in from the right (~320 px, 200 ms).
  Canvas keeps rendering full-bleed behind it.
- Click empty space or press `Esc` → deselect, panel slides out.

**Inspector content** — header + grouped rows, exactly the US-VIEW-6
field-config roster (faceMesh "Opaque Surface", aperture "Window",
space "Interior Space", floor segment "Interior Floor", pipe with all
Q-VIEW-4 fields, duct with Supply/Exhaust type):

```
┌──────────────────────────────┐
│ OPAQUE SURFACE          ✕    │
│ N00_POOL_CELLAR…Face1   ⧉   │  ← display name; copy-ID button
│──────────────────────────────│
│ Face Type          Wall      │
│ Boundary           Ground    │
│ Area               603.8 ft² │
│──────────────────────────────│
│ CONSTRUCTION                 │
│ Name           WALL - C3     │
│ U-Factor ⓘ 0.041 Btu/hr·ft²F │
│ U-Value ⓘ  0.043 Btu/hr·ft²F │
│ R-Factor ⓘ 24.39 hr·ft²F/Btu │
│ R-Value ⓘ  23.26 hr·ft²F/Btu │
│──────────────────────────────│
│ [ ⊙ Zoom to ]                │
└──────────────────────────────┘
```

- U/R rows follow honeybee-energy terminology **verbatim** (D-12):
  "U-Factor"/"R-Factor" = air films INCLUDED (primary rows);
  "U-Value"/"R-Value" = layers only, films excluded. Windows show
  U-Factor + U-Value (no R rows, V1 parity). Tooltips state the
  film convention and the honeybee field name.
- All values respect the global IP/SI toggle live (toggling re-renders
  the open panel). Missing values render `--`. (Deliberate change:
  V1 *hid* empty rows; `--` makes missing model data visible, which
  is the QA-friendlier behavior. US-VIEW-6 crit. 9's "V1 parity"
  note mischaracterized V1 — see parity audit #13.)
- **Unknown-type fallback** (V1 parity, audit #12): if a selected
  object's type has no field config, the inspector still renders a
  generic card — header "Element", the type string, the identifier +
  copy button — never an empty panel.
- Internal scroll; copy-ID writes the HBJSON identifier to clipboard
  with a tick confirmation.
- Selection survives theme switches; switching **lens** clears it
  (the object may no longer be shown).

## 7. Measure mode (US-VIEW-4)

Entered via the 📏 toggle or `M`. This is the only mode in the app.

- Entering: cursor becomes crosshair; a quiet hint chip appears
  bottom-center: *"Click two points to measure · Esc to exit"*;
  selection/hover suspend; the toggle button shows active state.
- Pointer-move: snap marker (small dot) on the nearest face-corner
  vertex within ~20 px screen distance.
- Two clicks = one dimension line: thin line + pill label at
  midpoint with the distance in the active unit system (`3.45 m` /
  `11' - 4"` style via the existing length formatters). Lines
  accumulate while the mode is active.
- Labels are DOM (drei `<Html>` scoped to the canvas wrapper — NOT
  document.body; V1 ref §14.8 leak), pointer-events none.
- Exit (`Esc`, toggle, or lens switch): clears all dimension lines
  and the snap marker.

## 8. Load, empty, and error states

**Empty (no files yet):** centered card on the bare scene
(grid + horizon still visible — the room is lit, the table is empty):

```
        ┌─────────────────────────────────┐
        │        ⤓                        │
        │   No model uploaded yet         │
        │   Drop a .hbjson file here      │
        │   or [browse] to upload         │
        └─────────────────────────────────┘
```
Viewers (logged-out) see "No model has been uploaded to this project
yet." without the drop zone.

**Loading:** non-blocking progress chip, top-center under the lens
bar: `◌ Downloading model · 14 MB` → `◌ Building scene…`. Previous
model dims to 30% opacity during a file switch rather than vanishing.
Everything else (tabs, file popover) stays interactive (Q-VIEW-5
intent; D-06 surface).

**Loaded:** chip flashes the summary once — `✓ 412 surfaces · 38
spaces · 3 air boundaries not rendered` — then collapses. The same
summary lives permanently in a small `ⓘ` scene-info popover on the
legend-card title bar (counts, file name, upload date, schema
version, extraction warnings).

**Error:** chip turns destructive-token. Two kinds (D-16):
**transient** (network/R2): `⚠ Couldn't load model · [Retry]`;
**permanent** (invalid HBJSON, schema-version mismatch): `⚠ This
file couldn't be parsed` with the cause as a second line (e.g.
"HBJSON schema 2.1.0 is newer than this app supports") and NO Retry
button — retrying a permanently broken file is a dead end. Backend
`extraction_warnings` listed in the scene-info popover, never as
blocking dialogs. No `alert()` anywhere.

## 9. Keyboard map

| Key | Action |
|---|---|
| `1`–`6` | Switch lens |
| `F` | Fit model to view |
| `H` | Home view |
| `M` | Toggle Measure |
| `Esc` | Exit Measure → clear selection → close popovers (in that order) |
| `⌘/Ctrl+C` | With selection: copy object ID |

All floating controls are real buttons: focusable, labeled
(aria-label = visible label or tooltip text), tooltips on hover AND
focus. The canvas itself has a short aria description naming the
active file and lens.

## 10. What deliberately did NOT carry over from V1

- Bottom icon-only toolbars (two rows of unlabeled glyphs).
- "Select" as an armable tool.
- ColorBy as a separate mode with an MUI submenu.
- Hardcoded magenta selection + default-blue accents (V2 uses the
  branded `--highlight` token family — same hue neighborhood,
  applied systematically per D-14).
- Blocking modal loading dialog; `alert()` errors.
- CSS2D labels attached to `document.body`.
- Fixed camera start with no fit-to-model.
- Hard shadow plane + high-contrast dual grid.
