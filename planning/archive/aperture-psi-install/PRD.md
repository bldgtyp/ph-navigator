# PRD (draft) — Aperture Psi-Install

```
DATE:    2026-08-03
TIME:    10:48
STATUS:  Draft for discussion — data-model direction proposed; UI/UX options laid
         out with a recommendation. Nothing here is decided until Ed signs off.
AUTHOR:  Ed + Claude
SCOPE:   PHN data model + UI for per-edge window install psi-values, their
         defaults, mulled-edge handling, evidence PDFs, and the route-3 export
         contract. GH-client change is noted but implemented in its own repo.
RELATED: README.md, research.md (all code citations live there), STATUS.md
```

## 1. Problem

Every installed window edge carries a linear thermal bridge (Ψ-install, W/m·K)
that PHPP/WUFI account per meter of install perimeter. Today PHN stores the
value only on the shared frame product row, nobody ever enters it, route 3
emits `null`, and the GH client fabricates 0.04 W/mK. The fabricated constant
is wrong twice over: it is not project data, and it is not even the right
default for Phius (sanctioned default ≈ 0.052 W/mK; see research.md §1).

### The two personas

- **Phius project**: uses the program default for nearly everything. Maybe two
  or three mounting conditions on the whole job (default / mid-wall /
  mid-wall over-insulated). Wants this feature to be **invisible** — correct
  defaults with zero clicks, a visible override only where needed.
- **PHI retrofit (EnerPHit)**: nearly every install condition is a custom
  Flixo-calculated value with a PDF to justify it. Wants **fast bulk
  assignment** of a small library of calculated details to many aperture
  edges, plus evidence tracking per detail.

Both personas share one shape: a **small library of named install conditions**
(3–10 per project) applied to **many aperture edges**. That is the same shape
as the proven AirTable workflow (named psi-install records linked per edge —
research.md §4.2) and the same shape as heat-pump types / thermal-bridge
types elsewhere in PHN.

## 2. Design principles

1. **Out of the way by default.** A project with zero explicit assignments is
   valid and correct: every perimeter edge inherits the project default; every
   interior (mulled) edge is 0. No red flags, no required setup.
2. **Types, not values.** Users assign a named *install type* (a row in a
   project table) to edges — never type raw numbers onto edges. The number,
   its justification PDF, and its status live once, on the type row.
3. **Derived beats stored.** Perimeter-vs-interior edge classification is a
   pure function of the aperture grid. Mulled interior edges are *always* Ψ=0
   (a Phius rule, §1.4.4.6) — computed, never user-set, impossible to get
   wrong.
4. **These are not "Thermal Bridges" rows.** The existing TB table is
   construction TBs input into WUFI's TB list. Install psi flows through the
   *window types* instead (WUFI `Frame_Psi_*`). Separate table, similar
   anatomy.

## 3. Data model (proposed)

### 3.1 New project table: `aperture_install_types`

Modeled on `thermal_bridges` (typed columns + custom fields + status +
attachments). Row id prefix `apit_`.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `apit_*` | |
| `name` | str | e.g. "Default", "Head @ brick lintel", "Sill @ over-insulated reveal" |
| `psi_w_mk` | float ≥ 0 | unit-configured column (W/m·K ↔ Btu/hr·ft·°F), like TB `psi_value_w_mk` |
| `source` | option | `program_default` / `phius_mid_wall` / `phius_mid_wall_overinsulated` / `calculated` / `manufacturer` — drives whether evidence is required |
| `pdf_report_asset_ids` | asset list | Flixo PDF, PDF-only, exactly the TB recipe (`assets/registry.py` entry + reachability guard) |
| `status` | option | the shared specification-status field |
| `notes` | str | |

