---
DATE: 2026-05-11
STATUS: Split from context/USER_STORIES.md; canonical story body.
SOURCE: context/USER_STORIES.md
---

# PH-Navigator V2 — User Stories: Envelope

## US-Builder-Envelope — Envelope tab (US-3.4)

**Status:** Draft (parent — sub-stories range Draft → Placeholder)
**Priority:** MVP
**PRD ref:** §6.2 (`tables.assemblies` shape — sketch needs amendment;
see Q-ENV-1, Q-ENV-2), §7 (catalog bookshelf), §11.1 (project tabs),
§11.5 (units architecture), §8 (save / version model — Envelope
edits flow into the draft buffer, persisted by Save / Save As)
**UI/UX ref:** §2.7 *Envelope tab* (placeholder — expanded by these
sub-stories)
**V1 reference:** `research/v1-assembly-builder-reference.md`
— deep enumeration of V1 Envelope behavior; consult for any "what
does V1 do here" question. Cited as `V1 ref §N` below.

### Story (parent)
> As an editor, I want to compose the project's envelope assemblies
> — walls, floors, roofs, and any construction made of stacked
> material layers — by adding layers (each with thickness), filling
> each layer with one or more side-by-side material segments, picking
> materials from the catalog, marking design-spec status / continuous
> insulation / steel-stud cavities, attaching site photos and product
> datasheets per segment, and seeing the live PH-average effective
> R-value (with steel-stud handling per AISI S250-21), so the design
> intent is captured for every opaque construction in the project
> and the data round-trips cleanly with Rhino + honeybee_ph via
> HBJSON.

### Why this is a story-cluster (US-ENV-1..15)
The Envelope surface is the second-densest editing surface in PHN
after Windows. V1 splits it into **four sub-tabs** (Assemblies,
Materials, Airtightness, Site Photos; V1 ref §3.1) and the
Assemblies sub-tab alone has 10+ named subsystems (sidebar, header
labels, canvas, layer/segment renderers, three modals, copy/paste
state machine, HBJSON import/export). Splitting into an `US-ENV-N`
cluster lets us walk one subsystem at a time. Sub-stories share the
project's versioned-document + bookshelf-catalog architecture
(PRD §6.2, §7).

### Key V1 → V2 shifts (read first)

These mirror the Windows cluster's framing (US-Builder-Windows §
"Key V1 → V2 shifts") with envelope-specific emphasis:

1. **All assembly data lives in the versioned project document.**
   `body.tables.assemblies[]` per PRD §6.2 (with amendments — see
   Q-ENV-1 / Q-ENV-2). Edits flow into the draft buffer
   (PRD §8.3); explicit **Save** or **Save As** persists to a
   version. No V1-style per-property PATCH round-trip
   (V1 ref §13.14).
2. **Materials are bookshelf-copied from the catalog, not
   live-referenced** (PRD §7.1). At pick time, the catalog row's
   values are *copied into the document* and stamped with a
   `catalog_origin` block. Catalog edits do not propagate into the
   project. Refresh-from-catalog (US-ENV-11) is the explicit
   re-sync gesture. **This is the largest behavioral change from
   V1**, where the global Materials table was live-referenced and
   silently mutated by `purge_unused_materials` (V1 ref §13.9).
3. **No AirTable.** V2 catalog is hand-curated in the catalog
   manager (a separate top-level area; PRD §7.3, US-2). No
   "Refresh Materials from AirTable" gesture; no
   `purge_unused_materials` behavior; no
   `NoMaterialsException` hard-failure on first use
   (V1 ref §13.8). New segments in V2 ship with `material: null`
   per Q-APT-3-style lean (lifted to assemblies as Q-ENV-3).
4. **Backend is SI-only; frontend converts** (PRD §11.5). V1's
   `DetailsModal` material-data block hard-coded SI even when the
   user was in IP mode (V1 ref §12.8); V2 must respect the
   per-user IP/SI toggle everywhere.
5. **Locked versions block all edits** (US-3.1). When the active
   version is locked, the entire Envelope tab renders read-only
   with the "Save As to copy and edit" banner; no inline edit
   affordances anywhere in this cluster. Replaces V1's logged-in
   vs. Viewer gating.
6. **Sort order normalized.** V1 already uses `naturalSortCompare`
   on the assembly sidebar (V1 ref §8.1) — V2 keeps this and uses
   it everywhere assemblies / materials are listed.
7. **Selection cleared on version switch.** Active assembly,
   copy/paste pick state, and undo stack do not survive a version
   switch via the header dropdown (US-3.1). Mirrors V1 behavior on
   assembly change (V1 ref §6.3 lifecycle).
8. **Toast + Dialog replace `alert` + `window.confirm`.** V1 uses
   `window.confirm` for assembly / layer / segment delete and
   `alert` for refresh / upload feedback (V1 ref §6.2, §8.3, §9.2,
   §9.3, §11.3). V2 uses shadcn `Dialog` for confirmations and
   Sonner toasts for non-blocking feedback (UI/UX §1.3, §1.4).
9. **Last-Layer / Last-Segment minimums become UI-level locks.**
   V1 enforces these server-side and surfaces backend exceptions
   via `alert()` (V1 ref §13.3). V2 disables the Delete button at
   the UI level with an explanatory tooltip, matching the
   US-APT-2 criterion-7 pattern.
10. **Per-segment property updates collapse into one document
    patch.** V1 issues up to 4 PATCHes from the Segment-Properties
    modal Save and 5 PATCHes per copy/paste (V1 ref §13.14), with
    real partial-failure risk. V2's draft-buffer patches are
    atomic per Save flush (one round-trip writes the whole
    segment subtree); copy/paste applies as a single multi-op
    patch.

### Open architectural questions — resolve early (data-model-shaping)

These shape the document body and need to be settled before
Pydantic models are written.

- **Q-ENV-1 (Resolved 2026-05-10):** PRD §6.2 sketch is
  illustrative only — implementation details are picked during
  code-writing, but the missing fields (`assembly.orientation`,
  `layer.thickness_mm`, `segment.steel_stud_spacing_mm` per V1
  ref §2.1–§2.3) **must be added** to the document model.
  Confirmed.

- **Q-ENV-2 (Resolved 2026-05-10): Datasheets at project-material
  level; site photos at segment level.** Pulled out of original
  Q-ENV-2 lean during 2026-05-10 review. **The V2 model splits
  documentation by what unit it actually documents:**

  | Documentation kind | Lives where | Why |
  |---|---|---|
  | **Datasheets** (manufacturer PDFs) | Per-project per-material | One product = one datasheet for the whole project; required QA artifact regardless of how many assemblies use the product. Stored per-project (not in the catalog) so the design / construction team's submission is the captured record (the QA value is *they* tell *us* what they're using, even if our catalog already knows the product). |
  | **Specification status** | Per-project per-material | "Have we received a confirmed product commitment from the design team?" is a material-level question, not a segment-level one. If they've committed to XPS for the project, they've committed for every use. (V1 ref §2.3 had this per-segment as a side-effect of the data structure, not by design.) |
  | **Notes** | Per-project per-material | Same reasoning. (V1 ref §12.8 had this per-segment.) |
  | **Site photos** | Per-segment | "We need a photo of *each* installation slot" — a wall and a floor that both use XPS each need their own as-built photo. (V1 ref §13.7 already segment-scoped this with the right rationale: "site photos document a specific installation slot, not the abstract product.") |

  **Document model — restructured (replaces PRD §6.2 sketch for
  envelope tables):**

  ```jsonc
  {
    "tables": {
      "assemblies": [
        {
          "id": "asm_<ULID>",
          "name": "WALL-C3",
          "orientation": "first_layer_outside",
          "layers": [
            {
              "id": "lyr_<ULID>",
              "order": 0,
              "thickness_mm": 50.0,
              "segments": [
                {
                  "id": "seg_<ULID>",
                  "order": 0,
                  "width_mm": 812.8,
                  "steel_stud_spacing_mm": null,
                  "is_continuous_insulation": false,
                  "project_material_id": "pmat_<ULID>",   // <-- ref by id
                  "photo_asset_ids": []                    // <-- per-segment
                }
              ]
            }
          ]
        }
      ],
      "project_materials": [
        {
          "id": "pmat_<ULID>",
          "name": "XPS",
          "category": "Insulation",
          "conductivity_w_mk": 0.034,
          "density_kg_m3": 35,
          "specific_heat_j_kgk": 1500,
          "emissivity": 0.9,
          "color": "#dce6f0",
          "specification_status": "complete",       // 'complete'|'missing'|'question'|'na'
          "datasheet_asset_ids": ["asset_..."],      // <-- per-material
          "notes": null,
          "catalog_origin": {                        // null if hand-entered
            "catalog_table": "materials",
            "catalog_record_id": "rec123abc",
            "catalog_version_id": "rec123abc_v3",
            "synced_at": "2026-05-09T14:00:00Z",
            "local_overrides": []
          }
        }
      ]
    }
  }
  ```

  **Auto-management rules:**
  1. **Picking a catalog material in a segment** auto-de-dupes by
     `catalog_origin.catalog_record_id`:
     - If a `project_materials` row exists with the same
       `catalog_record_id` → segment's `project_material_id` is set
       to that row's id. Datasheet, spec-status, notes are shared
       across all segments using it.
     - Else → a new `project_materials` row is created (with the
       catalog row's values inlined) and the segment references
       it.
  2. **Hand-entering a material** always creates a new
     `project_materials` row with no `catalog_origin` (no
     auto-dedup by name; user explicitly types each unique
     hand-entered material).
  3. **Editing a `project_materials` row's values** (inline
     override) affects every segment that references it. This is
     the deliberate trade-off: shared identity = shared values.
  4. **Refresh-from-catalog** (US-ENV-11) operates on a
     `project_materials` row, not on individual segments.
  5. **Last-segment deletion → orphan row preserved.** When the
     last segment referencing a `project_material_id` is deleted,
     the `project_materials` row is **not** auto-cleaned. It
     surfaces in the Specifications view as **"Unused"** so the
     user can keep it (datasheet still useful for the QA record)
     or explicitly delete. This protects against accidental
     datasheet-loss when reorganizing assemblies.
  6. ~~**Catalog-origin recovery on HBJSON re-import.**~~
     Originally drafted as rule 6 here; **dropped 2026-05-10**
     when HBJSON construction import was removed from V2 v1
     scope (see US-ENV-12 / PRD §3 non-goals). HBJSON is
     viewer-only in V2 — the Model tab consumes uploaded
     HBJSON for visualization but does not write to
     `tables.assemblies` or `tables.project_materials`. PHN is
     the authoritative source for envelope data; Rhino /
     Honeybee consume PHN data downstream and produce HBJSON
     as output.

  Confirmed.

- **Q-ENV-2.1 — Should datasheets ever live at the catalog
  tier? Resolved 2026-05-10: NO.** The catalog carries product
  *specs* (conductivity, density, spec heat, emissivity, color)
  so the modeling work can proceed without manual entry, but
  **datasheets themselves never live in the catalog** — not even
  as optional defaults. The QA value is the design / construction
  team submitting *their* datasheet on *their* project; a
  catalog-tier default would invite users to skip the submittal
  step or assume our reference doc is "good enough." Catalog-side
  datasheets and per-project datasheets are different artifacts
  serving different workflows (catalog = "what is this product?"
  / per-project = "did the team commit to using it on this
  project?"); rather than carrying both, we carry only the one
  that the QA workflow demands. Persisted as an
  auto-memory principle so future feature proposals don't drift
  back toward "let's auto-populate from catalog."

- **Q-ENV-3: Default material on segment / assembly create.**
  Resolved 2026-05-10. V1's `Layer.default(material)` required
  non-null material and raised `NoMaterialsException` on first
  use of an empty DB (V1 ref §13.8). V2 has no AirTable seed.

  **Resolution — three parts:**

  1. **Initial state.** New assembly → first layer ships with
     one segment whose `project_material_id` is `null`. Document
     validation tolerates nulls in `draft`, `Save`, and
     `Save As` without warnings or blockers. Null materials,
     missing datasheets, missing site photos, and open
     specification statuses are normal until late in the
     certification process; the canvas and Specifications
     dashboard are the completeness surfaces, not the Save flow.
  2. **Visual cues for null-material segments** (so the user
     never wonders "why does my R-value say `--`?"):
     - **Canvas** (US-ENV-4): segment renders with **blank fill
       + dashed `#999` outline** — visually distinct from a
       picked segment (solid fill, solid border). See US-ENV-4
       criterion 3 update.
     - **R-/U-value label** (US-ENV-3 header / US-ENV-10):
       includes an **"unfinished"** marker (e.g. an "(unfinished —
       N segments missing material)" suffix or warning icon)
       whenever any segment in the active assembly is null. See
       US-ENV-10 placeholder note.
  3. **TWEAK — "last picked material" becomes session default.**
     Once a user picks any material for any segment in the
     active assembly, that material becomes the default for
     **subsequent new segments** (both add-segment and add-layer):
     - **add-segment hover-`+`** — primary source is the
       adjacent ("source") segment's `project_material_id` (V1
       parity, already in US-ENV-6 criterion 1). **Fallback** if
       the adjacent segment is `null`: the assembly's
       last-picked material from the session store. If both are
       null (brand-new empty assembly), the new segment is
       `null`.
     - **add-layer hover-`+`** — there is no source segment.
       The new layer's starting segment defaults to the
       assembly's last-picked material from the session store
       (or `null` if nothing has been picked yet in this
       assembly).
     - Rationale: walls and floors typically have multiple
       segments / layers of the same product (e.g. several XPS
       layers totaling a desired thickness). Defaulting to the
       last-used material removes a click per segment in the
       common case while preserving the dashed-outline / null
       state for the truly empty assembly.

     **Implementation note.** The "last-picked material" lives
     in **frontend Zustand state**, not in the project document
     — it's UI ergonomics, not data. Keyed per-assembly
     (`Record<assembly_id, project_material_id | null>`).
     Session-only; resets on document/version switch.
     Triggered to update on every successful material-pick
     through the bookshelf picker (US-ENV-7).

