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
| `paired_indoor_equip_id` | string \| null | FK → `heat_pump_indoor_equip[*].id`; the indoor row whose pairing this AHRI cert covers; null for VRF / multi-indoor types (superseded by D-HP-22 — was free text `paired_indoor_model`) |
| `system_family` | single_select option_id | topology family — user-defined per-project (seeded examples: PUZ / PUHY / TUHYE / SUZ / NTXM). Renamed from `mode_type` per D-HP-24. |
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

## D-HP-14 ✅ — Refrigerant ships in v1 (Q-HP-6)

**Resolution.** `refrigerant` is a v1 field on the outdoor equipment
row (already in §4.2 / D-HP-7). User-defined single-select per
project; seeded values `R-410A` / `R-32` / `R-454B`. Tracking
refrigerant supports forthcoming Phius GWP reporting and gives the
project a defensible record for certification submittals.

**Why now.** Adding the field post-Phase-0 requires a migration;
adding it now is a one-line schema addition with zero downside.
Phius is already moving toward GWP scoring in upcoming calc
revisions.

## D-HP-15 ✅ — Per-instance datasheet on outdoor units ships in v1 (Q-HP-8)

**Resolution.** `heat_pump_outdoor_units[*].datasheet_asset_ids[]`
ships in v1 (already in §4.4 / D-HP-9), in addition to the
equipment-level `heat_pump_outdoor_equip[*].datasheet_asset_ids[]`.
Per-instance slot is rare in practice but real — used for as-built
documentation (refrigerant line-set length AHRI corrections, field
mark-ups, shop drawings).

**Why both.** Equip-level is the generic spec; unit-level is the
"this particular install" doc. The AirTable reference base shows
real population of both; PHN preserves the same affordance.

## D-HP-16 ✅ — Sub-tab ordering: between ERVs and Pumps (Q-HP-9)

**Resolution.** The Equipment-tab sub-tab strip is
`Rooms / Thermal Bridges / ERVs / Heat Pumps / Pumps / Fans` (per
PRD §5.1). Heat Pumps lands between ERVs (the other primary
mechanical equipment, often coupled with HPs) and Pumps (auxiliary).

**Why.** Heating/cooling-primary equipment groups together; auxiliary
equipment trails. Matches Phius certification-doc convention for
mechanical schedule ordering.

## D-HP-17 ✅ — `heating_data_type` / `cooling_data_type` as hard enums (A2)

**Resolution.** Both discriminator fields are hard enums stored as
literal strings — *not* user-defined single-selects. Accepted
values: `cops` / `hspf2` / `null` (heating);
`eer2_seer2` / `ieer` / `null` (cooling).

**Why.** The Phius export (PRD §6.2) emits the calc's literal
header values (`COPs`, `HSPF2`, `EER2/SEER2`, `IEER`); the
mapping is hard-coded. If `heating_data_type` were a renamable
single-select option, a user renaming the option (say
`hspf2 → HSPF2-Procedure-A`) would silently break export. Hard
enums close that hole.

**UI treatment.** Edits surface as a fixed three-value dropdown
(including null) with no "add option" affordance. All other
single-select fields on the row (`manufacturer`, `system_family`,
`refrigerant`) remain user-defined per-project.

## D-HP-18 ✅ — VRF Phius-export Device(s) string drops brackets when paired is null (B2)

**Resolution.** PRD §6.2 `Device(s)` mapping:

- When `paired_indoor_equip_id` is non-null:
  `model_number + " [" + resolve(paired_indoor_equip_id).model_number + "]"`
  (e.g. `"PUZ-A18NKA7 [PVA-A18AA7]"`).
- When `paired_indoor_equip_id` is null (VRF / multi-indoor):
  bare `model_number` (e.g. `"TUHYE1204AN41AN"`) — no brackets, no
  trailing space.

(Field name updated to `paired_indoor_equip_id` per D-HP-22; the
behavior is unchanged.)

**Why.** VRF systems carry a system-level AHRI rating that is
*not* per-pairing; the bracketed shorthand is meaningless for
them. Emitting `"TUHYE1204AN41AN [null]"` or
`"TUHYE1204AN41AN []"` is worse than emitting the bare model
code — the calc accepts both, and the bare form is what
manufacturers list.