**Seeded rows** (per project, at document creation / migration): one built-in
**"Default"** row whose `psi_w_mk` is program-aware — 0.052 (Phius) or 0.04
(PHI). Optionally also seed the two Phius mid-wall tiers on Phius projects so
the common cases are one pick away. Seeding follows the TB
`_built_in_seeds.py` pattern; the Default row is referenced implicitly (see
3.2), so it should be delete-protected (required `DependentLink`-style guard
or simply non-deletable built-in).

*Open question (Ed):* should the Default row's value be editable per project
(recommended: yes — it's just a row), and should changing the project's
program (PHI↔Phius) re-seed or warn?

### 3.2 Assignment: per element-side, nullable, on the aperture element

Extend `ApertureElement` with a 4-sided slot object exactly parallel to
`ApertureElementFrames`:

```python
class ApertureElementInstalls(BaseModel):
    top: str | None      # apit_* or None
    right: str | None
    bottom: str | None
    left: str | None
```

Resolution order for the **effective** Ψ-install of an edge:

1. Edge is **interior** (abuts a sibling element in the grid) → **0**, always,
   not assignable, not stored.
2. Slot has an `apit_*` id → that type's `psi_w_mk`.
3. Slot is `None` → the project **Default** row's value.

Nothing is denormalized; effective values are computed server-side (same
place the U-value report builds `ApertureEdgeBreakdown`).

**Edge classification helper** (new, both sides): pure function over
`row_heights_mm`/`column_widths_mm` + element spans → for each element-side,
`perimeter | interior`. Backend for validation/export, frontend for the UI.
(The void-element wrinkle: an edge abutting a `void` element — a real hole in
the unit — should count as *perimeter*? Or as its own category? **Open
question**; default proposal: edges abutting `void` elements are perimeter,
since a void panel means "opening in the sash layout", but flag it in review.)

### 3.3 New aperture command

`setElementInstall { aperture_id, element_id, side, install_type_id | null }`
— one new entry in the command union + handler + TS mirror, following
`PickFrame` exactly. Plus a bulk variant (see UX): `setInstallForSelection`
applying one type to all perimeter edges of the selected elements/apertures —
matches how paint-bucket batches picks today.

### 3.4 Deletion semantics

Deleting an `apit_*` row that is referenced by any element slot → blocked
(409, like required `DependentLink`) or cleared-to-default with a preview;
**recommendation: block**, matching heat-pump required links, since silently
reverting a calculated PHI value to the default is a data-integrity hazard.

### 3.5 Schema & migration

Document schema v9 → v10: new table envelope + `ApertureElementInstalls`
(default all-None). Full checklist in research.md §5.3. Old documents migrate
losslessly (empty table + a seeded Default row + null slots ⇒ behavior
identical to today except route 3 stops emitting null).

## 4. Export contract (route 3)

- Emit an `installs` block per element-side alongside the existing `frames`
  block: the **effective** value (already resolved: default inheritance and
  interior-edge zeros applied), e.g.
  `elements[n].frames.top.psi_install_w_mk = 0.052` **and/or** a parallel
  `elements[n].installs.top = {type_name, psi_install_w_mk, source}`.
  Recommendation: **write the effective number into the existing
  `frame_type.psi_install_w_mk` field** (the client already reads it — zero
  client change for values to start flowing) **and** add the richer
  `installs` block for provenance.
- ⚠️ **Client dedup hazard** (research.md §4.2): the GH client dedupes
  `PhWindowFrameElement` by frame-type *name*, so per-edge values that vary by
  location will collapse. Filling `frame_type.psi_install_w_mk` per-side with
  *different* numbers under the *same* frame name is exactly the breaking
  case. The GH client must apply psi-install per edge after dedup (or key the
  dedup on name+psi). **This is a required, coordinated change in
  honeybee_grasshopper_ph_plus** — small (the per-side loop already exists at
  `create_new_hbph_frames`), but it must land before PHN emits varying values.
- Downstream of the client, nothing changes: honeybee_ph → PHX → WUFI/PHPP/
  METr already carry per-edge psi faithfully (research.md §3), including
  Ψ=0 mulled edges.

## 5. UI / UX

### 5.1 Where things live — the layered proposal

Three layers, cheapest interaction first:

**Layer 1 — see it (always on, zero new events).**
- The element card's per-side `FrameRow` has an empty third metric cell today
  (`FrameRow.tsx:76-78`). Put the **effective Ψ-install** there: muted text
  when inherited from Default, normal weight when explicitly assigned, `0
  (mull)` on interior edges. Header row gains a "Ψ-inst" column label.
- The U-Values report panel already shows per-edge Ψ-install — it starts
  showing real numbers for free.
- This alone makes the feature discoverable without touching the canvas.

**Layer 2 — manage the library (a table page, standard recipe).**
- The `aperture_install_types` table gets a home as a **fifth sub-tab on the
  Apertures page**: `Apertures | Glazings | Frames | Installs | U-Values`.
  It is a bog-standard `useSliceTableController` + DataTable page (the
  ThermalBridgesPage recipe verbatim: unit column, PDF attachment column,
  status column, `?focus=` deep links). Phius users may never open it; PHI
  users live here while building their Flixo library.
- Alternative considered: hang it under the Thermal Bridges page as a second
  table. **Rejected** — Ed's framing is right that these are aperture-domain
  objects with a different downstream path (window types, not the WUFI TB
  list); co-locating with apertures keeps the mental model clean.

**Layer 3 — assign (the modal with the key view). This is the recommendation
for the core interaction.**

A per-aperture **"Installs" modal**, opened from a small button in the
aperture header row (next to the existing per-aperture actions — one new
button, not a new canvas event):

```
┌─ Window Installs — "S15  Living Room South" ────────────────────────┐
│                                                                     │
│   ┌────────── key view (read-only SVG) ─────────┐   Install types   │
│   │   ┌───────┬───────┐  ← top edges tinted     │   ● Default 0.052 │
│   │   │  C1R1 │ C2R1  │    by assigned type     │   ● Head@lintel   │
│   │   ├───────┼───────┤  ← interior mull edges  │     0.021 ▣ PDF   │
│   │   │  C1R2 │ C2R2  │    hatched, "0 (mull)"  │   ● Sill@insul    │
│   │   └───────┴───────┘                         │     0.018 ▣ PDF   │
│   └──────────────────────────────────────────────┘   [+ new type…]  │
│                                                                     │
│   Click an edge (or drag across several) → assign selected type     │
│   [Apply Default to all]   [Copy assignments to… ▾]        [Done]   │
└─────────────────────────────────────────────────────────────────────┘
```

- **Key view** = a read-only `ApertureSvgCanvas` instance; the pure
  `elementRegionsMm` geometry already yields the per-side rects to tint.
  Interior (mulled) edges render hatched/muted and are not clickable —
  the Phius "0 at mulled sides" rule is *visible*, not just applied.
  Research confirmed this is cheap: the SVG canvas and geometry are pure and
  reusable, and per-side hit rects already exist as a pattern.
- Interaction model is **"pick type, then paint edges"** (like the existing
  paint-bucket mode, but scoped inside the modal): select a type in the
  right-hand legend, click perimeter edges to apply; click again to clear back
  to Default. No per-edge dropdowns, no forms.
- **Bulk affordances** (the PHI-retrofit workflow):
  - "Apply <type> to all perimeter edges" of this aperture.
  - "Copy assignments to…" other aperture types (multi-select list) — the
    retrofit user sets up one typical unit and stamps the rest.
  - Legend shows a live count per type ("used on 14 edges across 6 types").
- Creating a missing type inline (`+ new type…`) opens the same create modal
  the Installs tab uses — user never has to leave the assignment flow.

### 5.2 Why not the canvas itself? (Ed's click-overload worry — agreed)

The unused `onRegionClick(elementId, region)` seam means the builder canvas
*could* take per-edge psi clicks with no new event plumbing. Rejected as the
primary UX anyway:

- The canvas already multiplexes select / multi-select / rename / insert
  row-col / eyedropper / paint-bucket / merge-split. A ninth mode fights all
  of them for the same hit targets.
- Psi-install is a *certification* concern, not a *layout* concern. Most
  sessions on the builder never need it; a mode toggle would be paid by
  everyone.
- Keep the seam in reserve: if the modal proves too heavy, a later
  "install-psi lens" toggle on the canvas (recolor edges by assignment, wire
  `onRegionClick` into the same assign action) is a pure addition. Not in v1.

### 5.3 Status & Documentation pages

- **Status**: one `StatusSummaryTable` entry for `aperture_install_types`
  (group "Apertures", leaf "Installs", new destination kind → the Installs
  sub-tab with `?focus=`). Rows with `source = calculated/manufacturer` and no
  PDF surface as incomplete exactly like TB rows do.
- **Documentation**: add a `DocumentationTable` for the new table. Known gap
  (research.md §5.3): the Documentation page tracks only `datasheet_*` /
  `photo_*` axes; `pdf_report_asset_ids` is invisible there today — true for
  thermal bridges too. **Decision needed (Ed):**
  - (a) extend `DocumentationAxisCounts` with a `pdf_report` axis (fixes TB
    too — nicer, slightly wider change), or
  - (b) store the Flixo PDF in `datasheet_asset_ids` for this table
    (works today, but "datasheet" is the wrong word for a calc report), or
  - (c) Status-only for v1 (TB precedent).
  Recommendation: **(a)** — it's the honest model and TB inherits the fix.

### 5.4 What the Phius user experiences (acceptance sketch)

1. Creates apertures as today. Never opens anything psi-related.
2. Element cards quietly show `0.052` (muted) per perimeter edge, `0 (mull)`
   on interior edges. Route 3 emits real numbers; the GH fallback never fires.
3. One window is mid-wall mounted: open its Installs modal, pick the seeded
   "Mid-wall" type, click four edges, Done. ~20 seconds.

### 5.5 What the PHI-retrofit user experiences

1. Installs tab: creates 6 calculated types, drags a Flixo PDF onto each,
   status tracked; Status page shows 6/6 needing PDFs until uploaded.
2. First aperture: Installs modal, paints head/sill/jamb types, then "Copy
   assignments to…" → applies to the 12 matching aperture types.
3. Certifier asks for justification: Documentation page lists each type with
   its PDF.

## 6. Explicitly out of scope (v1)

- Canvas lens/mode for psi (5.2 — reserved seam).
- Per-placed-instance overrides (Rhino-side; `HBPH - Set Aperture
  Psi-Installs` already covers it).
- PHX/upstream bug fixes from research.md §3.6 (file separately in PHX repo).
- Install *length* accounting (WUFI derives from geometry; PHN does not need
  to compute perimeters for export).
- Auto-detecting mounting condition from assembly build-ups.

## 7. Open questions for Ed (the actual decision list)

1. **Modal-first UX (5.1 Layer 3) vs table-with-matrix vs canvas mode** —
   recommendation is the modal with key view; confirm before any UI phase.
2. Fifth Apertures sub-tab named **"Installs"** — naming ok? ("Install Psi"?
   "Install Details"?)
3. Default row semantics (3.1): program-aware seed values confirmed
   (Phius 0.052 / PHI 0.04)? Editable? What happens on program change?
4. Void-adjacent edges: perimeter or separate category (3.2)?
5. Documentation-page evidence axis: option (a)/(b)/(c) in 5.3.
6. Delete-blocking vs clear-to-default for referenced types (3.4).
7. Sequencing with the GH client dedup fix (§4) — PHN can ship storage + UI +
   uniform-default emission first (safe: one value per frame name), but must
   not emit *varying* per-edge values until honeybee_grasshopper_ph_plus
   lands the per-edge application change.
