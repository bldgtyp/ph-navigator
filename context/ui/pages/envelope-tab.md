> Split from `context/UI_UX.md` §2 (Pages — narrative). Cross-cutting design
> intent (§0), common elements incl. the DataTable model (§1 / §1.7), flows
> (§3), and the state-indicator cheatsheet (§4) stay in `../../UI_UX.md` —
> read it alongside this page.

# 2.7 Envelope tab (`/projects/{id}/envelope`)

**(Detailed in US-Builder-Envelope and US-ENV-1..15.)**

The Envelope tab carries the project's opaque-construction data —
walls, floors, roofs, and any layered envelope assembly — plus the
per-segment design-spec / documentation surface, blower-door /
airtightness data, and required project site photos.

## 2.7.1 Sub-tab structure (US-ENV-1)

The Envelope tab has its own **second-level tab bar** below the
project header / project tab bar. As shipped there are **two**
sub-tabs in this order:

```
Assemblies · Materials
```

(`AppSubTabs` in `EnvelopePage.tsx` renders exactly these two links.)

- **Assemblies** (default landing) — visual layer/segment composer
  for each assembly. URL `/envelope/assemblies` (with optional
  `/{assembly_id}` for direct deep-link).
- **Materials** — per-material design-spec status, attached
  product datasheets, attached site photos, and notes. URL
  `/envelope/materials`. The page heading inside is "Project
  Materials"; each row carries a `specification_status` that the
  tab surfaces and filters on.

Two earlier-planned sub-tabs did **not** ship as sub-tabs of this bar:

- **Airtightness** — **PLANNED, not built.** No route, path, or
  component exists in `features/envelope/`. See §2.7.4 for the retained
  design intent.
- **Site Photos** — absorbed (2026-07-18) into the top-level
  **Documentation** tab; the legacy `/envelope/site-photos` URL
  redirects to `/projects/{id}/documentation#envelope`. See §2.7.5 and
  `planning/archive/dated/2026-07-19/documentation-tab/`.

The bare `/envelope` URL redirects to `/envelope/assemblies`, and any
other envelope subpath falls back there.

The locked-version banner (UI/UX §2.4.1) sits above the sub-tab
bar — one banner across both sub-tabs, not duplicated per
sub-tab.

## 2.7.2 Assemblies sub-tab (`/envelope/assemblies`)

**Layout:** assembly-list sidebar (left, ≈260 px, default closed) and
active-assembly canvas/workbench (right). Same shell pattern as the
Apertures tab. The assembly visual is the primary object, not a decorative
preview.

**Sidebar (US-ENV-2):** the shared **element sidebar**
(`frontend/src/shared/ui/element-sidebar/`, one component behind both this and
the Apertures list — see the design-system component inventory). Styled to the
"1A Quiet List" direction (restrained, low-chrome, Linear/Things-like):

```
┌─────────────────────────────┐
│ Assemblies         ⇅  ▣  +  │  ← bold title + ghost Sort/Collapse/Add buttons
├─────────────────────────────┤
│ ───────────  +  ──────────  │  ← add-group divider (Manual mode, list top)
│ ▦ EW-01 Exterior Wall       │  ← type icon + label; selected row = teal fill
│ ▦ EW-02 Party Wall  ✏ ⬡ ⧉ ✕│  ← hover-revealed ghost action cluster
│ ▤ FC-01 Floor Slab          │
│ ⌂ RC-01 Roof                │
└─────────────────────────────┘
```

- **Header:** bold title + three ghost (borderless) icon buttons — Sort (`⇅`),
  Collapse (`▣`), Add (`+`); quiet neutral wash on hover.
- **Sort-order menu** (editors, unlocked version): the `⇅` button opens a radio
  menu (the shared `AppMenu`) with **Alphabetical** (natural sort,
  `WALL-C2 < WALL-C10 < WALL-SE-30a`; not draggable) and **Manual**
  (drag-to-reorder + group affordances). The chosen mode persists per-user via
  `user_sidebar_views` view-state (not the document).