## D-HP-19 ✅ — Cascade-delete UX: pre-delete confirmation dialog with preview (D2)

**Resolution.** All cascade-null deletes (outdoor-unit → indoor
units, ERV → HP indoor units) surface a **pre-delete confirmation
dialog** showing the affected referencing rows by tag, not a
post-delete toast. PRD §4.6 updated to reflect this.

**Why.** A user deleting `HP-17` that cascades to 12 indoor units
should learn the blast radius *before* clicking through, not in a
toast they may dismiss. Mirrors the pattern Phase 3 §Risk #2
recommended; consistent with the "blocked-delete" dialogs we
already use for referenced equip rows. Cascade-on-array-filter
deletes (room → `served_room_ids[]`) stay silent — the referencing
row's identity is unchanged, just one array element drops out.

## D-HP-20 ✅ — OPQ-1: column visibility is always-visible, not per-row conditional (A1)

**Resolution.** Performance columns (`heating_cop_47f`,
`heating_cop_17f`, `hspf2`, `eer2`, `seer2`, `ieer`) are
column-level always-visible (subject to the user's column-visibility
overflow toggles); cells render empty when the row's discriminator
doesn't match. There is no per-row column visibility shim.

**Why.** TanStack-Table supports column visibility, not cell
visibility based on row state. The per-row variant requires custom
hooks reading row state to decide column-header rendering, which
fights the substrate. The always-visible model gives every column a
predictable, sortable, filterable presence and lets the user hide
whole columns via the overflow menu if their project doesn't use a
particular metric.

## D-HP-21 ✅ — Cross-table single-select option sharing via `shared_with` directive (OPQ-5)

**Resolution.** Extend the user-defined single-select primitive
(US-Builder-Tables §16) with a `shared_with: "<table>.<col>"`
directive at the column declaration. A column that declares
`shared_with` is an *alias*: reads and writes route to the target
column's option list rather than the column's own.

Applied bilaterally to:

| Column | `shared_with` target | Why |
|---|---|---|
| `heat_pump_outdoor_units.building_zone` | `rooms.building_zone` | Same building-zone concept; rooms is the natural owner (it defines what zones exist) |
| `heat_pump_indoor_units.floor_level` | `rooms.floor_level` | Same floor-level concept; rooms is the natural owner |

**Why A over B or C.** B (per-table duplicate lists) forces the user
to re-author the same `NAR/SAR/EAR/WAR` zone list twice; option_ids
diverge so cross-table reporting is fragile. C (building-scoped
namespace) is the conceptually cleanest answer but requires
migrating existing `rooms.building_zone` data on every live project
and changes the US-Builder-Tables §16 contract for the rooms
columns — too invasive for the v1 timeline. A is a small additive
extension to the primitive: existing rooms options stay put, the HP
tables become aliases.

**Asymmetric ownership.** The `shared_with` target is privileged —
if you delete the rooms `building_zone` column (hypothetically), the
HP alias breaks. In practice the rooms columns are core schema and
not deletable, so this is fine.

**Manufacturer sharing not in this decision.** `manufacturer`
appears on ERV, HP outdoor equip, HP indoor equip (and probably
Pumps, Fans). Option A requires picking a canonical owner; none of
these tables is obviously canonical. Per Q-HP-FOLLOWUP-6 below,
`manufacturer` ships as per-table duplicate lists in v1; a future
multilateral-sharing primitive (Option C-style, scoped to
`equipment.manufacturer`) revisits this when the friction is
real.

**Phase 0 scope amendment.** The `shared_with` directive must
land as part of the Phase 0 primitive bump. Phase 0 backend
implementation now includes:

- US-Builder-Tables §16 extended to recognize `shared_with` at the
  column-declaration level.
- Read path: when resolving options for a `shared_with` column,
  read from the target key.
- Write path: when adding/renaming/deleting options on a
  `shared_with` column, write to the target key.
- Validation: target key must exist; circular `shared_with` chains
  rejected at validation time.

## D-HP-22 ✅ — `paired_indoor_equip_id` is a strict FK to indoor equip catalog (OPQ-6)