- **Q-ENV-4: Steel-stud surface-film divergence (V1 ref §13.5)
  + Honeybee U-Factor vs U-Value convention.** **Resolved
  2026-05-10** after a source-level audit of Honeybee
  (`honeybee_energy/construction/_base.py:115-141`) and
  PHN-V1 (`backend/features/assembly/services/
  thermal_resistance.py` + `to_hbe_material_steel_stud.py`).

  **Honeybee's convention is explicit and consistent at every
  level:**

  | Term | Films included? | Source |
  |---|---|---|
  | `EnergyMaterial.r_value` / `u_value` | **NO** ("excluding air films") | `material/opaque.py:201-225` |
  | `OpaqueConstruction.r_value` / `u_value` | **NO** ("excluding air films") | `construction/_base.py:115-123` |
  | `OpaqueConstruction.r_factor` / `u_factor` | **YES** (EN 673 / ISO 10292) | `construction/_base.py:125-141` |

  The films used by `r_factor` / `u_factor` are the **simple
  ISO 10292** coefficients (`out_h_simple()=23 W/m²K`,
  `in_h_simple()=3.6+(4.4·ε_inside/0.84)`). They are
  emissivity-dependent but **NOT direction-dependent** — the
  Honeybee `OpaqueConstruction` object doesn't carry
  orientation; direction-dependent films are applied at
  EnergyPlus simulation time using the geometric model.

  **V2 policy: PHN shows only U-Value / R-Value (no films).**
  Never displays U-Factor / R-Factor. Rationale:
  1. If PHN displayed a films-included "U-Factor" using
     Honeybee's simple ISO formulas, it would NOT match
     ASHRAE-convention U-Factor (direction-dependent), WUFI
     (direction-dependent), or EnergyPlus simulation runs
     (direction-dependent). One label, four meanings — actively
     misleading.
  2. The construction itself is direction-independent. Films
     are an envelope-boundary property whose direction the
     downstream simulation tool knows from its geometric model.
     PHN's job is to nail the construction-only thermal
     performance; downstream tools add films at simulation time.
  3. V1's display surface already uses this convention
     (Effective R-Value label + tooltip explicitly says "Surface
     film resistances NOT included" + ASHRAE Ch 27 reference).
     V2 carries V1's tooltip forward verbatim plus one extra
     sentence naming the Honeybee convention we're matching.

  **V1 HBJSON-export steel-stud bug.** V1's
  `to_hbe_material_steel_stud.py` baked `R_SE=0.17, R_SI=0.68
  hr·ft²·°F/BTU` into the AISI S250-21 cavity-equivalent
  conductivity (lines 27-28, 207-208). Downstream Honeybee
  re-adds its own ISO simple films when computing `u_factor`,
  so the cavity-portion films get counted twice. **V2 fix:**
  steel-stud equivalent-conductivity service uses `R_SE=0,
  R_SI=0` everywhere (both live calc and HBJSON export),
  matching what `thermal_resistance.py` already does for the
  live calc. Films enter exactly once at the construction
  boundary, downstream of PHN. Captured in US-ENV-12 (HBJSON
  export) acceptance criteria.

  **Documented in:** `context/GLOSSARY.md` (created
  2026-05-10 — Thermal performance section). PRD §14.1
  (migration script) carries the one-time HBJSON-delta note
  for re-imported V1 steel-stud assemblies.

  **Unblocks:** US-ENV-10 (Effective R-/U-value display) — now
  has full acceptance criteria (status: Draft, no longer
  Placeholder).

- **Q-ENV-5: Multi-row PhDivisionGrid — defer (V1 ref §13.11).**
  Resolved 2026-05-10: **defer to v1.1+; single-row only in V2
  v1.** V1's data model technically allows multi-row division
  grids (vertical splits within a layer producing 2D
  segmentation), but V1 never exposes the editing UI for it and
  hard-fails on the few imports that carry multi-row data. V2 v1
  keeps the same restriction — `layer.segments[]` stays a flat
  array of side-by-side segments along one horizontal axis.
  Confirmed by Ed: rare in practice on BLDGTYP projects (real
  hybrid assemblies model fine as multi-layer, single-row stacks
  via the AISI S250-21 steel-stud equivalent-conductivity
  treatment, V1 ref §5.5).

  ~~HBJSON import behavior: structured error on multi-row.~~
  **Moot 2026-05-10:** HBJSON construction import was dropped
  from V2 v1 entirely (see US-ENV-12 / PRD §3). No import =
  no multi-row error to surface. If a v1.1+ HBJSON import
  feature is added later, the structured-error pattern can be
  added then.

  Multi-row support itself promotes to v1.1+ candidate **gated
  by a concrete user request** (so we don't pay the 2D-grid UI
  cost for a hypothetical need).

- **Q-ENV-6: Manufacturer / category filter for materials —
  parity with Windows or skip?** Resolved 2026-05-10:
  **(a) no filter in V2 v1.** V1 has no per-project material
  filter (V1 ref §13.2) — every project sees every catalog
  material. V2 keeps that behavior.

  Rationale:
  - Material catalogs are dramatically smaller than
    frame/glazing catalogs (which combinatorially explode by
    manufacturer × product line × glazing makeup). Materials
    are mostly product types (XPS, mineral wool, OSB, gypsum,
    etc.), not vendor-keyed.
  - The picker (US-ENV-7) already groups by category and
    supports search across `name` + `category` — sufficient
    for the catalog sizes we expect.
  - Manufacturer is rarely the salient axis for *materials*
    (unlike windows, where projects commonly commit to a
    single manufacturer's product line for the whole job).

  Re-evaluation trigger: if BLDGTYP's catalog crosses
  ~150–200 materials, revisit in v1.1+. The replacement design
  would mirror US-APT-8 — a project-document
  `body.tables.material_filters` table that versions with the
  project — so adding it later is a clean additive change with
  no migration of existing project documents.

### Other open questions (UX-shaping; can be resolved per-sub-story)

- **Q-ENV-7: Envelope tab structure — sub-tabs or flat?** V1 has
  4 sub-tabs (Assemblies / Materials / Airtightness / Site
  Photos; V1 ref §3.1). V2 PRD §11.1 says only "Envelope —
  assemblies." **Lean: keep V1's sub-tab structure for feature
  parity** — Assemblies (the canvas), Specifications (renamed
  from V1's misleadingly-named "Materials" — V1 ref §13.16;
  feature parity, clearer name), Airtightness, Site Photos.
  Walked under US-ENV-1. Confirm.

- **Q-ENV-8: V1 "Materials" sub-tab rename.** V1's tab labeled
  "Materials" is actually a per-segment design-spec / photo /
  datasheet view — V1 ref §13.16 calls out the misleading
  naming. **Lean: rename to "Specifications"** in V2 (matches
  the per-row "Complete / Missing / Question / N/A"
  status, and clearly distinguishes from the global Materials
  catalog reachable via the header "Catalogs ▾" dropdown). Page
  heading text inside the tab can stay "Project Materials" if
  Ed prefers visual continuity. Confirm.

- **Q-ENV-9: Per-assembly deep-link URL.** Resolved 2026-05-10:
  **`/projects/{project_id}/envelope/assemblies` lists** and
  **`/projects/{project_id}/envelope/assemblies/{assembly_id}`
  opens a specific assembly.** Mirrors Q-APT-5 (per-aperture-type
  URL). V1's active assembly was React-state-only — refresh
  dropped you to "first assembly," and links couldn't be shared.
  V2 syncs `selectedAssemblyId` ↔ URL ↔ store. Edge case:
  deleting the active assembly redirects to the first remaining
  assembly (or the envelope tab's empty state if none remain).

- **Q-ENV-10: Layer add behavior — V1's hidden "+ Above" /
  "+ Below" hover buttons (V1 ref §9.2) or V2-style edge-add
  hover zones (US-APT-2 criterion 3)?** Resolved 2026-05-10:
  **(a) match V1.** Small `+` circle buttons revealed on hover
  at each layer's top and bottom edges, magenta `#b2087c`. Same
  pattern for segments (`+ Add Segment Left / Right` on segment
  edges). Rationale: V1's pattern is well-trodden by Ed and
  John, and the envelope canvas has lower layer/segment counts
  than the windows grid (where hot-zone bands earn their
  complexity by supporting "add anywhere along this edge"). The
  small visual inconsistency between Windows (edge hot zones)
  and Envelope (hover circles) is acceptable — the surfaces are
  visually distinct enough not to confuse users.

- **Q-ENV-11: HBJSON construction action — where does it live,
  and is import in scope?** Resolved 2026-05-10 with a scope
  reduction:
  - **Import is dropped from V2 v1.** HBJSON construction
    import is removed from MVP. HBJSON is **viewer-only** in
    V2 — the Model tab (US-Viewer) consumes uploaded HBJSON
    for visualization but never writes back into the builder
    or tables. PHN is the authoritative source for envelope
    data; Rhino / Honeybee consume PHN data downstream and
    produce HBJSON as output. The same one-direction logic
    that applies to rooms (US-EQ-2) applies to assemblies.
    Captured in PRD §3 non-goals.
  - **Export only**, surfaced under the project header
    `⋯ → Download constructions (HBJSON)`. Mirrors Q-APT-8
    placement (windows-side HBJSON download). Per-version —
    each download is a snapshot of the active version's body.
  - Detail in US-ENV-12.

### Sub-story sequence

| Sub-story | Topic | Status |
|---|---|---|
| US-ENV-1 | Envelope tab structure (sub-tabs) | Shipped (Assemblies + Specifications routed; Airtightness / Site Photos still placeholders) |
| US-ENV-2 | Assembly list (sidebar) — add / rename / duplicate / delete | Shipped |
| US-ENV-3 | Assembly header (name, totals, header actions) | Shipped |
| US-ENV-4 | Canvas — layers, segments, orientation labels, legend | Shipped |
| US-ENV-5 | Layer ops — add / edit thickness / delete | Shipped |
| US-ENV-6 | Segment ops — add / edit properties / delete | Shipped |
| US-ENV-7 | Pick material — bookshelf flow from the catalog | Shipped (key V2 shift) |
| US-ENV-8 | Orientation — flip orientation, flip layers | Shipped |
| US-ENV-9 | Copy / paste material assignments | Shipped |
| US-ENV-10 | Effective R-value / U-value display | Shipped |
| US-ENV-11 | Refresh-from-catalog (per-segment material) | Shipped (new in V2) |
| US-ENV-12 | HBJSON construction **export** (download only — import not in V2 v1) | Shipped |
| US-ENV-13 | Specifications sub-tab (per-segment status, photos, datasheets) | Shipped |
| US-ENV-14 | Airtightness sub-tab | Placeholder (out of cluster scope) |
| US-ENV-15 | Site Photos sub-tab — contractor-facing regrouped view of US-ENV-13 photo data | Draft (sub-tab not yet wired) |

---

## US-ENV-1 — Envelope tab structure

**Status:** Draft · **Priority:** MVP
**PRD ref:** §11.1 (Envelope tab)
**V1 ref:** §3.1 (envelope-data sub-tabs)

### Story
> As an editor, I want the Envelope tab grouped into sub-tabs that
> match the way I work — composing assemblies, tracking per-segment
> design specifications, recording blower-door results, and managing
> required site photos — so each task lives in a focused surface
> without crowding a single page.

### Acceptance criteria

1. **Envelope tab has four sub-tabs**, in this order:
   - **Assemblies** (default landing)
   - **Specifications**
   - **Airtightness**
   - **Site Photos**
2. **URLs.** Each sub-tab updates the URL:
   - `/projects/{id}/envelope/assemblies`
   - `/projects/{id}/envelope/specifications`
   - `/projects/{id}/envelope/airtightness`
   - `/projects/{id}/envelope/site-photos`
   The bare `/projects/{id}/envelope` redirects to
   `/envelope/assemblies` (V1 parity, V1 ref §3.1).
3. **Per-assembly deep link** (Q-ENV-9 lean): when an assembly is
   selected, the URL extends to
   `/projects/{id}/envelope/assemblies/{assembly_id}`. Direct
   visits restore the active assembly. Browser back / forward
   work.
4. **Sub-tab styling** mirrors the project tab bar (UI/UX §2.4):
   active-state underline + light fill, inactive grey. Sticky on
   vertical scroll along with the project header.
5. **Tab content is independently scrollable** — switching tabs
   does not reload the project document; it only swaps the inner
   view.
6. **Locked-version banner** (US-3.1 cross-cutting) renders above
   all four sub-tabs when the active version is locked. Banner
   does not duplicate per-sub-tab.
7. **No "Materials" sub-tab.** Per Q-ENV-8, V1's misleadingly-
   named "Materials" sub-tab is renamed to **Specifications** in
   V2 to disambiguate from the global Materials catalog (header
   "Catalogs ▾" dropdown, US-2). The page heading inside the tab
   stays **"Project Materials"** for visual continuity with V1.

### Open questions
None — resolved by Q-ENV-7 / Q-ENV-8 above.

---

## US-ENV-2 — Assembly list (sidebar)

**Status:** Draft · **Priority:** MVP
**PRD ref:** §6.2 (`tables.assemblies[]`), §11.1 (Envelope tab),
§8 (draft + Save flow)
**V1 ref:** §8 (Sidebar), §6.2 (AssemblyProvider)

### Story
> As an editor, I want a left-rail list of every assembly in this
> project version, with quick-access actions to add, rename,
> duplicate, and delete an assembly, so I can navigate and
> reorganize my envelope set without leaving the canvas.

### Acceptance criteria

1. **Layout.** The Assemblies sub-tab is split:
   - Left sidebar (≈260 px wide; collapsible to a 0-px rail with a
     chevron toggle), default state **closed** for first-time
     visits to a project (mirroring V1 ref §3.3, §8).
   - Right main area = Assembly header + canvas + legend for the
     active assembly (US-ENV-3..10).
2. **List source.** Renders `body.tables.assemblies[]` from the
   currently-open version's draft body (or saved body if no draft).
3. **Sort order.** `naturalSortCompare` ascending by `name`. So
   `WALL-C2`, `WALL-C10`, `WALL-SE-30a`, `WALL-SE-80`. Matches V1
   (V1 ref §8.1).
4. **Each row shows name only** — no thumbnail, no R-value, no
   layer count, no thickness (matches V1; perf-friendly). Active
   assembly is highlighted.
5. **Click a row → set active.** The clicked assembly becomes the
   editing target in the main area. Selection state is reflected
   in the URL per Q-ENV-9 (`/envelope/assemblies/{assembly_id}`).
   Switching active assembly **clears copy/paste state** (US-ENV-9
   cross-cutting; V1 ref §6.3).
6. **Hover-revealed row actions** (logged-in editor on an unlocked
   version only):
   - **Edit name** — opens the rename dialog (criterion 9).
   - **Duplicate** — clones the assembly (criterion 10).
   - **Delete** — confirms and removes (criterion 11).
   On a **locked** version, action icons are hidden entirely (the
   tab is read-only per US-3.1 cross-cutting). On a public view
   link, icons are also hidden.
7. **Add button.** Sticky at the top of the sidebar:
   `+ Add new assembly`. Disabled on locked versions and public
   Viewers. Clicking creates a new assembly (criterion 8) and
   sets it as active.
8. **Add new assembly.** Creates the following object in the draft
   body:
   ```jsonc
   {
     "id": "asm_<ULID>",
     "name": "<auto-named per criterion 8a>",
     "orientation": "first_layer_outside",
     "layers": [
       {
         "id": "lyr_<ULID>",
         "order": 0,
         "thickness_mm": 50.0,
         "segments": [
           {
             "id": "seg_<ULID>",
             "order": 0,
             "width_mm": 812.8,
             "steel_stud_spacing_mm": null,
             "is_continuous_insulation": false,
             "photo_asset_ids": [],
             "project_material_id": null      // null per Q-ENV-3 — pick required before submit
           }
         ]
       }
     ]
   }
   ```
   Newly added assembly becomes active. Default values match V1
   (V1 ref §2.1, §2.2, §2.3) except for `project_material_id:
   null` per Q-ENV-3, and the `project_materials` indirection per
   Q-ENV-2. **Note:** `specification_status`, `notes`, and
   `datasheet_asset_ids` are **not** on segments in V2 — they live
   on the `project_materials` row referenced by
   `project_material_id` (Q-ENV-2 model).

   **8a. Auto-named to satisfy uniqueness (per criterion 9a).**
   Default name is **"Unnamed Assembly"** (matches V1 ref §2.1).
   If an assembly with that name already exists in the active
   version's `tables.assemblies`, suffix ` (2)`, ` (3)`, …, is
   appended. Same case-insensitive trimmed comparison as
   criterion 9a.

9. **Rename dialog.**
   - Modal title: **"Assembly Name"**.
   - Single text field labelled **"Assembly Name"**, autofocus,
     full-select on focus.
   - Submit on **Enter**.
   - **Save** button disabled while:
     - the field is empty / whitespace, OR
     - the trimmed value equals the current name (no-op), OR
     - the trimmed value collides with another assembly's name
       per criterion 9a, OR
     - the trimmed value exceeds 100 characters (V1 ref §2.1).
   - **Cancel** / **Save** buttons (Cancel is the default action
     on Esc).
   - On Save, applies a JSON-Patch `replace` op to
     `tables.assemblies[<idx>].name` in the draft body.

   **9a. Uniqueness rule.** Assembly names must be unique within
   a project version. Comparison is **trim + case-insensitive**.
   Display preserves the user's original casing. Mirrors
   US-APT-1 criterion 9a.

10. **Duplicate.**
    - Deep-copies the active assembly into a new entry. New `id`s
      are generated for the assembly, every layer, and every
      segment.
    - **`project_material_id` references are preserved** — every
      duplicated segment points to the same `project_materials`
      rows as its source. This is the deliberate behavior given
      Q-ENV-2: the duplicate uses the same products, so it shares
      the same datasheets, spec-status, notes, and refresh-state.
      No new `project_materials` rows are created.
    - **Site photos are NOT duplicated** — they're segment-scoped
      and document a specific installation slot; copying them
      would misrepresent the new assembly's site. Each new
      segment's `photo_asset_ids` starts empty.
    - The duplicated assembly becomes active.
    - Default new name = `"<source name> (Copy)"`, with auto-
      suffix on collision. Matches V1 ref §5.1.
    - Surfaced as a Sonner toast: **"Duplicated as
      '<new name>'"**.

11. **Delete.**
    - shadcn `Dialog` confirm (not `window.confirm`):
      title **"Delete assembly?"**, body **"This will remove
      '<name>' and all its layers, segments, and per-segment site
      photos from this version. Project-level material datasheets
      and spec-status are preserved (visible as 'Unused' in the
      Specifications view if no other assembly uses the material).
      Save or Save As to persist. Cancel keeps it in your draft."**,
      buttons **Cancel** / **Delete** (delete is destructive
      variant).
    - On confirm, removes the entry from the draft.
    - **`project_materials` rows are NOT auto-deleted** per
      Q-ENV-2 rule 5 — they survive as orphans and surface in the
      Specifications view as "Unused" so the user can decide
      whether to keep the datasheet record or delete explicitly.
    - If the deleted assembly was active, the next assembly in
      sort order becomes active; if the list is empty, the main
      area shows the empty state (criterion 12).
    - **No `window.confirm`. No name retyping** (deletion is
      reversible by Discard-changes or by not-Saving).
12. **Empty list state.** When `tables.assemblies` is empty, the
    sidebar shows only the **+ Add new assembly** button; the main
    area shows: "No assemblies yet. **[+ Add assembly]**" centered.
13. **Locked-version + Viewer rendering.** All edit affordances
    hidden. List is still navigable read-only.
14. **All mutations go through the draft buffer** (PRD §8.3). Save
    status indicator in the project header bar (UI/UX §2.4)
    reflects dirty state.

### Resolved questions
None outstanding for V1 parity. Drag-reorder of the sidebar is
deferred (matches V1 — no reorder; alphabetical only).

### Open questions
None — defaults track US-APT-1's resolved patterns.

---

## US-ENV-3 — Assembly header (name, totals, header actions)

**Status:** Draft · **Priority:** MVP
**V1 ref:** §3.3 (header composition), §11.1
(TotalThicknessLabel), §11.2 (EffectiveRValueLabel),
§11.3 (useAssemblyHeaderButtons)

### Story
> As an editor, the active assembly's content area gives me at a
> glance: which assembly I'm editing, its total thickness, its
> effective R-/U-value, and one-click access to the per-version
> actions I need (flip, copy/paste, undo, HBJSON in/out).

### Acceptance criteria

1. **Header strip** sits above the canvas. Layout:
   - **Left:** "Assembly Details" heading + assembly name picker
     (V1 ref §3.3 `AssemblySelector` — shadcn `Combobox` /
     `Select`; replaces V1's MUI `Autocomplete`). Picker shows
     all assemblies in the active version's body, sorted by
     `naturalSortCompare`.
   - **Center / right:**
     - **Total Thickness** label — sum of layer
       `thickness_mm`. Live (reflects in-flight layer-thickness
       overrides per V1 ref §6.2 `layerThicknessOverridesMm`).
     - **Effective R-Value** (IP) or **U-Value** (SI) label —
       backend-computed; refetches on draft layer/segment
       changes (debounced ~500 ms).
   - **Right:**
     - **Canvas zoom cluster** (V2 NEW per Q-ENV-4.1):
       `[−] 100% [+] [Fit]`. Steps through `0.25 / 0.5 / 0.75 /
       1.0 / 1.5 / 2.0`. Persisted in
       `userPreferencesStore.envelope_canvas_zoom`. `Fit` snaps
       to the largest discrete step that fits both axes inside
       the canvas viewport. Always visible (even on locked
       versions and Viewers — zoom is a viewing aid).
     - **Assembly Toolbar** (V1 ref §11.4): Flip-Orientation,
       Flip-Layers, Copy/Paste-Material entry, Undo-last-paste.
     - **`⋯` row-action overflow menu** for assembly-scoped
       actions: Rename, Duplicate, Delete (mirrors sidebar row
       actions; redundant for keyboard / accessibility).
2. **Total Thickness label** (V1 ref §11.1 parity):
   - SI: `"Total Thickness: 304.8 mm"` (3 decimals).
   - IP: `"Total Thickness: 12.0 in"` (1 decimal).
   - Tooltip: `"Sum of all layer thicknesses"`.
   - Renders `--` when no assembly selected.
   - `min-width: 160 px` to prevent layout shift.
3. **Effective R-Value / U-Value label** (V1 ref §11.2 parity;
   detail in US-ENV-10):
   - IP: `"Effective R-Value: 23.4"` (1 decimal,
     hr·ft²·F/BTU).
   - SI: `"Effective U-Value: 0.243 W/m²K"` (3 decimals).
   - Info icon (`InfoOutlined`) → tooltip with the ASHRAE
     CH27 PH-average explanation plus the **"surface films
     NOT included"** note (per Q-ENV-4 resolved 2026-05-10;
     full tooltip text in US-ENV-10 criterion 3).
   - Renders `--` while loading or if `is_valid=false`.
   - `min-width: 200 px` (per US-ENV-10 criterion 5).
4. **Assembly Toolbar** buttons disabled when no assembly
   selected, when in pick/paste mode for the unrelated buttons,
   when `undoStack.length === 0` for the Undo button (V1 ref
   §11.4 parity). Detail in US-ENV-8 / US-ENV-9.
5. **HBJSON in/out actions are NOT in this header.** Per Q-ENV-11
   lean, they live in the project header `⋯` menu (US-ENV-12).
   This is a deliberate divergence from V1 ref §11.3 (which has
   them in the assemblies-tab overflow menu).
6. **No "Refresh Materials from AirTable" button.** V2 has no
   AirTable surface; the catalog manager is reached via the
   global header "Catalogs ▾" dropdown (US-2). The "drift from
   catalog" feedback flows through the per-segment refresh
   workflow (US-ENV-11) and a per-tab summary banner (US-ENV-11
   surface 2).
7. **Locked-version + Viewer rendering.** Header reads as a
   read-only label strip (assembly picker still works to switch
   the viewed assembly; toolbar buttons hidden; `⋯` menu shows
   only Duplicate as an action that creates editable state in
   a NEW version).

### Resolved questions (2026-05-10)
- **Q-ENV-3.1: Should the assembly picker live in the header at
  all, given the sidebar already lists assemblies? Resolved: keep
  both.** V1 has both (V1 ref §3.3 `AssemblySelector` + sidebar);
  V2 retains both. Both bind to the same `selectedAssemblyId`
  state. Rationale:
  - **Sidebar** (US-ENV-2): full vertical scan; best for picking
    by glance when you don't remember the exact name; visual
    roster of "what assemblies exist."
  - **Header dropdown** (this story, US-ENV-3): fast keyboard /
    name-based jumps; doesn't require a glance shift to the left
    rail.
  - **Sidebar is collapsible** (US-ENV-2 criterion: 260 px → 0 px
    chevron toggle). When the sidebar is collapsed for screen
    real-estate, the header dropdown becomes the *only* assembly
    switch on screen — making the redundancy load-bearing, not
    decorative.
  Both surfaces must stay in sync on add / rename / duplicate /
  delete (same store; both subscribe).

### Open questions
None outstanding.

---

## US-ENV-4 — Canvas (layers, segments, orientation labels, legend)

**Status:** Draft · **Priority:** MVP
**V1 ref:** §9.1 (canvas container), §9.2 (Layer rendering),
§9.3 (Segment rendering), §9.5 (AssemblyLegend), §13.4
(orientation enum)

### Story
> As an editor, I want the active assembly drawn as a
> proportional cross-section: layers stacked top-to-bottom with
> visual height = thickness in mm, each layer filled with one or
> more side-by-side colored rectangles whose colors come from the
> material catalog, with "interior" and "exterior" labels at the
> top and bottom matching the orientation enum, and a legend
> below summarizing the materials in use.

### Acceptance criteria

1. **Container layout** (V1 ref §9.1 parity):
   - Top label: `"interior"` or `"exterior"` per orientation
     (`first_layer_outside` → top = "exterior";
     `last_layer_outside` → top = "interior").
   - Vertical layer stack — `<Layer>` components in
     `assembly.layers` array order, index 0 at top.
   - Bottom label: companion orientation label.
   - **Below the canvas:** `<AssemblyLegend>` (criterion 6).
2. **Per-layer rendering** (V1 ref §9.2 parity, with V2
   aspect-ratio fix per Q-ENV-4.1):
   - **Left column** (35 px fixed, font-size 8 px, dashed right
     border): renders the layer's thickness in the user's active
     display unit (mm or in). Click → opens
     `LayerHeightModal` (US-ENV-5). Hover → bold text +
     highlight background. **+ Add Layer Above** and **+ Add
     Layer Below** circular `+` buttons revealed on hover at the
     top and bottom edges (per Q-ENV-10 lean (a) — match V1's
     magenta `#b2087c` style; logged-in unlocked-version only).
   - **Right column** (`flex-row`, no `flex-grow`): height in
     CSS px = `layer.thickness_mm * canvasZoom` (per criterion
     9). Children: `<Segment>` per `layer.segments`, side-by-side
     with `flex-shrink: 0` so they NEVER compress horizontally.
     This is a V2 bug-fix vs V1's flex-grow behavior, which
     squished segments on narrow viewports (Q-ENV-4.1).
   - When the sum of segment widths × `canvasZoom` exceeds the
     canvas viewport width, the **canvas scrolls horizontally**
     rather than compressing segments. Aspect ratio is locked.
   - Border treatment: dashed `#ccc` between layers; first-of-
     type also has a dashed top border. Match V1 ref §9.2.
3. **Per-segment rendering** (V1 ref §9.3 parity, with V2
   null-material affordance per Q-ENV-3):
   - Inline SVG with a `<rect>` whose `fill` is computed from
     the resolved `project_materials[*].color` (`#rrggbb` hex).
   - **Null-material segment** (`project_material_id` is null —
     Q-ENV-3 initial state): rendered with **blank fill** (no
     color; transparent or theme-default) and a **dashed
     `#999` 1.5 px outline** instead of a solid border. This
     visually flags "no material picked yet" so the user
     understands why the R-value label reads "unfinished" (per
     US-ENV-10). Hover styles still apply (highlighted fill +
     stroke); click still opens the picker.
   - Width: `width: ${segment.width_mm * canvasZoom}px` with
     `flex-shrink: 0`. Aspect ratio locked: both axes scale by
     the same `canvasZoom` factor (criterion 9). Replaces V1's
     `maxWidth + flex-grow` pattern, which squished on narrow
     viewports.
   - Hover styles (material picked): highlighted fill + 3 px
     solid stroke (CSS vars
     `--construction-layer-segment-hover-fill` and `-stroke`).
   - Click → opens the Segment-Properties modal (US-ENV-6). In
     pick / paste mode (US-ENV-9), click drives the copy/paste
     state machine instead.
   - **+ Add Segment Left** and **+ Add Segment Right** circular
     `+` buttons revealed on hover at left / right edges
     (logged-in unlocked-version only; hidden in pick/paste).
4. **Orientation label rendering** (V1 ref §13.4): top / bottom
   text labels reflect the assembly's `orientation` enum. The
   labels are read-only here; flipping is done from the toolbar
   (US-ENV-8).
5. **Hover-button visibility** is gated by:
   - Logged-in editor.
   - Unlocked active version.
   - Not in pick / paste mode.
   (For Viewers, the gate fails on "logged-in editor"
   alone — hover-`+` buttons stay hidden.)
6. **Assembly Legend** (V1 ref §9.5 parity):
   - Below the canvas, listing each unique material used in the
     active assembly's segments.
   - Sorted alphabetically by material name.
   - Each row: color swatch + material name + resistivity (IP)
     OR conductivity (SI) per the active unit system.
   - **In V1 the legend is always SI conductivity** (V1 ref
     §9.5); this is a small bug — the rest of the app respects
     the IP/SI toggle. **V2 fixes:** legend renders in the
     active unit system (resistivity in IP, conductivity in
     SI). Mirrors V1→V2 fix #4 in the parent's Key Shifts list.
   - Read-only; clicking does nothing in MVP.
7. **Loading state.** Canvas renders nothing (or a quiet
   skeleton) when the active assembly is in flight or null.
8. **Locked-version rendering.** Canvas remains visually
   identical; hover buttons are hidden; modals are read-only
   (US-ENV-5 / US-ENV-6 cross-cutting).
9. **Canvas zoom + locked aspect ratio** (V2 NEW per Q-ENV-4.1):
   - Single scale state: `canvasZoom: number`. Default `1.0`
     (matches V1's 1:1 baseline). Persisted as a **per-user
     preference** in
     `userPreferencesStore.envelope_canvas_zoom`. NOT
     per-document, NOT per-project.
   - Both axes always scale together by the same factor:
     `segment_render_width_px = segment.width_mm * canvasZoom`
     and `layer_render_height_px = layer.thickness_mm *
     canvasZoom`. Aspect ratio is **never** independent — fixes
     V1's narrow-viewport squish.
   - Discrete zoom steps:
     `0.25 / 0.5 / 0.75 / 1.0 / 1.5 / 2.0`. Avoids fractional
     pixel jitter and gives `+/−` predictable behavior.
   - Zoom UI lives in the **assembly header** (US-ENV-3) as a
     compact cluster: `[−] 100% [+] [Fit]`.
     - `[−]` / `[+]` step through the discrete list, clamped at
       ends.
     - Numeric label is the current `canvasZoom` formatted as
       `Math.round(zoom * 100) + '%'` (read-only label in v1;
       direct-edit deferred).
     - `Fit` computes the largest discrete step that fits both
       `total_segment_width_mm` and `total_thickness_mm` inside
       the canvas viewport. Snaps to a known step so subsequent
       `+ / −` work predictably.
   - Cmd/Ctrl + scroll-wheel zoom: deferred to v1.1+ (testing
     overhead; discrete buttons cover the core need).
   - Horizontal overflow: when scaled assembly width >
     viewport, canvas scrolls horizontally. No compression.
   - Vertical overflow: page-level scroll (existing behavior).
  — **two changes vs V1, both shipping in V2 v1**:

  1. **Lock aspect ratio (bug fix vs V1).** V1's segment row
     uses `flex-grow flex-row` with `maxWidth: ${width_mm}px` per
     segment — when the available canvas width is less than the
     sum of segment widths, segments get **horizontally
     compressed** while layers keep their full 1:1 vertical
     scale. Result: studs and segments render visibly squished
     on narrow screens (Ed has hit this on real projects). V2
     fixes this by **rendering both axes at the same scale
     factor at all times** — no horizontal flex-compression.
     When the assembly is wider than the viewport, the canvas
     overflows into a **horizontal scroll container** instead of
     squishing.

  2. **Explicit zoom control (V2 NEW).** A user-driven zoom is
     part of V2 v1, not a v1.1+ deferred feature. Captured as
     US-ENV-4 criterion 9 (canvas zoom).

  **Implementation contract:**
  - Single scale state: `canvasZoom: number` (default `1.0` =
    V1's 1:1 baseline). Persisted as a **per-user preference**
    (same pattern as the unit-system toggle), not per-project,
    not per-document. Lives in
    `userPreferencesStore.envelope_canvas_zoom`.
  - Rendering math: `segment_render_width_px =
    segment.width_mm * canvasZoom`; `layer_render_height_px =
    layer.thickness_mm * canvasZoom`. Both axes always use the
    same factor — never independent.
  - Segment row CSS: `flex-shrink: 0` on each segment (no
    horizontal compression); the layer's row container scrolls
    horizontally when total width > viewport.
  - Zoom UI lives in the assembly header (US-ENV-3), as a
    discrete-step cluster: `[−] 100% [+] [Fit]`. Steps:
    `0.25 / 0.5 / 0.75 / 1.0 / 1.5 / 2.0` (zoom-in still
    valuable for inspecting thin layers like 6 mm air gaps).
    `Fit` computes
    `min(viewport_w / total_segment_width_mm,
         viewport_h / total_thickness_mm)`
    and snaps to the nearest discrete step (so `Fit` always
    leaves you at a known scale you can iterate from with `+ /
    −`).
  - Cmd/Ctrl + scroll wheel on the canvas optionally bumps zoom
    by one step (deferred to v1.1+ if it complicates testing).

  **Why per-user not per-document:** zoom is viewing
  ergonomics, not data. A user who likes 50% gets it across all
  projects; the document is unchanged.

---

## US-ENV-5 — Layer operations (add, edit thickness, delete)

**Status:** Draft · **Priority:** MVP
**V1 ref:** §9.2 (add/delete flows), §10.2 (LayerHeightModal),
§13.3 (last-layer rule)

### Story
> As an editor, I want to add layers above or below any layer,
> edit a layer's thickness with full unit-parsing support, and
> delete a layer when needed, so I can compose any envelope
> stack-up.

### Acceptance criteria

1. **Add layer** — two paths (matches V1 ref §9.2):
   - Hover **+ Add Layer Above** or **+ Add Layer Below** on the
     thickness column of any existing layer.
   - On click: insert a new layer at the appropriate position.
     New layer:
     - `id: lyr_<ULID>`
     - `thickness_mm: 50.0` (V1 default; V1 ref §2.2)
     - one default segment per criterion 1a.
   - The order index of every existing layer at or after the
     insertion point shifts by +1. Implementation = single
     JSON-Patch `replace` on `tables.assemblies[<idx>].layers`.

   **1a. Default segment on new layer** (per Q-ENV-3 resolution
   — last-used material inheritance):
   ```jsonc
   {
     "id": "seg_<ULID>",
     "order": 0,
     "width_mm": 812.8,
     "steel_stud_spacing_mm": null,
     "is_continuous_insulation": false,
     "photo_asset_ids": [],
     "project_material_id": "<assembly's last-picked, or null>"
   }
   ```
   - `project_material_id` is read from the envelope-builder
     Zustand store: `lastPickedMaterialByAssembly[<assembly.id>]`.
   - If no material has been picked yet in the active assembly
     (brand-new assembly, or no segment has gone through the
     picker), the value is `null`. The new segment renders with
     the dashed-outline / blank-fill state per US-ENV-4
     criterion 3, and the R-value label flags "unfinished" per
     US-ENV-10.
   - The store entry updates whenever a user picks a material
     for any segment in this assembly via the US-ENV-7 picker.
   - Per Q-ENV-2 (project_materials indirection) + Q-ENV-3
     (last-used inheritance with null fallback).
2. **Edit thickness** (V1 ref §10.2 parity):
   - Click the thickness label → opens **LayerHeightModal**.
   - Single field labeled `"Layer Height [mm]"` or `"[in]"` per
     active unit system. `step="any"` so decimals allowed.
     Default value = current thickness in the active unit; on
     focus, full-select.
   - Tooltip on the input: a per-unit cheat sheet matching V1's
     `parse_input` (PH-units library) acceptance — e.g. for IP
     mode: **"Tip: Use 2.5 in, 2-1/2", or 50 mm"**.
   - Submit on **Enter** or **Save** button. Validates:
     - parses through the V2 quantity-specific units utility
       (`frontend/src/lib/units/`; see PRD §11.5.3),
     - converts to mm,
     - must be `> 0` (V1 ref §2.2 / §5.2).
   - On Save, applies a JSON-Patch `replace` on
     `tables.assemblies[a].layers[l].thickness_mm` and triggers
     R-value refetch (US-ENV-10).
   - **Cancel** restores original value.
3. **Delete layer** (from inside the LayerHeightModal, V1 ref
   §10.2 parity):
   - Red full-width **"Delete Layer"** button at the bottom of
     the modal.
   - **Last-layer guard (Q-ENV-5.1):** if the assembly has only
     one layer, the Delete button is **disabled** with tooltip
     **"An assembly must have at least one layer."** UI-level
     lock matching the US-APT-2 criterion-7 pattern (V2 fix for
     V1's server-side `LastLayerAssemblyException` + alert
     pattern, V1 ref §13.3).
   - On click of an enabled Delete: shadcn `Dialog` confirm —
     title **"Delete layer?"**, body **"This will remove the
     layer and all its segments, photos, and datasheets from
     this version. Save or Save As to persist."**, buttons
     **Cancel** / **Delete** (destructive variant).
   - On confirm: remove the layer; shift `order` of subsequent
     layers down by 1; trigger R-value refetch.
4. **Read-only on locked versions / for Viewers.** Modal opens
   in read-only mode (input disabled; Delete hidden).
5. **All mutations flow through the draft buffer.**

### Resolved questions (2026-05-10)

- **Q-ENV-5.1: Last-layer guard — UI lock or backend exception?**
  **Resolved:** UI lock at the Delete button level (criterion
  3). Mirrors US-APT-2 criterion 7's pattern.

### Open questions
None — V1 parity covered.

---

## US-ENV-6 — Segment operations (add, edit properties, delete)

**Status:** Draft · **Priority:** MVP
**V1 ref:** §9.3 (add/delete flows), §10.3
(SegmentPropertiesModal), §13.3 (last-segment rule)

### Story
> As an editor, I want to add segments left or right of any
> segment, edit a segment's properties (material, width,
> continuous-insulation flag, steel-stud cavity flag and
> spacing), and delete a segment when needed, so I can compose
> heterogeneous layers (steel-stud cavities, hybrid wall
> sections) — and so I can mark each segment's design-spec
> readiness.

### Acceptance criteria

1. **Add segment** — two paths (matches V1 ref §9.3):
   - Hover **+ Add Segment Left** or **+ Add Segment Right** on
     a segment.
   - On click: insert a new segment at the appropriate position.
     **`project_material_id` resolution** (per Q-ENV-3
     resolution):
     1. **Primary** — the source (adjacent) segment's
        `project_material_id` if non-null. The new segment
        references the same `project_materials` row → shares
        datasheet, spec-status, notes. This matches V1's
        "inherit material only on add" parity.
     2. **Fallback** — if the source segment is itself null,
        use the assembly's last-picked material from the
        Zustand store
        (`lastPickedMaterialByAssembly[<assembly.id>]`).
     3. **Final fallback** — if both are null (e.g. brand-new
        assembly with nothing picked yet), the new segment is
        also `null`. Renders dashed-outline per US-ENV-4
        criterion 3.
     Other defaults:
     - `width_mm: 50.0` (V1 default; V1 ref §9.3)
     - `steel_stud_spacing_mm: null`
     - `is_continuous_insulation: false`
     - `photo_asset_ids: []`
   - Order index of every segment at or after the insertion
     point shifts by +1.
   - Rationale: source-segment-wins is the V1 parity behavior
     and matches the typical "split a layer into a hybrid"
     intent. The last-picked fallback handles the
     starting-from-empty case (a new assembly where the user
     has picked something for layer 1 segment 1 and is now
     building outward) so they don't get null segments
     spawning off null neighbors.

2. **Edit properties — SegmentPropertiesModal** (V1 ref §10.3
   parity, restructured per Q-ENV-2):
   - Trigger: click the segment (when not in pick/paste mode).
   - Modal title: `"Segment: {project_material.name}"` —
     resolved through the segment's `project_material_id`;
     updates live as the material picker changes.
   - Fields, top to bottom:
     1. **Material picker** — bookshelf flow (US-ENV-7).
        Resolves to a `project_material_id` (de-dupes by
        catalog_record_id per Q-ENV-2 rule 1). Shadcn
        `Combobox`/`Command` primitive. Grouped by category;
        search matches `name`, `category`. Empty-state
        replacement for V1's `NoMaterialsException`
        (V1 ref §13.8): "No materials in the catalog yet —
        [Open catalog manager]".
     2. **"Shared with" indicator** (NEW v.s. V1) — small
        meta line directly below the picker:
        - `"Shared with 3 other segments in this project"`
          (when project_material is referenced by ≥2 segments).
        - `"Used in this segment only"` (when only one
          reference).
        Hover: tooltip lists the other use-sites
        ("WALL-C3 · Layer 2 · seg 1; FLOOR-FC3R · Layer 3 ·
        seg 1"). This makes the project-materials sharing
        explicit so the user understands edits propagate.
     3. **Material Data** read-only block — Name, Category,
        Conductivity (SI: W/(m·K)) **OR Resistivity (IP:
        R-value/in)**, Density, Specific Heat, Emissivity.
        Values come from the resolved `project_materials` row.
        Each value renders `--` if null. **V2 respects active
        unit system** (V1 ref §10.3 already did this in the
        Assemblies-tab modal; V1 *Materials*-tab DetailsModal
        was hard-coded SI per V1 ref §12.8 — also fixed in V2
        US-ENV-13).
     4. **"Edit material values" expander** — when expanded,
        the read-only block becomes editable; saving the modal
        edits the `project_materials` row directly. **Banner
        inside the expander when shared:** *"Editing applies to
        all 4 segments using this material. To override values
        for this segment only, [Detach to a new material]."*
        — the Detach link creates a hand-entered
        `project_materials` row clone and re-points the segment
        to it. (Q-ENV-7.3 — see open questions.)
     5. **Segment Width** — number input with unit-aware
        parsing. `"Segment Width [mm]"` / `"[in]"` per active
        unit system. `step="any"`. Validates `> 0` (V1 ref §2.3).
     6. **Continuous Insulation** checkbox — `"Continuous
        Insulation (for steel-stud assemblies)"`. **Per-segment**
        flag (NOT moved to project_materials; this describes
        *how this segment functions in this layer*, not a
        product property).
     7. **Steel Stud Cavity** checkbox — `"Steel Stud Cavity"`.
        Per-segment. When checked, reveals **Steel Stud Spacing**
        field below.
     8. **Steel Stud Spacing** (conditional) — number input,
        unit-aware. Default if currently null: `406.4 mm`
        (≈ 16", V1 default).
   - **Specification Status, datasheets, notes are NOT in this
     modal in V2.** They live on the `project_materials` row
     and are edited from the Specifications sub-tab (US-ENV-13).
     A small **"Open material in Specifications →"** link at
     the bottom of the modal jumps to the row in the
     Specifications view scrolled-into-view + briefly
     highlighted. (Replaces the V1 pattern of editing spec /
     notes inline per-segment in V1 ref §10.3 / §12.8 — the V2
     restructure consolidates these to the material primary.)
   - Buttons: **Cancel** (restore original values) / **Save**
     (one atomic JSON-Patch — replaces V1's 4-PATCH-then-Save
     chatter and partial-failure risk; V1 ref §13.14).
3. **Delete segment** (from inside SegmentPropertiesModal):
   - Red full-width **"Delete Segment"** button at the bottom.
   - **Last-segment guard:** if the layer has only one segment,
     button is disabled with tooltip **"A layer must have at
     least one segment."** UI-level lock matching US-ENV-5
     criterion 3.
   - On click of an enabled Delete: shadcn `Dialog` confirm —
     title **"Delete segment?"**, body **"This will remove the
     segment and its site photos from this version. The
     project's material record (datasheet, spec-status, notes)
     is unaffected. Save or Save As to persist."**, buttons
     **Cancel** / **Delete**.
   - On confirm: remove the segment from the layer; shift
     `order` of subsequent siblings down by 1; clear copy/paste
     state if the deleted segment was the source; trigger
     R-value refetch.
   - **`project_materials` row is preserved** even if the
     deleted segment was the last reference (per Q-ENV-2
     rule 5) — the row surfaces in the Specifications view as
     "Unused" until the user explicitly removes it there.
4. **Read-only on locked versions / for Viewers.** Modal opens
   in read-only mode (inputs disabled; Delete hidden).
5. **All mutations flow through the draft buffer** as a single
   JSON-Patch (vs V1's 4-PATCH chatter; V1 ref §13.14).

### Resolved questions (2026-05-10)

- **Q-ENV-6.1: Where does the user edit specification_status —
  in this modal, in the Specifications sub-tab, or both?**
  **Resolved (revised after Q-ENV-2 restructure):** **only in
  the Specifications sub-tab.** Specification status moved to
  the `project_materials` row level per Q-ENV-2 — it's
  per-material, not per-segment, so the segment-edit modal is
  not the right place. SegmentPropertiesModal carries an
  **"Open material in Specifications →"** link to jump there
  with the right row scrolled-into-view.

### Resolved questions (2026-05-10) — additional

- **Q-ENV-6.2: "Detach to a new material" workflow (criterion
  2.4 banner).** Resolved 2026-05-10. Confirmed all four
  sub-decisions:
  (a) **Inline confirmation in-modal:** "This will create a new
      project material '<source> (Custom)' that isn't shared
      with other uses. Continue?" — no full-screen confirm, no
      auto-detach-with-undo.
  (b) **Default name** on the cloned row: `"<source> (Custom)"`;
      user can rename in the same flow before committing.
  (c) **Clone is hand-entered** — `catalog_origin: null`. The
      detached row no longer participates in refresh-from-catalog
      (US-ENV-11) since it's diverged by intent. Detach is "fork
      from catalog," not "diverge but stay tracked."
  (d) **Clone inherits** `datasheet_asset_ids` and
      `specification_status` from source. Rationale: if the user
      is detaching to tweak conductivity but the datasheet still
      applies, they shouldn't lose the QA record. They can clear
      either field manually if no longer relevant.

  Implementation notes for US-ENV-6 build:
  - Detach is the only path to per-segment material overrides
    without touching other uses; no other "edit this segment's
    material in isolation" gesture exists.
  - The cloned row is **always created fresh** (new
    `pmat_<ULID>`); we never re-use a previously-detached
    "Custom" row even if its name and conductivity match.
  - Surface a toast post-detach: "Detached. New project material
    'XPS (Custom)' created — edit it in Specifications to apply
    different values."

---

## US-ENV-7 — Pick material (bookshelf flow with project_materials de-dup)

**Status:** Draft · **Priority:** MVP — **the key V2 shift**
**PRD ref:** §7.1 (bookshelf semantics), §7.4 (refresh from
catalog), §6.2 (`catalog_origin` block; restructured per Q-ENV-2)
**V1 ref:** §10.3 (V1 Material picker — live-referenced),
§13.2 (no per-project filter), §13.16 (no first-class catalog UI
in V1)

### Story
> As an editor, when assigning a material to a segment, I want
> to browse the shared Materials catalog (grouped by category,
> sortable, searchable), see live performance data (conductivity,
> density, specific heat, emissivity), pick one, and have its
> values copied into my project's document — automatically
> de-duplicated against any prior use of the same product so my
> project's material list mirrors the actual product set, not
> the per-segment use count.

### Acceptance criteria

1. **Where the picker lives.** Inside the SegmentPropertiesModal
   (US-ENV-6 criterion 2.1). Also reachable from the
   Specifications sub-tab when re-assigning a segment to a
   different material (US-ENV-13). Combobox-style trigger; opens
   a popover with search + grouped list.

2. **Picker open behavior.**
   - Trigger: click the chip showing the current material name.
     If unset (per Q-ENV-3 lean), trigger reads
     **"Pick a material…"**.
   - Opens a popover with **two sections**, in order:
     - **"In this project"** — every existing
       `project_materials` row in the active version's body,
       sorted alphabetically. Picking from here re-points the
       segment to an existing project-material (no new row
       created).
     - **"From catalog"** — every catalog row, grouped by
       category alphabetically, then by name within each group
       via `naturalSortCompare`. Picking from here either
       re-uses an existing project_materials row matching by
       `catalog_record_id` (de-dup; criterion 4) or creates a
       new one.
   - Search input (autofocus) — matches `name`, `category`
     (case-insensitive substring) across both sections.
   - **No manufacturer filter in V2 v1** per Q-ENV-6 lean.
   - Each row shows: bold `name`, secondary line with
     conductivity / density / spec-heat (SI) or resistivity
     (IP). **Active unit system** — V2 fix vs V1 ref §12.8
     hard-coded SI. Empty values render as `--`.
   - **In-this-project rows** carry an extra meta line:
     `"Used in 3 segments"` — so the user can tell at a glance
     which products are already heavily used.
   - **Catalog rows that match an existing project_materials
     row** (by `catalog_record_id`) display with a subtle
     **"Already in this project"** tag → picking still works
     (re-points to the existing row).

3. **Project-materials de-dup rules** (Q-ENV-2 mechanism in
   action):
   - Picking a **catalog** row whose `catalog_record_id` already
     matches an existing `project_materials.catalog_origin.catalog_record_id`
     in the active version → segment's `project_material_id` is
     set to that existing row's id. **No new row.** Datasheet,
     spec-status, notes are inherited.
   - Picking a **catalog** row whose `catalog_record_id` does
     **not** match any existing `project_materials` row → a new
     `project_materials` row is created with the catalog values
     inlined + a fresh `catalog_origin` block. Segment points
     to it.
   - Picking an **existing project_materials** row from the
     "In this project" section → segment re-points; no new row.
   - **Hand-enter** (criterion 5) → always creates a new row.

4. **What lives on the project_materials row** (Q-ENV-2 model):
   ```jsonc
   {
     "id": "pmat_<ULID>",
     "name": "Walltite ECO",
     "category": "Spray Foam",
     "conductivity_w_mk": 0.034,
     "density_kg_m3": 35,
     "specific_heat_j_kgk": 1500,
     "emissivity": 0.9,
     "color": "#dce6f0",
     "specification_status": "na",
     "datasheet_asset_ids": [],
     "notes": null,
     "catalog_origin": {
       "catalog_table": "materials",
       "catalog_record_id": "rec123abc",
       "catalog_version_id": "rec123abc_v3",
       "synced_at": "2026-05-10T14:23:00Z",
       "local_overrides": []
     }
   }
   ```
   (Exact field set is the ProjectMaterial Pydantic model —
   matches V1 ref §2.4's product-data fields + V2's project-
   level QA fields, with the AirTable string `id` replaced by a
   ULID and `catalog_origin` added.)

5. **Hand-entered values.** A "+ Hand-enter…" entry at the
   bottom of the picker opens an inline mini-form (name,
   category, conductivity, density, specific-heat, emissivity).
   On Save, creates a new `project_materials` row with no
   `catalog_origin`. Segment points to it. The row gets a small
   handwritten badge in the chip — tooltip: **"Hand-entered.
   Not linked to the catalog."**

6. **After the first pick, the project owns its copy.** Editing
   the catalog row (in the catalog manager) does NOT change the
   `project_materials` row. To re-sync, run Refresh-from-catalog
   (US-ENV-11) — operates on the project_materials row, not on
   individual segments.

7. **Inline override** — editing the project_materials row's
   values affects every segment that references it. Per
   Q-ENV-2 rule 3, this is the deliberate trade-off: shared
   identity = shared values. Two paths to override:
   - **Edit values for the shared material** (default path) —
     opens the project_materials row's editor (in-modal expander
     per US-ENV-6 criterion 2.4 OR via the Specifications-tab
     inline editor in US-ENV-13). Adds the edited field key to
     `catalog_origin.local_overrides` so refresh-from-catalog flags
     it as an intentional project-specific value.
   - **Detach to a new material** (per Q-ENV-6.2) — for
     "I want WALL-C3 segment 1's XPS to have a different value
     from FLOOR-FC3R segment 2's XPS." Clones the
     project_materials row, re-points the current segment, and
     leaves all other segments using the original.

8. **"Sourced from catalog" badge.** Each material chip shows a
   small `Library` icon when the resolved project_materials row
   has a non-null `catalog_origin`. Hover tooltip: **"From
   catalog: 'Walltite ECO' · Synced 2026-05-10. Catalog has
   changed since pick — refresh to update."** (suffix only
   when drift detected).

9. **Empty catalog.** If the Materials catalog is empty, the
   "From catalog" section shows: **"No materials in the catalog
   yet. [Open catalog manager]"** linking to the catalog page
   in a new tab. Replaces V1's `NoMaterialsException`
   hard-fail (V1 ref §13.8). The "In this project" section is
   still functional (lists prior project_materials, including
   hand-entered).

10. **All edits flow through the draft buffer.**

11. **R-value live-recompute.** After every pick / inline edit,
    the active assembly's effective R-/U-value (US-ENV-10)
    recomputes (300 ms debounce; immediate on assembly switch).
    **All assemblies referencing the same project_material**
    recompute too (since values may have changed).

12. **Read-only on locked versions / for Viewers.** Picker
    disabled; chip renders as a static label with the badge.

### Resolved questions (2026-05-10)

- **Q-ENV-7.1 (Resolved):** Inline override field set =
  full ProjectMaterial Pydantic field set, with rarely-used
  fields (`emissivity`, `color`) under a "More fields…"
  expander. Mirrors Q-APT-4.1. (Editing applies to the
  project_materials row, with shared-segments banner per
  US-ENV-6 criterion 2.4.)
- **Q-ENV-7.2 (Resolved):** Promote hand-entered material into
  catalog — deferred to v1.1+; not in MVP. Mirrors Q-APT-4.4.
- **Q-ENV-7.3 (NEW, Resolved):** Picker shows existing
  project-materials in their own section above the catalog
  list, so users can re-use the same product across assemblies
  without searching the global catalog every time. The "Already
  in this project" tag on duplicated catalog rows makes the
  shared-identity behavior explicit.

### Open questions
None — all US-ENV-7 questions resolved 2026-05-10. (Detach
behavior open under Q-ENV-6.2 in US-ENV-6.)

---

## US-ENV-8 — Orientation (flip orientation, flip layers)

**Status:** Draft · **Priority:** MVP
**V1 ref:** §11.4 (AssemblyToolbar), §13.4 (two flip operations
are independent), §17 quick-reference checklist item 7

### Story
> As an editor, I want two distinct buttons — one to flip which
> end of the layers list is "outside" (flip orientation, layers
> untouched), and one to physically reverse the layer order
> (flip layers, orientation enum untouched) — so I can correct
> a misordered import or mirror an assembly without losing the
> distinction.

### Acceptance criteria

1. **Two buttons in the AssemblyToolbar** (V1 ref §11.4):
   - **Flip Orientation** (`SwapVert` icon) — toggles
     `assembly.orientation` between `first_layer_outside` and
     `last_layer_outside`. Layers untouched.
     Tooltip: **"Flip interior / exterior orientation"**.
   - **Flip Layers** (`Flip` icon) — physically reverses the
     order of `assembly.layers` (and re-numbers their `order`
     fields). Orientation enum untouched. Tooltip: **"Reverse
     layers from inside to outside"**.
2. **The "true mirror" requires both** — V1 documents this as a
   deliberate design choice (V1 ref §13.4). V2 keeps the
   distinction. **Optional v1.1+ shortcut:** a "Mirror assembly"
   menu item that calls both atomically. Defer.
3. **Both operations** apply as JSON-Patch to the draft body.
   Trigger R-value refetch (US-ENV-10).
4. **Disabled state.** Both buttons disabled when no assembly
   is selected, when in pick / paste mode, or when the active
   version is locked.
5. **Visual feedback.** After click, the canvas's
   "interior" / "exterior" labels and / or layer order update
   immediately (no toast — the visual change is the feedback).

### Open questions
None — V1 parity confirmed.

---

## US-ENV-9 — Copy / paste material assignments

**Status:** Draft · **Priority:** MVP (promoted from Placeholder
2026-05-10 after all three structural questions resolved)
**V1 ref:** §6.3 (CopyPaste context), §9.4 (canvas state
machine), §11.4 (toolbar), §13.14 (per-target 5-PATCH chatty
behavior — fixed in V2)

### Story

> As an editor, when I've nailed the material assignment for
> one segment, I want to apply that same assignment to other
> segments in the active assembly with a two-click
> eyedropper-then-paint-bucket gesture — without re-walking the
> material picker each time — so building out hybrid stud-and-
> insulation layers stays fast.

### Acceptance criteria

1. **Toolbar buttons** in the assembly header (US-ENV-3
   criterion 1):
   - **Eyedropper** icon button — enters "pick" mode.
   - **Paint-bucket** icon button — enters "paste" mode (only
     enabled after a pick has been made).
   - **Undo-last-paste** icon button — same as V1 ref §11.4
     parity. Disabled when paste history is empty for the
     active assembly.
   - All three buttons hidden on locked versions and on view-
     links.

2. **State machine** (V1 ref §9.4 parity):
   - `idle` → click eyedropper → `picking` (cursor changes to
     eyedropper)
   - `picking` → click source segment → `picked` (eyedropper
     resets; paint-bucket lights up; source segment shows a
     subtle "this is the source" highlight)
   - `picked` → click paint-bucket → `pasting` (cursor changes
     to paint-bucket)
   - `pasting` → click target segment → paste applied + 600 ms
     paste-pulse animation on target → stays in `pasting`
     state (so user can keep clicking more targets without
     re-clicking the toolbar — V1 ref §6.3 parity)
   - **ESC** at any non-idle state → return to `idle`, drop
     source.
   - **Click outside any segment** during `picking` or
     `pasting` → return to `idle`, drop source.

3. **Copy payload — 3 fields** (Q-ENV-2 simplification of V1's
   5-field payload):
   ```typescript
   {
     project_material_id: string | null,
     steel_stud_spacing_mm: number | null,
     is_continuous_insulation: boolean
   }
   ```
   - `project_material_id` carries the **reference** to the
     `tables.project_materials[]` row — so the target's
     `specification_status`, `notes`, and `datasheet_asset_ids`
     automatically stay in sync with the source's material
     (they live on the project_material row, not on segments).
     This is a side-benefit of the Q-ENV-2 restructure: V1's
     `specification_status` and `notes` were per-segment fields
     that had to be explicitly copied; V2 makes them follow
     the material by reference, so copy/paste does less work
     but produces a more-correct result.
   - **NOT copied** (target keeps its own values): `width_mm`,
     `photo_asset_ids`. Same explicit contract as V1 ref §6.3.
   - **Width is preserved per target** — common case is
     "stamp this material onto an existing differently-sized
     segment," so we don't blow away the geometry the user
     already set.

4. **Single JSON-Patch per paste-target** (V2 cleanup of V1
   ref §13.14). V1 emitted 5 separate PATCH requests per
   paste-target (one per field), risking partial-failure
   inconsistency mid-paste. V2 paste = **one JSON-Patch**
   with multiple `replace` ops covering the 3 payload fields,
   atomic at the draft-buffer level.

5. **No cross-assembly paste** (V1 parity per Ed 2026-05-10).
   Switching the active assembly clears all pick/paste state
   (source, target history, mode) — paste cannot cross
   assemblies. Cross-assembly copy in v1.1+ can be revisited
   if a real workflow surfaces; the project_materials de-dup
   model makes it trivially easy to add later (target segment
   in a different assembly would just reference the same
   `project_material_id`), so the deferral is purely a UX
   call, not a data-model constraint.

6. **No multi-select paste in V2 v1** (Ed 2026-05-10). One
   click = one target. Mirror of US-APT-7 deferred-NEW. v1.1+
   candidate.

7. **No keyboard shortcuts (⌘C / ⌘V) on the envelope canvas**
   (Ed 2026-05-10). The toolbar buttons + ESC + ⌘Z (undo) are
   the entire interaction surface. v1.1+ may revisit after
   real usage patterns surface.

8. **Bounded undo stack — 20 entries per active assembly**
   (V1 ref §6.3 `MAX_UNDO_STACK_SIZE` parity).
   - **⌘Z** undoes the last paste; subsequent ⌘Z presses pop
     the stack further. Beyond 20 entries the oldest entries
     fall off silently.
   - **Undo-last-paste toolbar button** is the explicit
     mouse-driven equivalent (V1 ref §11.4).
   - Undo stack is **per-assembly, in-memory only** — cleared
     on assembly switch (criterion 5) and on document /
     version switch. Not persisted in the project document.

9. **Refetch R-value after every successful paste** —
   paste mutates `project_material_id` and potentially the
   stud / CI fields, all of which are in the US-ENV-10
   refetch-trigger set (criterion 7 there). Backend
   content-hash changes; frontend invalidates and refetches.

10. **Visual feedback during pick/paste mode:**
    - Source segment (in `picked` / `pasting` state): subtle
      ring outline (CSS var `--copy-source-ring`) so the user
      remembers where the assignment came from.
    - Target segment on paste-click: 600 ms pulse animation
      (CSS var `--paste-pulse-duration`; V1 parity).
    - Canvas hover-`+` add-segment / add-layer buttons
      **hidden while in pick / paste mode** (already captured
      in US-ENV-4 criterion 5 — listed there as one of the
      hover-button-visibility gates).
    - SegmentPropertiesModal does NOT open on click while in
      pick / paste mode (US-ENV-4 criterion 3, US-ENV-6
      criterion 2.1 already capture this).

11. **Locked-version + Viewer rendering.** Toolbar buttons
    hidden entirely. Click on a segment opens the read-only
    SegmentPropertiesModal as normal. Undo button hidden.

12. **All paste state is ephemeral frontend state** — lives
    in the envelope-builder Zustand store (likely as
    `pickPasteState: { mode, sourcePayload, undoStack[20] }`)
    keyed per `assembly_id`. Not part of the project document.
    Clears on document / version / assembly switch.

### Resolved questions (2026-05-10)

- **Cross-assembly paste?** Resolved: **no — V1 parity.**
  State clears on assembly switch. Data model supports
  cross-assembly trivially (de-dup via shared
  `project_material_id`), so v1.1+ can lift this without
  schema work.
- **Multi-select paste?** Resolved: **defer to v1.1+.** One
  click = one target.
- **Keyboard shortcuts (⌘C / ⌘V) on canvas?** Resolved:
  **defer to v1.1+.** Toolbar + ESC + ⌘Z only.

### Open questions
None outstanding.

### Cross-references

- **US-ENV-3 criterion 1** — assembly toolbar layout includes
  Eyedropper / Paint-bucket / Undo-last-paste.
- **US-ENV-4 criteria 3 + 5** — hover-`+` buttons hide,
  click-handler routes to copy/paste state machine instead of
  modal during pick/paste mode.
- **US-ENV-6 criterion 2.1** — SegmentPropertiesModal trigger
  defers to copy/paste state machine when in pick/paste mode.
- **US-ENV-10 criterion 7** — R-value refetch trigger
  includes `project_material_id` / `steel_stud_spacing_mm` /
  `is_continuous_insulation`, all in the copy payload.
- **Q-ENV-2 resolution** — drives the 3-field payload (was 5
  in V1; `specification_status` and `notes` now ride along by
  reference).

---

## US-ENV-10 — Effective R-value / U-value display

**Status:** Draft · **Priority:** MVP (promoted from Placeholder
on 2026-05-10 after Q-ENV-4 resolution unblocked this story)
**PRD ref:** §6.2 (assembly shape), §10.4 (glossary location)
**V1 ref:** §5.5 (full thermal-resistance service), §11.2
(EffectiveRValueLabel), §13.5 (surface-film divergence —
resolved per Q-ENV-4)
**Convention reference:** `context/GLOSSARY.md` — Thermal
performance section. V2 shows only U-Value / R-Value (no
films); never U-Factor / R-Factor.

### Story

> As an editor, I want a single live thermal-resistance number
> in the assembly header that tells me how good my layer-stack
> is, computed the same way our certified projects' deliverables
> compute it, with surface-film handling that's unambiguous and
> consistent with the downstream simulation tools — so the
> number I see in PHN is the number I can stand behind in a
> design review.

### Acceptance criteria

1. **Where it renders.** Inside the assembly header (US-ENV-3
   criterion 3). Single label next to Total Thickness. Hidden on
   the empty Equipment / Status / Model tabs since this is an
   envelope-specific surface.

2. **Label text — per active unit system:**
   - **IP:** `Effective R-Value: 15.5` (1 decimal,
     hr·ft²·°F/BTU). Matches V1's exact rendering (see V1
     screenshot, 2026-05-10).
   - **SI:** `Effective U-Value: 0.36 W/m²K` (3 decimal places).
   - **No "Factor" variant is rendered in V2 v1** (per Q-ENV-4
     resolution). The construction-only value is the only
     honest one PHN can produce without orientation data.
   - Renders `--` while the calc is in flight or when the
     active assembly is `null`.

3. **Info icon** (`InfoOutlined` shadcn icon) sits to the right
   of the value. Hover / focus opens the tooltip:

   > **Effective Thermal Resistance**
   >
   > Calculated using the Passive House method: the average of
   > the Parallel-Path and Isothermal-Planes methods.
   >
   > Note: Surface film resistances (air films) are NOT
   > included in the value shown here.
   >
   > This matches Honeybee's `OpaqueConstruction.u_value` /
   > `r_value` convention. The films-included U-Factor depends
   > on assembly orientation (wall / floor / roof) and is
   > computed by the downstream simulation tool (WUFI, PHPP,
   > EnergyPlus) — not by PHN.
   >
   > *Reference: ASHRAE Handbook – Fundamentals, Chapter 27*

4. **Backend calculation** — service ports V1's
   `backend/features/assembly/services/thermal_resistance.py`
   to the V2 model shape (`tables.assemblies[*]` referencing
   `tables.project_materials[*]` per Q-ENV-2). Algorithm
   unchanged:
   - PH-average of **Parallel-Path** and **Isothermal-Planes**
     per ASHRAE Handbook Ch 27.
   - Steel-stud cavity layers run through the **AISI S250-21**
     equivalent-conductivity subroutine. **`R_SE = 0,
     R_SI = 0` passed to the subroutine** (matches V1's
     `thermal_resistance.py` policy and the Q-ENV-4
     resolution). Films never enter PHN's internal calc.
   - Returns `ThermalResistanceSchema` matching V1 ref §2.6
     (`r_effective_si`, `u_effective_si`, `is_valid: bool`,
     `warnings: list[str]`).

5. **`min-width: 200 px`** on the label container to prevent
   layout shift when the value changes from `--` to a number.

6. **Caching.** Backend keys the cached result by a
   **content-hash of the assembly subtree** (`layers[]`,
   `segments[]`, referenced `project_materials[]` entries —
   only the conductivity / thickness fields that affect the
   calc). Frontend refetches on hash change, not on every
   keystroke. Same hashing pattern V1 uses (V1 ref §10.1 of
   the Window-Builder reference for the parallel pattern).

7. **Refetch trigger.** Frontend invalidates the cache and
   refetches whenever any of these mutate in the draft buffer:
   - `tables.assemblies[<a>].layers[*].thickness_mm`
   - `tables.assemblies[<a>].layers[*].segments[*].width_mm`
   - `tables.assemblies[<a>].layers[*].segments[*].steel_stud_spacing_mm`
   - `tables.assemblies[<a>].layers[*].segments[*].is_continuous_insulation`
   - `tables.assemblies[<a>].layers[*].segments[*].project_material_id`
   - `tables.project_materials[<p>].conductivity_w_mk` (when
     referenced by any segment in the active assembly).
   - Debounced ~500 ms after the last edit.
   This follows the shared DataTable/computed-field contract:
   effective R-/U-value is a backend-owned computed overlay derived
   from draft inputs, not an editable value stored in
   `project_versions.body`.

8. **"Unfinished" qualifier** (per Q-ENV-3 resolution). When
   **any** segment in the active assembly has
   `project_material_id === null`, the label gains a clear
   "unfinished" qualifier so the user understands the
   displayed value is over the picked segments only:

   - **Compact form:** `Effective R-Value: 12.3 (unfinished)` —
     italic, muted-foreground color. Tooltip extends with:
     *"3 segments are missing a material. The value above is
     computed from the picked segments only. The canvas
     highlights the unfinished segments with a dashed
     outline."* (Mirrors the US-ENV-4 criterion 3
     dashed-outline affordance.)
   - The number itself **still renders** — we don't suppress
     it. Half-finished assemblies are useful design feedback.

9. **Invalid-assembly state.** When the backend returns
   `is_valid: false` (empty layers, zero conductivity, etc.),
   the label renders `--` with a small warning icon. Tooltip
   appends the backend's `warnings` array as a list. V1
   silently rendered nothing on invalid (V1 ref §11.2); V2
   surfaces the *why* explicitly.

10. **Loading state.** While the request is in flight (after
    a debounced cache invalidation), the label renders `…`
    with a low-opacity tween. No skeleton needed.

11. **Locked-version + Viewer rendering.** Label and
    tooltip work identically — the value is data, not edit
    state. Refetches if the active version changes (different
    body → different subtree hash → different cache key).

12. **No "U-Factor" or "R-Factor" toggle in V2 v1.** If a user
    asks for a films-included value, the answer is the tooltip
    text plus "the downstream simulation tool computes it from
    your HBJSON." A v1.1+ feature could optionally surface
    `u_factor` (computed using Honeybee's simple ISO 10292
    coefficients) with a clear label like
    `"U-Factor (Honeybee simple, non-direction-dependent)"` —
    but only with a UX design that prevents confusion with the
    ASHRAE direction-dependent value most users expect.

### Resolved questions (2026-05-10)

Parent question Q-ENV-4 (surface-film convention) resolved —
see Q-ENV-4 in the US-Builder-Envelope architectural-decisions
section. No US-ENV-10-specific open questions.

### Open questions
None outstanding.

### Cross-references

- **US-ENV-3 criterion 3** — header layout, includes this label.
- **US-ENV-4 criterion 3** — canvas dashed-outline rendering for
  null-material segments (the visual companion to criterion 8
  here).
- **US-ENV-12 (HBJSON export)** — uses the same `R_SE=0,
  R_SI=0` policy for the steel-stud equivalent-conductivity
  written into HBJSON. See Q-ENV-4 resolution for the V1 bug
  fix this corrects.
- **`context/GLOSSARY.md` — Thermal performance section** —
  authoritative definitions of U-Value / U-Factor / R-Value /
  R-Factor and the rationale for PHN's policy.

---

## US-ENV-11 — Refresh-from-catalog (per-segment material re-sync)

**Status:** Draft · **Priority:** MVP — **NEW in V2**
**PRD ref:** §7.4 (refresh-from-catalog UX)
**V1 ref:** none — V1's Materials are live-referenced and silently
purged (V1 ref §13.9); V2 is bookshelf

### Story
> As an editor, when a material in the catalog has been updated
> since I picked it (vendor reformulation, catalog typo-fix,
> new datasheet), I want a per-segment "refresh from catalog"
> gesture that shows me the diff and lets me decide which
> values to keep — without forcing me to re-pick from scratch.

### Acceptance criteria

1. **Drift detection.** A segment's material is "drifted from
   catalog" if `material.catalog_origin.catalog_version_id !=
   catalog_materials.current_version_id`. Computed at read
   time. **Identical mechanism to US-APT-11** for frame /
   glazing.
2. **Surfaces.**
   - **Per-segment badge** — material chip in the
     SegmentPropertiesModal AND in the Specifications-tab row
     (US-ENV-13) shows a `RefreshCw` overlay when drifted.
     Hover tooltip: **"Catalog has changed since pick. Click
     to review."**
   - **Per-tab drift summary** — small banner at the top of the
     Assemblies sub-tab when *any* drift exists in the active
     assembly's segments: **"3 segments drifted from catalog
     [Review all]"**.
   - **Across-the-project report** — accessible from the project
     header `⋯ → Catalog drift report`. Per PRD §7.4 final ¶,
     "lives in the catalog manager view of a project." Shared
     surface with US-APT-11's drift report.
3. **Per-segment refresh dialog.** Mirrors US-APT-11
   criterion 3 — three-column diff (Catalog · Yours · Choose),
   per-row radio + bulk actions, **Save** writes the chosen
   values into the document, updates
   `catalog_origin.catalog_version_id = current_version_id`,
   sets `catalog_origin.synced_at = now()`, and recomputes
   `catalog_origin.local_overrides`.
4. **Diverged user-edited fields** (per Q-ENV-7.1 inline-
   override pattern): rows tagged with **"You edited this"** and
   defaulted to **Keep mine** when their field key is in
   `catalog_origin.local_overrides`, so the user doesn't forget why
   their value differs.
5. **No bulk "refresh everything" auto-apply** in v1 (PRD §7.4
   + §17 question 9 lean shared with US-APT-11). **Review all** opens
   the drift report with per-entry actions; it does not auto-apply
   multiple materials.
6. **Read-only on locked versions / for Viewers.** Drift badges
   still show; refresh dialog unavailable.
7. **All changes flow through the draft buffer.**
8. **Catalog-schema migration deferred from MVP** (PRD §7.5).
   Materials store `catalog_schema_version: 1` in copied
   `catalog_origin` payloads as a future hook, but MVP
   refresh-from-catalog compares current MVP field names only.
   Catalog-row shim chains, renamed-field metadata, golden
   fixtures, and production-corpus drills are post-MVP.

### Resolved questions (2026-05-10)

- **Q-ENV-11.1: Drift compared to what?** **Resolved (mirrors
  Q-APT-11.1):** drift only when `catalog_version_id !=
  current_version_id`. Intermediate non-current versions don't
  trigger. If `local_overrides` is non-empty while the catalog version
  is current, the material is customized, not stale.
- **Q-ENV-11.2: Renamed-field handling in diff.** **Resolved
  (revised 2026-05-11):** catalog-schema migration tooling is
  deferred from MVP and kept as a post-MVP goal. MVP stores
  `catalog_schema_version: 1` but does not ship renamed-field
  diff handling.

### Open questions
None for MVP — catalog-schema migration is tracked as a
post-MVP goal in PRD §7.5.

---

## US-ENV-12 — HBJSON construction export (download only)

**Status:** Draft · **Priority:** MVP (promoted from Placeholder
2026-05-10; HBJSON construction **import** dropped from MVP per
Ed)
**PRD ref:** §3 (non-goals — HBJSON construction import is
explicitly out of scope), §10.4 (glossary)
**V1 ref:** §4.1 (HBJSON routes), §5.7 (export service),
§11.3 (header overflow menu — surface placement), §13.5
(surface-film divergence — resolved per Q-ENV-4)
**Convention reference:** `context/GLOSSARY.md` — Thermal
performance section (no surface films anywhere in PHN's data;
downstream tools add them at simulation time).

### Story

> As a CPHC delivering a project to a downstream simulation
> tool (WUFI Passive, PHPP via PHX, Honeybee energy
> simulation), I want a one-click "Download constructions as
> HBJSON" action on the active project version that produces
> a Honeybee-shape `.hbjson` file containing all of the
> project's assemblies — with per-material datasheets
> referenced once per product and per-segment photos
> referenced per installation — so my downstream workflow has
> a single auditable file matching the active version.

### Scope clarification — export only

V1 supported both **import** and **export** of HBJSON
constructions (V1 ref §4.1, §5.6, §5.7). **V2 v1 ships
export only.** HBJSON construction import is dropped from
MVP per Ed 2026-05-10:

- HBJSON is **viewer-only** in V2. The Model tab (US-Viewer)
  consumes uploaded HBJSON for 3D visualization but does NOT
  write into `tables.assemblies` / `tables.project_materials`
  / any other builder table. PHN is the authoritative source.
- Rhino / Honeybee consume PHN data downstream (via GH
  components that reference PHN tables) and produce HBJSON
  as their output. There's no reverse flow.
- Same one-direction logic applies as for rooms (US-EQ-2):
  user authors in PHN; HBJSON is what comes out, never what
  goes in.
- If a real workflow need surfaces for HBJSON construction
  import (e.g. seeding a new project from an existing Rhino
  model), it lands as a separate story in v1.1+.

### Acceptance criteria

1. **Surface.** Single action in the project header `⋯` menu:
   **"Download constructions (HBJSON)"**. Mirrors Q-APT-8's
   windows-side HBJSON download placement. **No import
   action exists in V2 v1.**

2. **Per-version snapshot.** The download operates on the
   **active version's body** (`tables.assemblies[]` +
   `tables.project_materials[]` + `single_select_options[]`
   for any relevant columns). Each download is a snapshot of
   that specific version — re-downloading after a Save
   produces a different file; re-downloading after switching
   active version produces a different file.

3. **HBJSON shape.** The exported `.hbjson` is a Honeybee-
   compatible JSON object containing:
   - One `OpaqueConstruction` entry per assembly in
     `tables.assemblies[]`, named by `assembly.name`.
   - One Honeybee `EnergyMaterial` entry per unique
     `project_material` referenced by any segment in the
     exported assemblies. Materials are emitted ONCE per
     product (Q-ENV-2 de-dup carries through to the export).
   - Per-segment **photos** emit as `ImageReference` extension
     entries (Honeybee-PH custom extension) attached at the
     segment / division level within the construction. Matches
     V1 emission shape.
   - Per-`project_material` **datasheets** emit as
     `DocumentReference` extension entries attached at the
     **material level**, not duplicated per segment. (Q-ENV-12.3
     resolution: per-material emission. This differs from V1
     parity, which emitted datasheets per-segment with
     duplication. V2's per-material emission cleaner and
     matches the V2 data model.)

4. **No surface films emitted anywhere** (per Q-ENV-4
   resolution + `context/GLOSSARY.md`):
   - Per-material `r_value` values are computed with films
     excluded — matches Honeybee's `EnergyMaterial.r_value`
     "excluding air films" convention exactly.
   - Steel-stud cavity-equivalent conductivity uses
     `R_SE = 0, R_SI = 0` in the AISI S250-21 subroutine.
     **V2 fix vs V1's exporter:** V1 baked `R_SE = 0.17,
     R_SI = 0.68 hr·ft²·°F/BTU` into the cavity equivalent
     (`backend/features/assembly/services/
     to_hbe_material_steel_stud.py:27-28, 207-208`), which
     caused films to be double-counted when downstream
     consumers re-applied their own films. V2 drops these
     constants. See `context/GLOSSARY.md` (Thermal performance
     section, V1→V2 behavioral change subsection).
   - Downstream consumers (Honeybee → `u_factor`, WUFI,
     PHPP, EnergyPlus) add films **once** at the construction
     boundary at consumption time — they know which films to
     apply because they know each surface's orientation.

5. **`ph_nav` external IDs preserved on export.** Every
   emitted material carries a `ph_nav` extension block with
   `project_material_id` and (if present) `catalog_origin`.
   This is forward-compatible scaffolding — when / if v1.1+
   adds HBJSON construction import, the round-trip can
   re-link by `ph_nav` ID without depending on name matching.
   In V2 v1 this metadata is essentially unused (no import
   path), but it's cheap to emit and future-proofs the format.

6. **Multi-row PhDivisionGrid never produced.** V2 v1 only
   creates single-row segment layouts (per Q-ENV-5
   resolution). The exporter writes single-row
   `PhDivisionGrid` structures; nothing to error on.

7. **Filename convention** (per Q-ENV-12.4 resolution):
   `{bt_number}_{project_name}_{version_name}_constructions.hbjson`
   - All three components are slugified — lowercase, spaces
     converted to `-`, special characters stripped, repeated
     `-` collapsed.
   - Example: `2024-013_brooklyn-retrofit_round-2-submit_constructions.hbjson`
   - Generated client-side after the server returns the file
     content; no server-side filename storage needed.

8. **Download action permissions:**
   - **Editors:** always available (any version, locked or
     unlocked). Locked versions can be downloaded — they're
     read-only, not download-blocked.
   - **Viewers:** download available. HBJSON is a
     project deliverable; per PRD §4 (updated 2026-05-10) project
     URLs are public-readable, including downloadable artifacts.

9. **No mutation to the project document.** Export is a pure
   read-side operation; nothing flows through the draft
   buffer; no JSON-Patch ops; no version mutation.

10. **Error handling.** The only failure mode worth handling
    explicitly in v1 is a backend-side serialization error
    (malformed material data, conductivity = 0, etc.). Surface
    via a single toast: *"Couldn't generate the HBJSON file:
    {brief reason}. Please contact support if this persists."*
    The malformed-data conditions should already be caught by
    Pydantic validation upstream (PRD §6.2), so this is a
    safety net, not a primary user-facing path.

### Resolved questions (2026-05-10)

- **Q-ENV-12.1: Per-assembly export?** Resolved: **defer to
  v1.1+; whole-project only in V2 v1.** Matches V1 and the
  canonical certifier-submission workflow.
- **Q-ENV-12.3: Datasheet emission shape?** Resolved:
  **per-`project_material` (material-level), not per-segment.**
  V2 data model has datasheets at the product level (Q-ENV-2);
  emission shape matches that. Cleaner than V1's per-segment
  duplication.
- **Q-ENV-12.4: Filename convention?** Resolved:
  `{bt_number}_{project_name}_{version_name}_constructions.hbjson`,
  slugified.
- **Q-ENV-12.6: Upload UX (drag-drop vs file picker)?**
  Moot — no upload / import in V2 v1.
- **Q-ENV-12.2 / Q-ENV-12.5: Conflict policy + locked-version
  import handling?** Moot — no import in V2 v1.

### Open questions
None outstanding.

### Cross-references

- **`context/GLOSSARY.md` — Thermal performance section.**
  Authoritative source for the no-films policy and the
  steel-stud V1→V2 behavioral change.
- **Q-ENV-4 resolution.** Drives criterion 4 (no films
  anywhere; steel-stud R_SE=0/R_SI=0 fix).
- **Q-ENV-2 resolution.** Drives criterion 3 (per-product
  material emission; per-segment photo emission).
- **PRD §3 (non-goals).** Explicitly excludes HBJSON
  construction import from V2 v1.
- **PRD §14.1 (V1→V2 migration).** Captures the expected
  per-cavity `u_factor` delta for re-exported V1 steel-stud
  assemblies.
- **US-Viewer (Model tab).** The OTHER HBJSON surface in
  V2 — uploaded HBJSON used for 3D visualization only,
  no write-back to builder tables.

---

## US-ENV-13 — Specifications sub-tab (per-material primary view)

**Status:** Draft · **Priority:** MVP — **major V2 restructure**
**PRD ref:** §6.2 (per Q-ENV-2:
`tables.project_materials[]` with per-material datasheets +
spec-status + notes; `segment.photo_asset_ids` per-segment)
**V1 ref:** §12 (Material-List view, per-segment), §13.7
(segment-scoped media), §13.16 (V1 tab-name confusion)

### Story
> As a CPHC, I want a per-project view that lists every unique
> material used across all assemblies, auto-aggregated as I edit
> assemblies elsewhere, and shows — for each material — whether
> we have a manufacturer datasheet on file, what the
> specification-status is (have we received a confirmed product
> commitment from the design team?), and which segments use it
> with site-photo coverage per use. So I can sweep through a
> project at QA / certification-prep time and answer "is the
> documentation complete?" in one place.

### Why this restructures V1
V1 walked **per-segment** rows: every segment of every assembly
got its own row with its own datasheet uploader, its own
spec-status, its own notes. V1 ref §13.16 already calls this
out as confusing — the tab is about products (materials), not
about segments. V2 flips the primary axis to **per-project-
material** rows, with per-segment use as a secondary detail
(for site-photo upload). The data model change in Q-ENV-2
makes this natural: datasheets and spec-status now live at
the `project_materials` level; site photos at the segment
level.

### Acceptance criteria

1. **URL.** `/projects/{id}/envelope/specifications` (per
   Q-ENV-8 rename).
2. **Page heading.** **"Project Materials"** (matches V1's
   `<h4>` to preserve visual continuity with V1 ref §12.1
   despite the URL rename).
3. **Source.** Renders `body.tables.project_materials[]` from
   the active version's draft body (or saved body if no
   draft). Auto-aggregated by US-ENV-7's pick logic — the user
   does not manually maintain this list.
4. **Layout** — one scrollable column of **material cards**.
   Each card represents one `project_materials` row.
   Card sort order:
   - Cards with `specification_status != 'complete'` first
     (so pending QA work is at the top), within that group by
     `naturalSortCompare` on name.
   - Cards with `specification_status === 'complete'` next,
     same secondary sort.
   - **"Unused" cards** (no segment references; preserved orphans
     per Q-ENV-2 rule 5) at the bottom in a separate section
     **"Unused materials"** with a one-time onboarding line:
     *"These materials are no longer used in any assembly.
     Their datasheets and notes are preserved here in case you
     need them; clean up explicitly when ready."*
5. **Material card layout** — five regions:
   ```
   ┌───────────────────────────────────────────────────────────────────┐
   │  XPS                                            [📚][↻] · Spray Foam│   ← header
   │  Conductivity 0.034 W/(m·K) · Density 35 kg/m³                     │
   ├───────────────────────────────────────────────────────────────────┤
   │  [Missing ▾]        [+ Notes]                          ⋯           │   ← QA bar
   │                                                                    │
   │  Datasheets                                                        │
   │  ┌─────────────┬─────────────┐                                     │   ← per-material
   │  │  IMG  PDF   │   + Add     │                                     │
   │  └─────────────┴─────────────┘                                     │
   │                                                                    │
   │  Used in 4 segments:                                               │   ← per-use
   │  ┌──────────────────────────────────────────────────────────────┐  │
   │  │ FLOOR-FC3R · Layer 2 · seg 1     [photo.jpg]            ⋯    │  │
   │  │ FLOOR-FC6R · Layer 3 · seg 2     [empty — Site Photo Needed] │  │
   │  │ ROOF-RC5R  · Layer 4 · seg 1     [photo1.jpg, photo2.jpg]    │  │
   │  │ WALL-C3    · Layer 2 · seg 1     [empty — Site Photo Needed] │  │
   │  └──────────────────────────────────────────────────────────────┘  │
   └───────────────────────────────────────────────────────────────────┘
   ```

   Region details:

   **5.1 Header (top strip):**
   - Bold material name (clickable → opens material-rename inline).
   - Right-side badges:
     - `Library` icon when `catalog_origin` is non-null.
     - `RefreshCw` icon when drifted from catalog (US-ENV-11
       detection); click → opens refresh-from-catalog dialog.
   - Sub-line: category + secondary product data
     (conductivity / density / spec-heat — IP or SI per active
     unit system).

   **5.2 QA bar (second strip):**
   - **Specification Status select** — four states (V1
     palette: `complete` / `missing` / `question` / `na`).
     Mutation flows through draft buffer.
   - **Notes** affordance — when notes are empty, shows
     `[+ Notes]`; when populated, shows a speech-bubble icon
     with the notes preview as tooltip; click → opens an
     inline notes editor below.
   - **`⋯` overflow** — "Edit material values…" (opens the
     project_materials row's full-field editor; affects all
     segments using it), "Refresh from catalog…" (when
     applicable), "Delete material" (only enabled when
     `Used in: 0 segments`; otherwise tooltip "In use; remove
     from segments first").

   **5.3 Datasheets region** (per-material — Q-ENV-2 model):
   - Drag-and-drop area for one or more datasheets (PDFs or
     images). Multiple datasheets supported per material
     (a manufacturer might have multiple sheets — product +
     installation guide + cert).
   - Empty state when `specification_status != 'na'`:
     "missing" appearance — magenta border + light-magenta
     background + text **"Product Datasheet Needed"** (V1
     palette parity, V1 ref §12.4).
   - Empty state when `specification_status === 'na'`:
     disabled appearance, no upload affordance.
   - Items render as thumbnails; click → opens
     `<ImageFullViewModal>` (criterion 8). PDF detection by
     extension → iframe-based viewer (V1 ref §12.7).
   - **NEW v.s. V1:** datasheets are **per-material**, not
     per-segment, so the user uploads once per product
     regardless of how many assemblies use it. (V1 was
     per-segment; users uploaded the same datasheet
     repeatedly across copies of the same product, V1 ref
     §12.9 / §13.7.)

   **5.4 "Used in N segments" region** (per-segment —
   Q-ENV-2 model):
   - Heading: `"Used in {N} segments"` (or
     `"Not used in any assembly"` for orphans).
   - One sub-row per segment referencing this
     `project_material_id`, sorted by:
     `naturalSortCompare(assembly.name)` →
     `layer.order` → `segment.order`.
   - Each sub-row shows:
     - Path: `{assembly.name} · Layer {layer.order + 1} ·
       seg {segment.order + 1}`. Clicking the path navigates
       to the Assemblies sub-tab with that assembly active and
       the segment highlighted.
     - Per-segment site-photo zone (drag-and-drop). Same
       empty / drag-over / items-present states as V1's
       site-photo container (V1 ref §12.4). When state is
       'na' at the material level, photo upload is disabled.
     - Per-row `⋯` menu: "Re-pick material…" (opens the
       picker to swap this segment to a different
       project_material), "Open segment in canvas →" (jumps
       to the assembly), "Detach to a new material…"
       (Q-ENV-6.2 detach flow).

6. **Auto-aggregation.** The list rebuilds from
   `body.tables.project_materials[]` after every draft
   mutation. New picks add cards (or surface usage on existing
   cards); deleting the last segment using a material moves
   the card to "Unused materials".

7. **Drag-and-drop upload behavior** — same shape as V1 ref
   §12.4 with V2 cleanups:
   - Multiple files supported; per-file failures surface as a
     Sonner error toast listing names (replaces V1's
     `console.error` + per-file `alert()`).
   - Backend uploads to R2; response stores asset record;
     either `project_materials.datasheet_asset_ids[]` (for the
     per-material datasheet zone) or `segment.photo_asset_ids[]`
     (for the per-use site-photo zone) gets the new id
     appended via JSON-Patch.
   - Loading overlay during upload.

8. **ImageFullViewModal** (V1 ref §12.6 parity):
   - One full-size image OR PDF iframe view.
   - PDF detection by file extension → renders inside an
     `<iframe src=".../#toolbar=0">` (browser-native viewer,
     toolbar hidden; V1 ref §12.7).
   - **Delete** button — confirms via shadcn `Dialog`
     (replaces V1 `window.confirm`) → soft-delete the asset →
     JSON-Patch removes the id from the appropriate array
     (project_material's datasheet array OR segment's
     photo array).
   - No keyboard nav between images, no zoom/pan in v1
     (matches V1's intentional minimalism).

9. **Inline material-values editor** (US-ENV-7 criterion 7;
   reachable via `⋯ → "Edit material values…"`):
   - Opens an inline editor below the QA bar.
   - Banner when shared: *"Editing applies to all 4 segments
     using this material. To override values for one segment
     only, use the canvas's segment modal → Detach to a new
     material."*
   - Adds edited field keys to `catalog_origin.local_overrides` on save.

10. **Drift surface.** When the material's `catalog_origin`
    is drifted (US-ENV-11 detection), the header `RefreshCw`
    icon appears. A per-tab summary banner above the cards:
    `"3 materials drifted from catalog [Review all]"`. Same
    behavior as the Assemblies-tab banner (US-ENV-11).

11. **Viewer visibility rule.** V1 hides rows where
    `specification_status === 'na'` from Viewers.
    **V2 keeps this rule** but applied at the **card** level
    (whole material card hidden when n/a), not the row level.
    Viewer sees only materials with a meaningful
    spec-status set. The "Unused materials" section is also
    hidden from Viewers.

12. **Locked-version + Viewer rendering.** Spec-status
    select disabled; drag-and-drop hidden; per-image delete
    hidden; inline editors disabled. Material cards still
    render so the Viewer can see the documented set.

13. **Project Materials count chip** in the sub-tab header:
    `"24 materials · 18 with datasheets · 21 with site photos
    on every use"`. Quick at-a-glance dashboard for QA prep.

14. **Empty state.** When `tables.project_materials[]` is
    empty (brand-new project, no segments have picked
    materials yet), show: **"No materials used yet. Pick
    materials in the Assemblies tab to see them here."**
    centered with a link to `/envelope/assemblies`.

### Resolved questions (2026-05-10)
- **Q-ENV-13.1: Per-row drift surface?** **Resolved (revised
  for restructured layout):** drift surfaces at the **material
  card** header (not per-segment-row), since drift is a
  property of the project_material's catalog_origin, not of
  individual uses.

### Resolved questions (2026-05-10) — additional
- **Q-ENV-13.2: Bulk operations across material cards.**
  Resolved: **defer to v1.1+; not in MVP.** V1 had no bulk
  ops (V1 ref §12.9); V2's per-material primary collapses N
  segments → 1 card, which already removes most of the
  manual repetition that bulk-set would have addressed in a
  per-use model. If a v1.1+ user surfaces a real workflow
  that needs it (e.g. "mark all 12 insulation products
  complete after submittal review"), revisit then.
- **Q-ENV-13.3: Site-photo per-use empty-state inheritance
  from material spec-status.** Resolved: **disabled when the
  material's `specification_status === 'na'`.** Matches V1
  semantics (per-segment disable when seg-level status was
  `na`); now applies at the material level since V2's
  spec-status moved to `project_materials`. Two reinforcing
  reasons: (a) early-design `na` placeholders shouldn't
  attract photo uploads against products that may get
  swapped; (b) users are already trained on this gate from
  V1. Workaround when an `na` segment legitimately needs
  documentation (e.g. existing-conditions photos before
  product selection): bump material spec-status to
  `missing` first — acceptable friction.

---

## US-ENV-14 — Airtightness sub-tab

**Status:** Draft · **Priority:** MVP (HBJSON-driven model
captured 2026-05-10; full UX specs to be walked separately)
**PRD ref:** §6.1 (proposed new `project_airtightness` table;
needs follow-up edit), §11.4.2 (`project_hbjson_files`)
**V1 ref:** §3.5 (out of V1 reference scope)

### Story
> As a CPHC, I want a project-level airtightness page that
> auto-extracts envelope volume and area from the most recent
> HBJSON upload, accepts the contractor's blower-door test
> results, computes ACH50 / n50 / cfm50/sf, and is shareable
> with the construction team — without my having to recompute
> every time I open the page.

### Architectural decisions (provisional, captured 2026-05-10)

- **Storage location: project-level relational, not in the
  project document.** Reason matches `project_status_items`
  (PRD §6.1 / US-Status): airtightness is a project-level
  artifact tied to physical reality (the actual building's
  test results), not a versioned property of the energy model.
  Opening Round 1 Submit a year later should show today's
  measured airtightness, not Round-1-time airtightness.

- **HBJSON-derived geometry summary** lives on the
  `project_hbjson_files` row (cached at upload time):
  ```sql
  -- New columns on project_hbjson_files
  extracted_volume_m3        FLOAT,    -- Σ room volumes
  extracted_envelope_area_m2 FLOAT,    -- Σ exterior face areas
  extracted_floor_area_m2    FLOAT,    -- iCFA proxy (TBD which
                                        -- floor-area definition;
                                        -- see Q-ENV-14.2)
  extraction_status          TEXT,     -- 'pending' | 'ok' | 'failed'
  extraction_error           TEXT,     -- failure detail
  extracted_at               TIMESTAMPTZ
  ```
  - **Computed once on HBJSON upload**, stored, never
    recomputed on page load.
  - If the user uploads a new HBJSON, the extraction runs
    again on the new row; the old row's cached values are
    preserved (matching the immutable HBJSON contract,
    PRD §11.4.2).
  - The Airtightness page reads the **active HBJSON's**
    cached values (default = most recent upload; the HBJSON
    file picker on the Model tab can also drive which file is
    "active" for airtightness — see Q-ENV-14.1).

- **User-entered blower-door results and design targets** live
  in a new **project-level** table:
  ```sql
  project_airtightness (
      project_id              UUID PRIMARY KEY REFERENCES projects(id),
      -- Test method and result inputs:
      test_method             TEXT,    -- 'ASTM_E779_50Pa' | 'ASTM_E1554' | 'ATTMA_TS1' | ...
      test_pressure_pa        FLOAT,   -- typically 50
      test_result_cfm         FLOAT,   -- measured airflow at test pressure
      test_date               DATE,
      tester_name             TEXT,
      tester_certification    TEXT,
      target_ach50            FLOAT,   -- design target (Phius / PHI / code)
      target_source           TEXT,    -- 'Phius_Core' | 'Phius_2024_CORE' | 'PHIPlus' | ...
      notes                   TEXT,
      -- Bookkeeping:
      hbjson_file_id          UUID REFERENCES project_hbjson_files(id),
                              -- which HBJSON's geometry the test result is paired against
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_by              INTEGER REFERENCES users(id)
  )
  ```
  - **One row per project** (project_id is the PK; not
    versioned, not list-keyed).
  - **Pinned to a specific `hbjson_file_id`** so the displayed
    ACH50 is reproducible: ACH50 = (cfm × 60) / volume, where
    volume comes from the pinned HBJSON. If a newer HBJSON is
    uploaded, the user must explicitly re-pin (or the system
    auto-rolls forward — see Q-ENV-14.3).

- **Computed values** (`ach50`, `n50`, `cfm50_per_sf_envelope`,
  pass/fail vs target) are computed at read-time **from the
  cached inputs** (HBJSON's volume + area, project's test
  result + target). No recompute loop — both inputs are stored. This
  follows the shared computed-overlay rule: frontend renders returned
  values and status only; backend owns the calculation.

- **Permissions:** any editor can mutate. Read-only for
  Viewers (per the access-check seam, §4.1) — and
  this is intentional, since Ed wants to share this page with
  contractors via Viewers.

### Acceptance criteria (skeletal — full specs follow)

1. **URL.** `/projects/{id}/envelope/airtightness`.
2. **HBJSON-source banner** at the top — shows the current
   pinned HBJSON file name, upload date, and extracted volume
   / area / floor-area. If no HBJSON has been uploaded:
   empty state directing the user to the Model tab.
3. **Inputs section** (editable by editors):
   - Test method dropdown.
   - Test pressure (typically 50 Pa).
   - Measured result (cfm at test pressure).
   - Test date + tester name + tester certification.
   - Target ACH50 + target source (Phius / PHI / code).
   - Notes.
4. **Computed results section** (read-only):
   - ACH50 (computed live).
   - n50 (synonym for ACH50 — Phius vs PHI naming).
   - cfm50/sf-envelope (the Phius CORE metric).
   - Pass/fail badge vs target.
5. **Versioning behavior:** the inputs are project-level (not
   version-versioned); the page surfaces the same values
   regardless of which version of the project document is
   open. Switching versions does NOT change what's displayed
   here. **Banner clarification at the top:** *"Airtightness
   data is project-level — not tied to a specific version of
   the energy model."*
6. **Locked-version + Viewer rendering.** Editors see
   editable inputs always (since the data is project-level,
   not version-locked). Viewers see the page
   read-only.
7. **Sonner toast on save:** "Airtightness updated. ACH50:
   0.42 (target 0.6 — passes)."

### Resolved questions (2026-05-10)
- **Q-ENV-14.1: Which HBJSON file drives the Airtightness
  calc when multiple are uploaded?** Resolved: **(c)
  explicitly pinned via the Airtightness page's own UI.** The
  `project_airtightness.hbjson_file_id` column is the pin,
  with the Airtightness page offering its own picker to
  change it. Calc is reproducible and decoupled from "what
  the Model tab is showing." Rejected (a) always-most-recent
  (silent ACH50 changes break audit trail) and (b) Model-tab
  dropdown coupling (confusing).
- **Q-ENV-14.2: Floor-area definition for Phius CORE
  cfm50/sf.** Resolved: **iCFA per honeybee_ph's
  `interior_conditioned_floor_area`** convention. This matches
  Phius's expected variable and is already exposed in the
  HBJSON model. Document in `context/GLOSSARY.md` with a
  short note on what's excluded (unconditioned, exterior).
  Other definitions (gross, ground-only, code-specific
  variants) deferred to v1.1+ gated by concrete user request.
- **Q-ENV-14.3: Auto-roll-forward on new HBJSON upload?**
  Resolved: **no — keep pinned.** Auto-rolling silently
  changes the displayed ACH50 (because volume / envelope area
  changed) without the user knowing the source changed.
  Replacement UX: surface a banner *"A newer HBJSON has been
  uploaded; pinned source is still 'Round 1 model.hbjson'
  (uploaded 2026-04-12). [Re-pin to current]"* with an
  explicit re-pin button. Audit-trail discipline preserved;
  user is always informed.
- **Q-ENV-14.4: Multiple airtightness tests per project.**
  Resolved: **defer multi-test to v1.1+; one row per project
  in V2 v1.** Real projects do sometimes have multiple tests
  (rough-in + final, or per-zone in multifamily), but the
  single-row baseline covers single-family + small multifamily
  (BLDGTYP's typical caseload). Schema can extend additively
  later — `project_airtightness` becomes list-keyed by
  `test_id` rather than `project_id` PK; existing rows
  migrate cleanly to a single "final" entry.

---

## US-ENV-15 — Site Photos sub-tab

**Status:** Draft · **Priority:** MVP (promoted from Placeholder
2026-05-10 after all Q-ENV-15.x resolved)
**PRD ref:** §6.2 (assembly shape — `assembly.type` field
added per Q-ENV-15.1), §4 (Viewer access model —
updated 2026-05-10)
**V1 ref:** §3.5 (V1's Site Photos tab — out of V1 reference
scope; V2 reorganizes the per-segment photo data captured by
US-ENV-13 into a contractor-facing view)
**Inherits:** US-ENV-13 (Specifications sub-tab) for photo
storage shape and upload primitive

### Story
> As an editor, I want a Site Photos sub-tab that's primarily
> useful for **sharing with the construction team** — a
> contractor-facing view of all the per-segment installation
> photos already attached in the Specifications sub-tab,
> reorganized by assembly type (Walls / Floors / Roofs) so the
> trades crew can see "all the wall photos in one place"
> without drilling per-material. Sharing happens by sending
> the project URL to the contractor (per PRD §4 updated
> 2026-05-10 — project URLs are public-readable); this
> surface is the page they'll land on.

### Architectural decisions (2026-05-10)

- **No new backend / no new tables in v1.** The data shown
  here is the **same per-segment site-photos** that the
  Specifications sub-tab already manages
  (`segment.photo_asset_ids` per Q-ENV-2). This sub-tab is
  purely a **presentation-layer reorganization** of existing
  data — no new asset storage, no new endpoints beyond
  what US-ENV-13 already exposes.

- **Grouping by assembly type** — sections render in this
  order (Other appears only when at least one assembly is
  typed `other`):
  **Walls · Floors · Roofs · Other**.
  Within each section, group by assembly, then by layer /
  segment.

- **Assembly type source** — explicit `assembly.type` enum
  field on each assembly (resolved per Q-ENV-15.1). Values:
  `'wall' | 'floor' | 'roof' | 'other'`. Name-based
  auto-detection on assembly create; user-editable thereafter
  via the assembly's `⋯` menu (US-ENV-2). This is a single
  field on the assembly schema, not a separate lookup table.

- **Editable here too — not a read-only redirect to
  Specifications.** Users can drop new photos directly onto
  per-segment zones in this view. Same R2 upload +
  `segment.photo_asset_ids[]` JSON-Patch path as US-ENV-13;
  this surface is a **different view of the same data**, with
  the same write affordances.

- **Viewer rendering is the primary motivation.**
  Contractor-facing share — the trades crew gets a clean
  by-type browse view without needing editor access. Editor
  affordances (upload zones, `⋯` menus) hide gracefully.

### Acceptance criteria

1. **Sub-tab placement.** Lives under the Envelope tab
   (US-ENV-1) as the 4th sub-tab in display order:
   **Assemblies · Specifications · Airtightness · Site Photos**.
   URL deep-link: `/projects/{id}/envelope/site-photos`
   (mirrors Q-ENV-9 / US-ENV-1 routing pattern).

2. **Empty-state UX** (no photos uploaded anywhere on the
   project):
   - Centered card with copy: *"No site photos yet. Site
     photos are attached per-segment under the
     **Specifications** sub-tab — they'll appear here
     organized by assembly type once uploaded."*
   - Primary CTA: **[Go to Specifications]** (linkable
     button — same data, different view).
   - Viewers see the empty-state card without
     CTA (just the explanatory text). Avoids dead links to
     editor-only surfaces.

3. **Section structure** (when at least one photo exists):
   - **Walls** section — assemblies where `assembly.type === 'wall'`
   - **Floors** section — `assembly.type === 'floor'`
   - **Roofs** section — `assembly.type === 'roof'`
   - **Other** section — `assembly.type === 'other'`, rendered
     only if at least one assembly falls into it.
   - Sections render in fixed order (Walls / Floors / Roofs /
     Other), each with a sticky-on-scroll header.

4. **Per-section header:**
   - Title with summary count: `Walls (3 assemblies · 24 photos)`.
   - Anchor link for sharing: hover reveals a small `🔗` icon
     that copies a fragment URL (e.g.
     `/projects/{id}/envelope/site-photos#walls`) to
     clipboard — useful when sharing a specific section with
     a contractor.

5. **Per-assembly card** within a section:
   - Sorted by `naturalSortCompare(assembly.name)`.
   - Card header: assembly name + a small **canvas thumbnail
     color-strip** showing the cross-section (mini version
     of the US-ENV-4 canvas — re-uses the same SVG render
     scaled down, no zoom controls).
   - Per-segment photo grid below: re-uses the same
     drag-drop primitive as US-ENV-13's per-use site-photo
     zone (criterion 7 below).

6. **Per-segment photo zone** (re-uses US-ENV-13's primitive):
   - One zone per `segment` in the assembly's layers.
   - Zone label: `"{Layer N} · {Segment N} · {project_material.name}"`
     (e.g. `"Layer 2 · Segment 1 · XPS"`).
   - Thumbnails of each photo currently attached to that
     segment's `photo_asset_ids[]`.
   - Drag-drop accepts new uploads (criterion 7).
   - Per-thumbnail actions: click to view full-size in a
     lightbox modal; `⋯` → Delete (with confirm dialog).
   - **Disabled when material's `specification_status === 'na'`**
     per Q-ENV-13.3 resolved (matches US-ENV-13 semantics —
     "we don't know what this is yet, don't waste photos").
     Greyed-out drop zone with tooltip *"Set material spec
     status to 'Missing' to enable uploads."*

7. **Upload flow** (drag-drop + file picker, mirrors US-ENV-13):
   - File-type validation: image MIME types only
     (`image/jpeg`, `image/png`, `image/webp`, `image/heic`).
   - File-size cap: **10 MB per photo** (matches typical
     contractor-camera output).
   - Upload progress shown as a thin progress bar at the
     drop-zone top edge.
   - Success → thumbnail appears in the zone; underlying
     JSON-Patch appends to `segment.photo_asset_ids[]`.
   - Failure → toast with error reason; partial uploads
     cleaned up.

8. **No cross-segment drag-and-drop** (per Q-ENV-15.3
   resolved). Within this view's UI, dragging a thumbnail
   from segment A's zone to segment B's zone is **not
   supported** — photos stay tied to the segment they were
   uploaded against. Workaround: re-upload to the correct
   segment, delete the wrong one (two clicks; not painful).
   v1.1+ could add an explicit "re-assign photo" action with
   audit-log entry if a real workflow surfaces.

9. **No required-photo-set checklist in v1** (per Q-ENV-15.2
   resolved). V2 v1 ships the regrouped browse view only.
   The cert-package "required N photos per category" concept
   defers to v1.1+ — needs design work V1 skipped (who
   maintains the per-type required-photo list? where does
   it live? per-project override?).

10. **Per-photo metadata viewer.** Click thumbnail → lightbox
    modal:
    - Full-size image render.
    - Caption strip: filename, uploaded date, uploaded by
      (editor display name).
    - Navigation arrows to step through all photos in the
      current assembly card (not just the segment — useful
      for contractors scanning a wall section).
    - Close on ESC / backdrop click.
    - Download button (always present, even for Viewers —
      contractors need this).

11. **Editor permissions** — full drag-drop / upload /
    delete / rename / cross-section nav. Per-thumbnail
    `⋯` menus visible.

12. **Viewer permissions** (the contractor-share
    use case — primary motivation for this surface):
    - **Read + download only.** Sections / cards /
      thumbnails / lightbox all render normally.
    - Upload zones render as **passive thumbnail grids**
      (no drag-drop, no `+ Add photo` CTA, no per-thumbnail
      `⋯` menu).
    - Anchor-link `🔗` icons still work for sharing
      specific sections with the trades.
    - Empty per-segment zones render as a quiet *"No photos
      yet"* placeholder, not a CTA-bearing drop zone.

13. **Locked-version rendering.** Same as Viewers above —
    drop zones become passive, deletes
    hidden. Locked versions are an editor-side concept
    (a saved, frozen version of the project document),
    but the underlying photo data (in `segment.photo_asset_ids`)
    is part of that frozen document — so the locked view
    represents what photos existed at the time of locking,
    read-only.

14. **Re-uses US-ENV-13's backend endpoints.** No new
    routes; this is purely a frontend reorganization of the
    same data US-ENV-13 reads / writes. MCP-callable photo
    endpoints (per NEW-LLM-API-1) are inherited from
    US-ENV-13 / US-VIEW-1's asset-API pattern.

### Resolved questions (2026-05-10)

- **Q-ENV-15.1: Assembly type field — name-parse or explicit
  field?** Resolved: **explicit `assembly.type: 'wall' |
  'floor' | 'roof' | 'other'`** with name-based auto-detection
  on assembly create. Field added to the assembly schema in
  PRD §6.2 amendment (already landed).
- **Q-ENV-15.2: V1's "required photos" checklist concept —
  keep, drop, or defer?** Resolved: **defer to v1.1+.** V2 v1
  ships only the per-segment-installation regrouped view.
- **Q-ENV-15.3: Per-section drag-and-drop reorganization?**
  Resolved: **no — photos stay tied to segments.** Cross-
  segment moves have unclear semantics. Workaround: re-upload
  + delete wrong (2 clicks). v1.1+ can add explicit
  "re-assign photo" with audit-log if a real workflow
  surfaces.

### Open questions
None outstanding.

### Cross-references

- **US-ENV-13 (Specifications sub-tab)** — the OTHER view of
  the same per-segment photo data; this sub-tab is a
  presentation-layer reorganization. All photo storage /
  upload / delete plumbing is shared. Bug fixes on one
  surface fix both.
- **Q-ENV-2 resolved** — `segment.photo_asset_ids[]` data
  shape (photos at segment level, not material level).
- **Q-ENV-15.1 resolved → PRD §6.2 amendment** —
  `assembly.type` enum field source.
- **Q-ENV-13.3 resolved** — per-segment photo zone disabled
  when material's spec-status is `na`.
- **PRD §4** — Viewer access model (updated
  2026-05-10) / contractor-share use case.
- **NEW-LLM-API-1** — asset-API endpoints (inherited).
- **NEW-DATASHEET-1** (post-parity) — bulk-download of all
  project datasheets shares the asset-API pattern; bulk-
  download of all site photos as a contractor-share zip is
  a natural v1.1+ NEW-SITEPHOTOS-1 follow-up (worth flagging
  but not creating as a stub until a real use surfaces).

### Resolved questions (2026-05-10)

- **Q-ENV-15.1: Assembly type field — name-parse or explicit
  field?** Resolved: **explicit `assembly.type: 'wall' |
  'floor' | 'roof' | 'other'`** with name-based auto-detection
  on assembly create (heuristic: name starts with `WALL` →
  wall, `FLOOR` / `FC` → floor, `ROOF` → roof, else `other`),
  user-editable thereafter via the assembly's `⋯` menu.
  Robust against renames; auto-detect avoids manual entry on
  create. Adds one enum field to the `assembly` shape (PRD
  §6.2 amendment item).
- **Q-ENV-15.2: V1's "required photos" concept (the cert
  package needs N photos in each category) — keep, drop, or
  defer?** Resolved: **defer to v1.1+; V2 v1 ships only the
  per-segment-installation re-grouped view.** The required-set
  design needs work that V1 didn't do (who maintains the
  per-assembly-type required-photo list? where does it live?
  per-project override?), and the regrouped view alone is
  already a meaningful step up from V1 for contractors. v1.1+
  can layer the checklist on top additively.
- **Q-ENV-15.3: Per-section drag-and-drop reorganization?**
  Resolved: **no — photos stay tied to segments.** Cross-
  segment moves have unclear semantics (does the source
  segment lose the photo, or is it copied? does the per-segment
  metadata travel?) and risk misleading the QA record.
  Workaround: re-upload to the correct segment, delete the
  wrong one (two clicks; not painful). v1.1+ can add an
  explicit "re-assign photo" action with audit-log entry if a
  real workflow surfaces.

---