- **Rows** (40 px): leading assembly-type icon (wall/roof/floor/other), label,
  and a hover/`:focus-within`-revealed cluster of borderless ghost actions —
  `Rename (✏) · Change type (⬡) · Duplicate (⧉) · Delete (✕)` — that fades in
  over a gradient scrim so the label reads full-width at rest. No dark tooltip
  (native `title` + `aria-label`). Hover is a neutral wash; **only the selected
  row carries the teal fill**.
- **Manual mode** adds a hover-reveal drag grip (faint at rest) in a reserved
  slot, groups rendered as lightweight uppercase-label + hairline-rule dividers
  (not boxes; collapse chrome is deferred to a future "1B" but the
  `collapsed_group_ids` field is preserved), and an **add-group divider** (a
  centered `+` hairline line at the top of the list). Group assignment is
  **drag-between-groups** — drag a row onto any group or the Ungrouped remainder
  (all share one `DndContext`); an empty group shows a "· · ·" drop placeholder.
  Keyboard users move rows across groups via the dnd-kit keyboard sensor. (The
  old per-row "move to group" select was retired.)
- All editor affordances (sort menu, grip, action cluster, add-group divider) are
  hidden when the version is locked or the visitor is a Viewer — it renders as a
  calm read-only list.
- `prefers-reduced-motion: reduce` disables the fade/translate transitions.

**Right side — active assembly content (US-ENV-3, 4):**

```
┌───────────────────────────────────────────────────────────────────────┐
│  Assembly Details   [WALL-C3 ▾]    Total Thickness: 304.8 mm  ⓘ      │
│                                    Effective U-Value: 0.243 W/m²K  ⓘ  │
│                                    [⇅ Flip Orient] [↔ Flip Layers]    │
│                                    [⨀ Pick] [⬇ Paste] [↶ Undo]   ⋯   │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│                              exterior                                 │
│  ┌──────────┬─────────────────────────────────────────────────────┐  │
│  │  10.000  │ ░░░░░░░░░░░░░░░░ Concrete (Heavily Reinforced) ░░░░│  │  ← layer 1
│  │   in     │                                                     │  │
│  ├──────────┼─────────────────────────────────────────────────────┤  │
│  │  3.000   │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ XPS ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  │  ← layer 2
│  │   in     │                                                     │  │
│  └──────────┴─────────────────────────────────────────────────────┘  │
│                              interior                                 │
│                                                                       │
├───────────────────────────────────────────────────────────────────────┤
│  Color │ Material                       │ Resistivity [R/in]          │
│  ░░░░  │ Concrete (Heavily Reinforced)  │ 0.048                       │
│  ▓▓▓▓  │ XPS                            │ 4.999                       │
└───────────────────────────────────────────────────────────────────────┘
```

(Preserves V1's assembly object model and rough builder structure — see
V1 reference screenshot supplied 2026-05-10. Adjusted in V2 to:
1. **Move HBJSON in/out** to the project header `⋯` overflow
   menu (per Q-ENV-11), out of this assembly-tab toolbar.
2. **Drop the AirTable button** entirely (V2 has no AirTable
   surface).
3. **Drop the "Refresh Materials" overflow item** — the catalog
   manager is reached via the global header "Catalogs ▾"
   dropdown, and drift is surfaced inline per US-ENV-11.)

**Assemblies actions menu (`⋯`, Assemblies sub-tab only):**

- **Download constructions HBJSON** — exports the saved version's assemblies
  as a Honeybee construction library.
- **Download in PHPP format** — exports one CSV per assembly, laid out to mirror
  the PHPP **U-Values** worksheet, bundled into a ZIP
  (`phpp-u-values-<IP|SI>-<versionId>.zip`), in the live IP/SI unit system. An
  assembly that can't be represented in PHPP (>8 layers, >3 / inconsistent
  heat-flow pathways, or incomplete materials) is written as a one-line error
  CSV rather than dropped. When any assembly is blocked, a confirm/cancel modal
  (`PhppExportWarningDialog`) lists them with friendly reasons before the
  download proceeds ("Download anyway" / "Cancel").