**Resolution.** The outdoor-equip row's pairing field is renamed
`paired_indoor_model` → `paired_indoor_equip_id` and re-typed from
free text to a strict FK:

```jsonc
"paired_indoor_equip_id": "hpie_<ULID> | null"  // → heat_pump_indoor_equip[*].id
```

`null` remains valid for VRF / multi-indoor outdoor types (D-HP-18
unchanged — Phius export drops brackets when null). Otherwise the
field must resolve to an existing `heat_pump_indoor_equip[*].id`.

**Why strict over free text.** Per Ed (2026-06-09 evening review):
the MVP should enforce the integrity claim PRD §1 makes. Free
text re-introduces the same string-divergence problem that
AirTable's bracketed shorthand had; if the V2 PRD's headline
improvement is "explicit pairing field replaces the bracket
convention", a free-text field that allows typos is just the
bracket convention with extra steps.

**Display.** Editor and table-cell render the resolved indoor
row's `model_number` (e.g. `"PLA-A18EA8"`); storage is the
`hpie_<ULID>`. Sort / filter operate on the resolved label.

**Authoring flow — outdoor-first preserved via inline-create.**
Phase 1 still ships the Outdoor Equipment page first, even though
the FK target (indoor equip rows) lives in a Phase 2 table. The
`paired_indoor_equip_id` picker on the outdoor row-detail modal
carries an inline **"Create new indoor equipment"** shortcut
opening a minimal indoor-equip create modal; on save, the new
indoor row's id is selected and the user returns to the outdoor
row. Phase 0 already ships all four backend models, so the only
scope shift is that Phase 1 builds a minimal indoor-equip
row-detail modal (Phase 2 then ships the full indoor-equip
*page* using the same modal as its main authoring surface). The
alternative — swapping Phase 1 ↔ Phase 2 — was considered and
rejected because Phase 1's "establishes nested-tab UX primitives"
role is cleaner on the outdoor page (where conditional column
visibility, attachment cell, and discriminator fields all
exercise more of the contract).

**Referential integrity (new row in PRD §4.6).** Deleting an
indoor-equip row that's the `paired_indoor_equip_id` of ≥1
outdoor-equip row → **pre-delete confirmation dialog** (per
D-HP-19) lists affected outdoor `model_number` values; on confirm,
`paired_indoor_equip_id` is set to `null` on each. The outdoor
row retains all its other data (capacities, COPs, etc.) — only
the pairing reference clears. The user re-pairs explicitly or
accepts the unpaired (VRF-like) state.

**Phius export mapping update (PRD §6.2).** `Device(s)` is now
`model_number + " [" + resolve(paired_indoor_equip_id).model_number + "]"`
when the FK is non-null; bare `model_number` when null
(D-HP-18 unchanged).

**MCP impact.** The `add_row` / `update_row` MCP tools (Phase 5)
must validate `paired_indoor_equip_id` resolves to an existing
indoor equip row; LLM-side authoring needs to read the indoor
catalog before writing outdoor rows. Acceptable — same constraint
exists for `outdoor_unit_id` on indoor units (D-HP-10).

## D-HP-23 ✅ — `linked_erv_unit_id` picker is always-shown, no install_type gate (OPQ-7)

**Resolution.** The `linked_erv_unit_id` field is always rendered
on the HP indoor unit row-detail modal, regardless of the row's
`install_type`. No conditional gating; no system-marked options
primitive in v1.

For non-integrated install types (`CASSETTE`, `WALL-MOUNTED`,
`CONCEALED-DUCTED`, `MULTI-POSITION`) the user simply leaves the
field empty — same as any other optional FK in the data model.
Field placement stays at the bottom of the modal so it doesn't
dominate the editor on the 95%+ rows that won't use it.

**Why B over A.** Per Ed (2026-06-09 evening review): a single
always-visible-but-empty field at the bottom of the modal is
acceptable UX noise. The system-marked-options primitive (Option A)
is real future work but Phase 0 already absorbs one primitive bump
(`shared_with` per D-HP-21); stacking a second would inflate Phase 0
risk for marginal UX gain. The escalation path stays open as
Q-HP-FOLLOWUP-5.

