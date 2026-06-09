---
DATE: 2026-06-09
TIME: 13:30
STATUS: Active — resolutions in progress
AUTHOR: Ed (via Claude)
SCOPE: Accepted resolutions to research.md §6 open questions
RELATED:
  - planning/features/heat-pumps/README.md
  - planning/features/heat-pumps/research.md
  - context/user-stories/30-tables-equipment.md (US-Builder-Equipment; HPs slot in here)
  - context/GLOSSARY.md (needs new entries for HP terminology)
---

# Heat Pumps — Decisions

Numbered resolutions track the open questions in `research.md` §6.
Status legend: ✅ resolved · ◻ open · ⊘ deferred to v1.1+.

## D-HP-1 ✅ — Catalogs: project-scoped, no global catalog (Q-HP-1)

**Resolution.** Heat Pumps ship in V2 v1 as project-scoped equipment.
No shared/global catalog (the "bookshelf" pattern used by Materials,
Frame Types, Glazing Types) — AHRI-rated performance is per-project
because it's per-pairing, and the global-catalog UX doesn't model
that cleanly.

**Why.** Confirmed by the reference base: the same outdoor model
`PUZ-A18NKA7` appears as two distinct equipment rows — one paired with
`PLA-A18EA8`, one paired with `PVA-A18AA7` — because the AHRI numbers
differ ~13% per pairing. The pairing decision is project-level.

**Forward compatibility.** Equipment-type rows include
`catalog_origin: null | <object>` so a future v1.1+ shared catalog
becomes purely additive — no schema migration, just a new picker path.

## D-HP-2 ✅ — Data shape: 4-table EQUIP/UNIT split, indoor + outdoor symmetric (Q-HP-2)

**Resolution.** Four project-scoped tables, two on each side
(catalog + instance):