- **Upload constructions HBJSON** (editors only).

Both downloads target the **saved version**, not the draft; if an unsaved draft
exists they first warn ("…reads the last committed version…"). Read-only
viewers can still export. See `planning/features/phpp-uvalue-export/`.

**Layer rendering (US-ENV-4 / US-ENV-5):**

- Each layer is a horizontal strip whose height in CSS px equals
  its thickness in mm (1:1 scale; matches V1).
- Left column (35 px): thickness label in active unit (mm or in).
  Hover the label → bold + dashed-border highlight + reveal
  compact `+` buttons at top edge ("Add Layer Above") and bottom edge
  ("Add Layer Below").
- Click the thickness label → opens **Layer Height modal** with
  unit-aware input parsing (`50 mm`, `2 in`, `2-1/2"`,
  `100 + 50`); modal has an inline **Delete Layer** action that
  is disabled when only one layer remains (UI-level guard, V2
  fix vs V1's server-exception + alert).
- Right column: side-by-side segment SVG rectangles, colored
  from each segment's material `color` (`#rrggbb`).
- Segment hover reveals compact `+` buttons at left and right edges
  ("Add Segment Left / Right").
- Click a segment → opens **Segment Properties modal** (US-ENV-6).

**Segment Properties modal (US-ENV-6):**

```
┌──────────────────────────────────────────────────────────┐
│  Segment: Concrete (Heavily Reinforced)              ✕   │
├──────────────────────────────────────────────────────────┤
│  Material                                                │
│  [Concrete (Heavily Reinforced) ▾]  📚 [More fields…]    │
│                                                          │
│  Material Data (read-only)                               │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Name: Concrete (Heavily Reinforced)               │  │
│  │  Category: Concrete                                │  │
│  │  Resistivity: 0.048 R/in                           │  │
│  │  Density: 2400 kg/m³                               │  │
│  │  Specific Heat: 880 J/(kg·K)                       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Segment Width                                           │
│  [  9' 11"           in  ]                               │
│                                                          │
│  ☐ Continuous Insulation (for steel-stud assemblies)    │
│  ☐ Steel Stud Cavity                                    │
│                                                          │
│  Specification Status                                    │
│  [N/A ▾]                                                 │
│                                                          │
│  Notes                                                   │
│  [                                                    ]  │
│                                                          │
│  ────────────────────────────────────────────────────    │
│             [ Delete Segment ]   [ Cancel ] [ Save ]     │
└──────────────────────────────────────────────────────────┘
```

- Material picker: bookshelf flow (US-ENV-7) — pick from
  shared catalog, values copied into the document. The 📚
  badge indicates the segment's material is sourced from the
  catalog; on drift, an additional `↻` overlay appears (US-
  ENV-11).
- Save flushes a single JSON-Patch into the draft buffer (V2
  cleanup vs V1's 4-PATCH chatter, V1 ref §13.14).
- **Delete Segment** at bottom-left, red. Disabled with tooltip
  "A layer must have at least one segment" when only one
  segment in the layer remains.
- All inputs read-only on locked versions / Viewer reads.

**Assembly Toolbar (US-ENV-8 / US-ENV-9):**

- **⇅ Flip Orientation** — swaps the "exterior" / "interior"
  labels; layers untouched.
- **↔ Flip Layers** — reverses the physical layer order;
  orientation enum untouched.
- **⨀ Pick** — enter eyedropper mode; click any segment to
  capture its assignments.
- **⬇ Paste** — auto-revealed after Pick; click target segments
  to apply.
- **↶ Undo** — undo the last paste (capped at 20-step stack;
  cleared on assembly switch).
- **⋯** — assembly-scoped overflow (Rename, Duplicate, Delete).

ESC at any time exits pick / paste mode. Mousedown anywhere
outside a segment also exits.

Design note: keep selected state precise but visually lighter than V1.
Layer orientation and inside/outside labels are core building-science
state; they should be stable, visible, and tied to the flip actions.

**Drift summary banner (US-ENV-11):**

When any segment in the active assembly has drifted from the
catalog (its `material.catalog_origin.catalog_version_id !=
catalog_materials.current_version_id`), a small banner appears
above the canvas:

```
┌───────────────────────────────────────────────────────────────┐
│  ↻ 3 segments drifted from catalog       [ Review all → ]    │
└───────────────────────────────────────────────────────────────┘
```

Click "Review all" → opens the project-wide drift report
(reachable also from project header `⋯ → Catalog drift report`).

## 2.7.3 Materials sub-tab (`/envelope/materials`)

**Purpose:** A QA-prep dashboard for the CPHC. List every unique
material used across all assemblies in the project (auto-
aggregated as the user edits assemblies), with per-material
status: do we have the manufacturer datasheet on file? Has the
design / construction team committed to using this product (spec
status)? And per assembly that uses the material: do we have a
site-installation photo?

**V2 restructure vs V1:** V1 walked **per-segment** rows, so the
same product appeared in the list multiple times (once per use)
with redundant per-use datasheet upload zones. V2 flips to
**per-material primary** — one card per unique product —
because datasheets and spec-status are material-level questions,
not segment-level (Q-ENV-2 model). Site photos are managed once
per material per assembly, so repeated segments of the same
material in one assembly do not create duplicate upload slots.

**Top-of-page summary chip:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Project Materials   24 materials · 18 with datasheets · 21 with    │
│                      site photos for every assembly use              │
└─────────────────────────────────────────────────────────────────────┘
```

**Layout** — one scrollable column of **material cards**, split into
three zones. The top zone holds in-scope materials that are referenced by
at least one segment and have a `specification_status` of `needed`,
`question`, or `complete`. The second zone holds referenced `N/A`
materials and visually recedes as background/reference items. The bottom
zone holds unused project materials with no segment references; these
rows keep their datasheets and notes available until an editor removes
them explicitly.

**Material card** (the building block):

```
┌──────────────────────────────────────────────────────────────────────┐
│  XPS                                                  📚  ↻          │
│  Spray Foam · Conductivity 0.034 W/(m·K) · Density 35 kg/m³          │
├──────────────────────────────────────────────────────────────────────┤
│  [Needed ▾]         [+ Notes]                                  ⋯     │
│                                                                      │
│  Datasheets                                                          │
│  ┌─────────────────────────────────────┐                             │
│  │  ▒▒  PDF  ▒▒                + Add    │   ← Missing state when     │
│  └─────────────────────────────────────┘     empty: missing state    │
│                                                                      │
│  Used in 4 segments:                                                 │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  FLOOR-FC3R · Layer 2 · seg 1   ┌──┬──┬──┐         ⋯           │  │
│  │                                  │📷│📷│ +│                     │  │
│  │                                  └──┴──┴──┘                     │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │  FLOOR-FC6R · Layer 3 · seg 2   ┌──────────────┐    ⋯           │  │
│  │                                  │ Site Photo  │                 │  │
│  │                                  │   Needed    │                 │  │
│  │                                  └──────────────┘                │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │  ROOF-RC5R · Layer 4 · seg 1    ┌──┬──┐             ⋯           │  │
│  │                                  │📷│📷│                          │  │
│  │                                  └──┴──┘                          │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │  WALL-C3 · Layer 2 · seg 1      ┌──────────────┐    ⋯           │  │
│  │                                  │ Site Photo  │                 │  │
│  │                                  │   Needed    │                 │  │
│  │                                  └──────────────┘                │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

**Card regions (top to bottom):**

| Region | Content |
|---|---|
| **Header** | Bold material name (clickable → inline rename). Right side: 📚 Library badge when from catalog; ↻ refresh badge when drifted (click → refresh-from-catalog dialog). Sub-line: category + product data (resistivity in IP, conductivity in SI; respects active unit system). |
| **QA bar** | Specification-status `<Select>` (states follow §1.8). `[+ Notes]` opens an inline notes editor. `⋯` overflow: "Edit material values…" (affects all uses), "Refresh from catalog…", "Delete material" (only enabled when no segments reference it). |
| **Datasheets** | Drag-and-drop zone for one or more datasheets (PDFs / images). Missing state follows the evidence/status grammar in §1.8; disabled when status = N/A. **One zone per material**, not per use (V2 cleanup vs V1's per-segment redundancy). |
| **"Used in N segments"** | Assembly-level sub-rows grouped by material + assembly. Each row shows the assembly path plus a compact segment summary (`layer N, segments 1, 3, 5`) and one site-photo drag-and-drop zone for that material in that assembly. Existing segment-level photo refs are still reconciled through the same asset attachment flow. |

**Card sort order:**

1. **Pending QA cards first** — `specification_status` of
   `needed` or `question` — within that group sorted by
   `naturalSortCompare(name)`.
2. **Complete cards** — `specification_status == 'complete'`.
3. **N/A cards** — referenced materials with
   `specification_status == 'na'`, in the lower muted zone.
4. **Unused materials** — orphan `project_materials` rows with no segment
   references, in the bottom section. Editors see a row-level `X` action
   that sends `remove_project_material`; the backend rejects the command
   if a segment starts referencing that material before the delete lands.

**Drag-and-drop upload behavior** (for both datasheet zones and
assembly/material site-photo zones):

- Drop zone activates on dragover (blue dashed border).
- Multiple files supported; each uploads individually. On
  per-file failure, a Sonner error toast lists the failed
  filenames (V2 cleanup vs V1's `console.error` + per-file
  `alert()`). Successful uploads append to the relevant array
  via the generic asset upload flow plus a draft JSON-Patch attach.
- Loading overlay during upload.

**Click a thumbnail → ImageFullViewModal:**

- Single full-size image OR PDF iframe view (`#toolbar=0`
  hides the browser toolbar).
- "Delete Image" / "Delete Datasheet" button confirms via
  the Radix-based `ModalDialog` (replaces V1 `window.confirm`) and detaches
  the asset from the appropriate array in the active draft
  (project_material's datasheet array OR segment's photo array).
  The uploaded asset remains available to older saved versions
  and is only purged by the backend GC path when unreferenced.

**Click the material name → inline rename** (and the QA bar's
`⋯ → "Edit material values…"` opens the full-field editor in an
expander below the QA bar). The full editor shows a banner when
shared: *"Editing applies to all 4 segments using this
material. To override values for one segment only, use the
canvas's segment modal → Detach to a new material."*

**Visibility rule** (V1-aligned, applied at card level):

- Viewers see only material cards whose
  `specification_status != 'na'`. The "Unused materials"
  section is also hidden from Viewers. The Materials
  tab is most useful as a "what's pending / what's documented"
  view; n/a cards are noise for external readers.

**Locked-version rendering:**

- Spec-status `<Select>` disabled.
- Drag-and-drop hidden; thumbnails still viewable.
- Per-image / per-datasheet delete hidden.
- Inline editors disabled.
- Material cards still render (so a Viewer / locked-
  submit reader can see the documented set).

**Empty state** — when a brand-new project has no materials
picked yet:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│              No materials used yet for this project.            │
│                                                                 │
│       Pick materials in the Assemblies tab to see them here.    │
│                                                                 │
│                  [Open Assemblies tab →]                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 2.7.4 Airtightness sub-tab (`/envelope/airtightness`)

**PLANNED — not built.** There is no `/envelope/airtightness` route,
no `airtightness` subpath, and no component for it in
`features/envelope/`; the shipped sub-tab bar carries only Assemblies
and Materials (§2.7.1). The sketch below is retained design intent from
US-ENV-14, not a description of shipped UI. Reaching the old URL simply
falls back to `/envelope/assemblies`.

**(Design intent, US-ENV-14 — unbuilt.)**

Project-level airtightness page. Shareable with the construction
team via normal project URLs. Auto-extracts envelope volume + envelope
area + iCFA from the most recent HBJSON upload (cached on the
`project_hbjson_files` row at upload time, never recomputed on
page load); accepts the contractor's blower-door test inputs;
computes and displays ACH50, n50, and cfm50/sf-envelope.

**Layout sketch:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Airtightness                                                       │
├─────────────────────────────────────────────────────────────────────┤
│  Geometry source: Round 1 model.hbjson (uploaded 2026-04-12)        │
│  ⚠ A newer HBJSON has been uploaded — pinned source still in use.   │
│  [ Re-pin to current ]   [ Change source ▾ ]                        │
│                                                                     │
│  Volume: 1,234 m³  ·  Envelope area: 567 m²  ·  iCFA: 234 m²        │
├─────────────────────────────────────────────────────────────────────┤
│  Test inputs                                                        │
│  Test method         [ASTM E779 @ 50 Pa ▾]                          │
│  Result (cfm50)      [____600____]                                  │
│  Test date           [2026-04-30]                                   │
│  Tester              [_______________________]   Cert [_______]     │
│  Target ACH50        [____0.6____]   Source [Phius CORE 2024 ▾]    │
│  Notes               [________________________________________]     │
├─────────────────────────────────────────────────────────────────────┤
│  Computed                                                           │
│  ACH50: 0.49   ✓ Passes (target 0.6)                                │
│  n50:   0.49                                                        │
│  cfm50/sf-envelope: 0.022                                           │
└─────────────────────────────────────────────────────────────────────┘
```

**Banner above the page (always present):** *"Airtightness data
is project-level — not tied to a specific version of the energy
model. Switching versions will not change what's shown here."*

**Editor / public-read behavior:** editors see editable inputs
regardless of version-lock state (the data is project-level,
not version-locked). Viewers see the page read-only —
but they DO see the page, since contractor-share is the primary
use case per Ed's framing.

## 2.7.5 Site Photos sub-tab (`/envelope/site-photos`)

**ABSORBED (2026-07-18):** this sub-tab is not built as its own surface.
Its design became the Envelope section of the top-level **Documentation**
tab (`planning/archive/dated/2026-07-19/documentation-tab/`); the URL
redirects to `/projects/{id}/documentation#envelope`. Sketch below retained
as the carried-over section design.

**(Detailed in US-ENV-15.)**

Contractor-facing reorganization of the same segment-stored site
photos that the Materials sub-tab manages — grouped by
**assembly type** (Walls / Floors / Roofs / Other) instead of by
material. Same data, different presentation. Useful for sharing
with the trades team via the normal project URL: "all the wall photos in
one place," etc.

**Layout sketch:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Site Photos                                                        │
├─────────────────────────────────────────────────────────────────────┤
│  Walls (3 assemblies, 24 photos)                                    │
├─────────────────────────────────────────────────────────────────────┤
│  WALL-C3                                                            │
│    Layer 1 · seg 1  [📷 📷 +]                                       │
│    Layer 2 · seg 1  [Site Photo Needed]                             │
│    Layer 3 · seg 1  [📷 +]                                          │
│  WALL-SE-30a                                                        │
│    ...                                                              │
├─────────────────────────────────────────────────────────────────────┤
│  Floors (2 assemblies, 8 photos)                                    │
│  ...                                                                │
├─────────────────────────────────────────────────────────────────────┤
│  Roofs (1 assembly, 5 photos)                                       │
│  ...                                                                │
└─────────────────────────────────────────────────────────────────────┘
```

- **No new backend** in v1 — same data as the Materials sub-tab, just
  re-grouped.
- **Assembly type** comes from a new `assembly.type` field
  (auto-detected from name on create per Q-ENV-15.1 lean;
  user-editable thereafter).
- **Editable here too** — drag-and-drop upload writes to the
  same `segment.photo_asset_ids[]` arrays as the Materials sub-tab.
- **Viewers** see this page populated and organized
  for trades-crew use — the primary motivation for the tab's
  existence.