**Phase 2 simplification.** The `install_type` single-select seeds
five plain options (`CASSETTE`, `WALL-MOUNTED`, `CONCEALED-DUCTED`,
`MULTI-POSITION`, `ERV-INTEGRATED`). No `system_role` marker, no
"system options can't be deleted" sub-rule. Users may freely
rename, reorder, add, or delete options without affecting any
framework behavior. `install_type` becomes pure documentation.

**Phase 4 simplification.** No `use-indoor-equip-install-type` hook
needed. The ERV picker just renders. Phase 4 §Step 1 collapses to
"render the picker"; the resolver design discussion drops out.

**Downstream consideration.** If a user links an ERV to a
non-integrated indoor unit by accident, no calculation breaks —
the link is informational (reverse-lookup badge on the ERV side,
nothing more). The PRD §4.6 ERV-delete cascade still applies
regardless of `install_type`.

## D-HP-24 ✅ — Rename `outdoor.mode_type` → `outdoor.system_family` (OPQ-9)

**Resolution.** The outdoor-equip topology field is renamed
`mode_type` → `system_family` across PRD, decisions, phase plans,
research.md V2 sketch, and Phase 0 Pydantic models. Indoor-equip's
`model_type` is unchanged.

**Why.** Per Ed (2026-06-09 evening review): `mode_type` and
`model_type` are one letter apart on adjacent tables; the typo
vector is real and permanent. `system_family` is also a more
descriptive name (PUZ / PUHY / TUHYE / SUZ / NTXM are manufacturer
chassis/topology families, not operating modes). Free to do
before Phase 0 ships; an Alembic migration to fix later would cost
more than the rename itself.

**Scope.** Lowercase Python/TS identifier renamed. AirTable
reference docs (research.md line 59) keep `MODE_TYPE` since they
document the source system accurately. A future bulk-import flow
(Q-HP-FOLLOWUP-4) maps `MODE_TYPE → system_family` at the import
boundary.

## D-HP-25 ✅ — Nested-tab visual treatment: smaller/lighter inner strip (OPQ-8, supersedes OPQ-2)

**Resolution.** The nested Heat Pumps sub-tab strip uses shadcn
`Tabs` at the smaller variant (`size="sm"` or equivalent) with
visually lighter weight than the outer Equipment-tab strip.

Concretely:
- Outer strip (Equipment tab — Rooms / TBs / ERVs / Heat Pumps /
  Pumps / Fans) renders at default shadcn `Tabs` size.
- Inner strip (Heat Pumps' four leaf tabs) renders at the smaller
  variant: narrower font, less vertical padding, lighter underline
  / background.
- The selected inner tab uses the same color emphasis family as
  the outer selection (consistent visual language), at the smaller
  scale.
- Strip placement: directly below the outer tab strip, with a
  small visual gap so the level break is unambiguous.

**Why A over B (panel frame) or C (pill segmented control).**
Per Ed (2026-06-09 evening review): "let's try that out."
Variant A is the conservative, low-risk choice that matches
existing nested-tab conventions in modern productivity apps
(Notion, Linear, etc.) and reuses the shadcn `Tabs` primitive on
both levels (consistent with D-HP-13). Variant B adds spatial
framing complexity for marginal gain; Variant C would re-open
D-HP-13's "both levels use shadcn `Tabs`" pin.

**Iteration path.** If real usage shows Variant A's visual
hierarchy reads as too-flat (i.e. the inner strip doesn't feel
clearly subordinate), Phase 1 reviews can either tighten the size
delta or escalate to Variant B (panel frame). Variant C
(different primitive) is deferred unless A + B both fail.

**Phase 1 acceptance.** Phase 1 ships a screenshot of the nested
strip in its verification ledger; Ed eyeball-confirms before
Phase 2 inherits the styling. If Ed rejects on screenshot review,
Phase 1 re-styles before Phase 2 starts.

## Remaining follow-up (deferred to phase plan / post-v1)

- ⊘ **Q-HP-FOLLOWUP-3** — Direction of the room↔HP-indoor link
  (HP-side `served_room_ids[]` vs Room-side `hp_indoor_unit_ids[]`).
  Currently HP-side per D-HP-11. Revisit if real-project usage
  exposes UX friction with the asymmetric direction vs ERVs.
- ⊘ **Q-HP-FOLLOWUP-4** — Bulk import flow (AirTable / CSV / xlsx
  paste) for the four HP tables. Deferred to v1.1+; PRD §2.2 names
  the gap. A unified "paste tabular data into a table" primitive
  serving every equipment table is the right shape.
- ⊘ **Q-HP-FOLLOWUP-5** — System-marked single-select options.
  Recommended path if OPQ-7 resolution (b) (always-show
  `linked_erv_unit_id` picker) starts showing real friction with
  users. Would also benefit any other "system-known" option (e.g.
  bootstrapped `system_family` PUZ/PUHY/VRF distinctions used by
  filters).
- ⊘ **Q-HP-FOLLOWUP-6** — Multilateral `manufacturer` sharing
  across ERV / HP outdoor equip / HP indoor equip / Pumps / Fans.
  D-HP-21's `shared_with` directive is asymmetric (one canonical
  owner), so it doesn't fit. A small `equipment.manufacturer`
  shared namespace (Option C-style, scoped to just one concept) is
  the likely answer. Defer until real-project usage shows the
  duplicate-Mitsubishi pain.