| Table | Role | Picks from |
|---|---|---|
| `tables.equipment.heat_pump_outdoor_equip[]` | Outdoor equipment types (AHRI-rated pairings); one row per unique manufacturer+model+paired-indoor combo | — (this IS the project catalog) |
| `tables.equipment.heat_pump_outdoor_units[]` | Installed outdoor unit instances; one row per physical condenser on site | `heat_pump_outdoor_equip` |
| `tables.equipment.heat_pump_indoor_equip[]` | Indoor equipment types; one row per unique indoor model | — (project catalog) |
| `tables.equipment.heat_pump_indoor_units[]` | Installed indoor AHU/cassette/concealed-duct instances | `heat_pump_indoor_equip` + `heat_pump_outdoor_units` (which outdoor it's wired to) |

**Why symmetric (not just outdoor-catalog).** Reference data shows
116 indoor units sharing 25 distinct types — a 4.6:1 dedup win.
Editing a TPLFY cut-sheet or AHRI sheet should be one operation, not
twelve. Consistent catalog→instance pattern on both sides also keeps
the UX uniform.

**Hybrid storage option rejected.** The "one table per side, group
instances by type for shared edits" pattern was discussed in
research.md §5 and dropped — it collapses two distinct data shapes
(types vs instances) into one table, which complicates validation,
breaks the existing `catalog_origin` pattern, and forces a custom
UX for the "edit shared fields" action.

## D-HP-3 ✅ — UI: nested sub-tabs under Equipment / "Heat Pumps" group (Q-HP-3)

**Resolution.** One slot in the Equipment sub-tab strip called
**"Heat Pumps"**. Clicking it opens a second-level sub-tab strip
with four entries — one DataTable per page (per US-Builder-Tables).

```
Equipment tab (existing top-level)
  ├─ Rooms
  ├─ Thermal Bridges
  ├─ ERVs
  ├─ Heat Pumps        ◄── new sub-tab; container only, no own DataTable
  │   ├─ Equipment — Outdoor   ◄── DataTable: heat_pump_outdoor_equip
  │   ├─ Equipment — Indoor    ◄── DataTable: heat_pump_indoor_equip
  │   ├─ Units — Outdoor       ◄── DataTable: heat_pump_outdoor_units
  │   └─ Units — Indoor        ◄── DataTable: heat_pump_indoor_units
  ├─ Pumps
  └─ Fans
```

**Routes** (mirror US-EQ-1 deep-link convention):

- `/projects/{id}/equipment/heat-pumps` →
  redirect to `…/heat-pumps/equipment-outdoor`
- `/projects/{id}/equipment/heat-pumps/equipment-outdoor`
- `/projects/{id}/equipment/heat-pumps/equipment-indoor`
- `/projects/{id}/equipment/heat-pumps/units-outdoor`
- `/projects/{id}/equipment/heat-pumps/units-indoor`

**Why.**

- One-DataTable-per-page contract is preserved (per Ed direction
  2026-06-09); no segmented-control hack.
- Equipment sub-tab strip stays at 7 top-level entries (not 9).
- "Heat Pumps" reads as a logical group, matches user mental model
  ("everything about HPs lives here").
- Default second-level destination is `Equipment — Outdoor` because
  outdoor types are the primary aggregation unit for the Phius
  Multiple Heat Pump Performance Estimator (the calc explicitly
  excludes interior heads / AHUs).

**Open implementation question** (mechanical, not directional):
shadcn `Tabs` nested inside shadcn `Tabs` works but should be
visually differentiated from the top-level tab strip — likely a
smaller variant. Sort out in the phase plan.

## D-HP-4 ✅ — ERV-integrated coils: two rows, one FK link (Q-HP-4)

**Resolution.** When a physical box is both an HP indoor coil and
an ERV (e.g. Mitsubishi LEV Kit + Lossnay LGH):

- One row in `tables.equipment.heat_pump_indoor_units[]` carries the
  HP-side data (coil capacity, refrigerant link to the outdoor unit,
  served-area/tag).
- One row in `tables.equipment.ervs[]` carries the ERV-side data
  (airflow, sensible recovery efficiency, electrical power,
  ventilation datasheet).
- The HP indoor unit row carries `linked_erv_unit_id: string | null`
  pointing into `tables.equipment.ervs[*].id`.

**Why two rows, not one.**

- Procurement / submittal data is split — the manufacturer ships
  the kit as two test reports (AHRI for the coil, HVI/AHRI for the
  ERV core), with two cut-sheets.
- Phius energy modeling consumes them separately — the HP outdoor
  drives the heating/cooling sub-calc; the ERV drives the
  ventilation sub-calc.
- The existing ERVs sub-tab (US-EQ-4) already has rooms linking to
  ERV rows (`tables.rooms[*].erv_unit_ids`). Folding the integrated
  unit into HP-side-only would break that linkage or require
  duplicating ERV data into HP indoor rows.

**Per-row behavior wired in V2 v1.**

- HP Indoor row-detail modal exposes a "Linked ERV unit" picker.
  Visible when `install_type` indicates ERV-integrated; hidden
  otherwise.
- ERV row-detail modal shows a small read-only "Linked from HP
  indoor: {tag}" indicator when an HP indoor unit links to it.
- On delete: deleting the ERV nulls the HP indoor's
  `linked_erv_unit_id` with a soft-warning toast (mirrors
  US-EQ-2 criterion 6 referential-integrity pattern).
  Deleting the HP indoor unit does not touch the ERV row.

**Bidirectionality.** The link is one-way at the storage layer
(`linked_erv_unit_id` on the HP indoor row only). The ERV side
"sees" its linked HP indoor via a server-side reverse lookup at
read time. Same pattern as outdoor→indoor unit linkage.

## D-HP-5 ✅ — Outdoor↔indoor unit linkage (instance level)

**Resolution.** Each `heat_pump_indoor_units[*]` row carries an
`outdoor_unit_id: string | null` pointing into
`heat_pump_outdoor_units[*].id`. Cardinality is N:1 — one outdoor
unit drives many indoor units (1:N from the outdoor side).
Mirrors the AirTable structure exactly.

**Why this isn't on the equipment table.** Two outdoor equipment
types could be paired with the same indoor equipment type in
different projects, or even within the same project (one HP-17 is
TUHYE1204, another HP-9 is PUZ-A36 — both could feed the same
TPKFY indoor model). The pairing lives on the *unit* instances,
not the equipment types.

## D-HP-6 ✅ — Data model aligned with Phius Multiple HP Performance Estimator (and legacy v1 metrics for reference, per D-HP-FOLLOWUP-1)

**Resolution.** Outdoor equipment performance fields cover both the
calculator's `Phius_Heat Pump Performance Estimator_v25.1.1` inputs
**and** legacy M0/Vt-procedure ratings so the user can record
whatever the available datasheet provides:

| Field | Type | Feeds Phius calc? | Notes |
|---|---|---|---|
| `heating_data_type` | enum: `"cops"` \| `"hspf2"` | ✅ discriminator | Calc requires one of `cops` / `hspf2`, never both. |
| `heating_cap_kbtuh_17f` | float \| null | ✅ (when cops) | |
| `heating_cap_kbtuh_47f` | float \| null | ✅ (when cops) | |
| `heating_cop_17f` | float \| null | ✅ (when cops) | |
| `heating_cop_47f` | float \| null | ✅ (when cops) | |
| `hspf2` | float \| null | ✅ (when hspf2) | M1 procedure (current). |
| `hspf` | float \| null | ❌ reference only | Legacy M0/Vt rating; common on older datasheets. |
| `cooling_data_type` | enum: `"eer2_seer2"` \| `"ieer"` | ✅ discriminator | |
| `cooling_cap_kbtuh_95f` | float \| null | ✅ (both modes) | |
| `eer2` | float \| null | ✅ (when eer2_seer2) | M1 procedure. |
| `seer2` | float \| null | ✅ (when eer2_seer2) | M1 procedure. |
| `ieer` | float \| null | ✅ (when ieer) | Used for commercial-class equipment. |
| `eer` | float \| null | ❌ reference only | Legacy M0/Vt rating. |
| `seer` | float \| null | ❌ reference only | Legacy M0/Vt rating. |

**Qty is derived, not stored.** The calc's `Qty` column is
`count(heat_pump_outdoor_units where outdoor_equip_id = this.id)`.
Computed server-side or on export; not a user-editable field on the
equipment row.

**Phius export.** A dedicated export action on the Equipment —
Outdoor page produces a CSV (or direct xlsx-paste payload) matching
the calc's column order, one row per outdoor equipment type, with
`Qty` populated. The export reads only the ✅ fields above; legacy
`hspf` / `eer` / `seer` are documentation, not export inputs. Scope
detail deferred to phase plan.

**Why store legacy and v2 side-by-side** (per D-HP-FOLLOWUP-1 below).
BLDGTYP projects span a wide vintage range of mechanical equipment,
and not every manufacturer (e.g. Swegon) ships AHRI-style ratings
to begin with — the datasheet might carry HSPF only, SEER only,
EER only, IEER only, or some combination. The data table is bigger
as a result, but column-visibility toggles let users hide the
metrics that don't apply to their project's equipment.

## D-HP-7 — Field-level decisions on outdoor equipment row

Beyond the Phius-aligned performance fields, the outdoor equipment
row carries:

| Field | Type | Notes |
|---|---|---|
| `id` | `hpoe_<ULID>` | |
| `manufacturer` | single_select option_id | user-defined per-project |
| `model_number` | string | bare outdoor model code (e.g. `PUZ-A18NKA7`); the bracket-pairing trick is replaced by the field below |
| `paired_indoor_model` | string \| null | the indoor model whose pairing this AHRI cert covers; null for VRF / multi-indoor types |
| `mode_type` | single_select option_id | topology family — user-defined per-project (seeded examples: PUZ / PUHY / TUHYE / SUZ / NTXM) |
| `refrigerant` | single_select option_id \| null | user-defined; expected values: R-410A / R-32 / R-454B |
| `datasheet_asset_ids` | string[] | catch-all PDF storage: manufacturer cut-sheet, AHRI cert, NEEP rating sheet, Swegon test report — whatever the user has (per D-HP-AHRI below) |
| `notes` | string \| null | |
| `catalog_origin` | null \| object | forward-compat |

Plus the performance fields enumerated in D-HP-6.

## D-HP-8 — Field-level decisions on indoor equipment row

| Field | Type | Notes |
|---|---|---|
| `id` | `hpie_<ULID>` | |
| `manufacturer` | single_select option_id | |
| `model_type` | single_select option_id | sub-family (PLA / TPVFY / TPKFY / PVA / PEAD / TPLFY / LEV); user-defined |
| `model_number` | string | bare indoor model code |
| `install_type` | single_select option_id | CASSETTE / WALL-MOUNTED / CONCEALED-DUCTED / MULTI-POSITION / ERV-INTEGRATED; user-defined |
| `nominal_tons` | float \| null | |
| `fan_speed_cfm` | float \| null | nominal |
| `cooling_btuh` | float \| null | |
| `heating_btuh_47f` | float \| null | |
| `heating_btuh_17f` | float \| null | |
| `heating_cop` | float \| null | |
| `seer` | float \| null | |
| `eer` | float \| null | |
| `hspf` | float \| null | |
| `datasheet_asset_ids` | string[] | |
| `notes` | string \| null | |
| `catalog_origin` | null \| object | forward-compat |

Note: indoor performance fields use the older labels (SEER/EER/HSPF)
because indoor units don't independently appear on the Phius calc.
This is documentation-only data; reconsider when Phius adds
indoor-side metrics.

## D-HP-9 — Field-level decisions on outdoor unit (instance) row

| Field | Type | Notes |
|---|---|---|
| `id` | `hpou_<ULID>` | |
| `tag` | string | drawing schedule tag (e.g. `HP-17`); Record-ID per US-Builder-Tables; unique within project (trim + case-insensitive) |
| `outdoor_equip_id` | string | → `heat_pump_outdoor_equip[*].id` |
| `building_zone` | single_select option_id \| null | mirrors `tables.rooms[*].building_zone` options |
| `datasheet_asset_ids` | string[] | optional per-instance attachment (rare; mostly empty) |
| `notes` | string \| null | |

## D-HP-10 — Field-level decisions on indoor unit (instance) row

| Field | Type | Notes |
|---|---|---|
| `id` | `hpiu_<ULID>` | |
| `tag` | string | drawing schedule tag (e.g. `AHU-17L`); Record-ID; unique within project |
| `indoor_equip_id` | string | → `heat_pump_indoor_equip[*].id` |
| `outdoor_unit_id` | string \| null | → `heat_pump_outdoor_units[*].id`; nullable for in-progress data entry |
| `linked_erv_unit_id` | string \| null | → `tables.equipment.ervs[*].id`; populated only for ERV-integrated installs (D-HP-4) |
| `served_room_ids` | string[] | mirrors `tables.rooms[*].erv_unit_ids` pattern; energy-model uses this to attribute heating/cooling loads |
| `floor_level` | single_select option_id \| null | mirrors `tables.rooms[*].floor_level` options |
| `area_served` | string \| null | free-text (e.g. `CORRIDOR / STAIR`, `LOBBY`) |
| `datasheet_asset_ids` | string[] | rarely populated; user might attach a marked-up shop drawing |
| `notes` | string \| null | |

## D-HP-AHRI ✅ — AHRI directory: no integration in v1 (Q-HP-5)

**Resolution.** No `ahri_certificate_number` field, no link-out to
ahridirectory.org, no separate `ahri_sheet_asset_ids` slot. The
outdoor equipment row has one `datasheet_asset_ids[]` field; the
user attaches whatever rating PDF the manufacturer ships (AHRI
certificate, NEEP rating, Swegon-style internal test report, plain
cut-sheet) and is responsible for collecting the right source.

**Why.** Not every PH-relevant manufacturer uses AHRI (Swegon is
the canonical example). Building a workflow around AHRI directory
lookup would create a two-track UX — one for AHRI-rated equipment,
one for everything else. Cleaner to ship a single
"attach the datasheet you have" surface in v1 and revisit
automation (AHRI directory scrape, NEEP API integration) later
when usage shows real friction.

## D-HP-11 ✅ — Served-rooms link on HP indoor instances ships in v1 (Q-HP-7)

**Resolution.** `tables.equipment.heat_pump_indoor_units[*].served_room_ids: string[]`
is in V2 v1, as already enumerated in D-HP-10. Each id references
`tables.rooms[*].id`. Empty array = no room attribution (acceptable
for circulation / vestibule installs).

**Why now.** Energy-model integration depends on per-room load
attribution; without this link, the downstream HBJSON / WUFI handoff
has to guess. Mirrors the existing `tables.rooms[*].erv_unit_ids[]`
pattern from US-EQ-2 / US-EQ-4 — same shape, opposite side of the
relationship.

**Direction of the link.** Stored on the HP indoor unit row
(`served_room_ids[] → rooms`), not on the room row. Rationale:
new HP installations are easier to author from the HP-side picker
(choose which rooms this AHU serves) than from the room-side
(choose which AHUs serve this room). The ERV ↔ Rooms link points
the other way historically because ERVs were defined first and
rooms inherit ventilation; if real-project usage shows that
inconsistency confuses users we'll revisit. Captured as
Q-HP-FOLLOWUP-3.

## D-HP-12 ⊘ — Backup / supplemental heat deferred to v1.1+ (Q-HP-10)

**Resolution.** No `backup_heat_type` / `backup_heat_kw` /
`backup_heat_fuel` fields in V2 v1. Add when a real Phius project
shows it driving a calculation result we can't fudge with notes.

**Why deferred.** Most cold-climate PH heat pumps either don't
need backup at design conditions or fall back to in-AHU resistance
strips that the manufacturer already factors into HSPF2. Modeling
backup heat properly requires its own discriminator (resistance
strip vs hot-water coil vs separate gas furnace) and runtime
estimation, which is more design surface than we can justify
without a forcing project.

## D-HP-13 ✅ — Sub-tab visual treatment: another tab-bar level (Q-HP-FOLLOWUP-2)

**Resolution.** The four leaf pages under Heat Pumps use the same
shadcn `Tabs` primitive as the top-level Equipment sub-tab strip,
nested one level deeper. Reusing the existing visual language
(rather than inventing a chip / breadcrumb / drill-in pattern) keeps
the UX vocabulary small.

**Visual differentiation.** The inner tab strip should read as
visually subordinate to the outer one — likely a smaller variant
of shadcn `Tabs` (`size="sm"` or equivalent), or a slight contrast
shift. Exact treatment is an implementation detail; pinned for the
phase plan, not a directional decision.

## Remaining follow-up (deferred to phase plan / post-v1)

- ⊘ **Q-HP-FOLLOWUP-3** — Direction of the room↔HP-indoor link
  (HP-side `served_room_ids[]` vs Room-side `hp_indoor_unit_ids[]`).
  Currently HP-side per D-HP-11. Revisit if real-project usage
  exposes UX friction with the asymmetric direction vs ERVs.

## What's next

1. ~~Ed confirms the still-open questions above.~~ ✅ Closed
   2026-06-09 round 2 (Q-HP-5 / 7 / 10 / FOLLOWUP-1 / FOLLOWUP-2).
2. Promote this decisions log into a proper PRD.md per the
   `planning/.instructions.md` feature-folder contract — including
   acceptance criteria, US-EQ-7..10 user-story stubs, and phase
   sequencing.
3. Update `context/user-stories/30-tables-equipment.md`:
   - Add US-EQ-7 (Heat Pumps sub-tab structure)
   - Add US-EQ-8 (HP Outdoor Equipment DataTable)
   - Add US-EQ-9 (HP Indoor Equipment DataTable)
   - Add US-EQ-10 (HP Outdoor Units DataTable)
   - Add US-EQ-11 (HP Indoor Units DataTable)
   - Amend US-EQ-4 (ERVs) for the `linked_erv_unit_id` reverse
     surface.
4. Update `context/GLOSSARY.md` with new terms:
   - **HP Outdoor Equipment** — project-scoped type table; AHRI-
     rated outdoor pairings.
   - **HP Indoor Equipment** — project-scoped type table; indoor
     unit models.
   - **HP Outdoor Unit** — installed condenser instance with tag.
   - **HP Indoor Unit** — installed AHU/cassette/etc. instance
     with tag.
   - **Integrated unit** — physical box implementing both an HP
     indoor coil and an ERV core; modeled as two linked rows.