- ⊘ **Q-HP-FOLLOWUP-7** (added 2026-06-09 during Phase 4 scope
  amendment) — "Linked from HP indoor" deep-link badge on the
  Ventilators row. Phase 4 PRD called for an ERV-modal badge
  showing `"Linked from HP indoor: AHU-N2B"` plus a `Linked HP
  indoor` count column; the count column shipped, but the modal
  badge and deep-link are blocked because Ventilators uses inline
  DataTable editing — no row-detail modal exists to host them.
  Revisit when / if Ventilators grows a row-detail modal pattern.
- ⊘ **Q-HP-FOLLOWUP-8** (added 2026-06-09 at archival) — Phase 5B
  MCP tools. Wire `read_table` / `add_row` / `update_row` /
  `delete_row` for the four HP table keys (verify the generic
  `tool_get_table` / `tool_replace_table` cover them first — they
  likely do); add a dedicated
  `export_phius_hp_estimator(project_id) → text/csv` tool that
  wraps the Phase 5A `compute_phius_payload` + `serialize_csv`.
  Schemas land in `context/technical-requirements/llm-mcp-schema.md`.
  Originally Phase 5 AC #7–11.
- ⊘ **Q-HP-FOLLOWUP-9** (added 2026-06-09 at archival) — Phase 5C
  Playwright e2e. Full-lifecycle spec at
  `frontend/tests/e2e/heat-pumps.spec.ts` covering: seed project
  with rooms + ervs; add rows across all four HP tables; integrate
  one indoor with an ERV; open the ERV row to verify the count
  column; run the Phius export and verify CSV row count + sample
  cells; delete an ERV and verify cascade-null fires; lock the
  version and verify read-only mode. Originally Phase 5 AC #12.
- ⊘ **Q-HP-FOLLOWUP-10** (added 2026-06-09 at archival) — Phase 5C
  cross-doc graduation per PRD §11. Fold durable bits into
  `context/PRD.md` §6.2 (add the four new tables to the equipment-
  tables enumeration), `context/technical-requirements/data-model.md`
  (add row schemas), `context/technical-requirements/api.md` §9.X
  (heat-pumps endpoints + Phius export), and
  `context/technical-requirements/llm-mcp-schema.md` (the MCP tool
  definitions from FOLLOWUP-8). The user-stories and GLOSSARY
  graduations were completed during Phase 1; only the technical-
  requirements docs remain. Originally Phase 5 AC #13–14.
- ⊘ **OPQ-3** (added 2026-06-09 at archival) — xlsx-paste payload
  format. Phase 5A backend returns 501 on `?format=xlsx-paste`.
  Revisit if the calc's paste-target validation actually rejects
  the CSV form; the v1.0 commit is CSV.
- ⊘ **Energy-model load-coverage validation.** No check that
  every conditioned Room is referenced by ≥1 HP indoor unit's
  `served_room_ids[]`. Same gap on the ERV side. Solve in one pass
  post-v1.

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
