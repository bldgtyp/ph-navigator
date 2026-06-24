---
DATE: 2026-06-09
TIME: 12:00
STATUS: Active — first pass
AUTHOR: Ed (via Claude)
SCOPE: Reference data model from a BLDGTYP AirTable base; informs V2 design
SOURCE: airtable.com/appX9NdtcDN2PmlE1
RELATED:
  - planning/features/heat-pumps/README.md
  - context/user-stories/30-tables-equipment.md
---

# Heat Pumps — Research Notes

## 1. The reference AirTable base

Base `appX9NdtcDN2PmlE1` is a typical BLDGTYP multifamily-Phius
project base. It contains 22 tables; the four that model heat-pump
data are:

| Table (AirTable name) | Table ID | Role |
|---|---|---|
| `HP: INDOOR-EQUIP` | `tblZdZCd84CpdkCGe` | "Equipment type" catalog for indoor units (25 records) |
| `HP: INDOOR-UNITS` | `tblERs07gAJlqjnma` | Installed indoor unit *instances* on the project (116 records) |
| `HP: OUTDOOR-EQUIP` | `tblzrUiTCP5U9ml6t` | "Equipment type" catalog for outdoor units (14 records) |
| `HP: OUTDOOR-UNITS` | `tblrLoTBq6c5n0fU7` | Installed outdoor unit *instances* on the project (30 records) |

In this project that's 14 outdoor "types" populating 30 installed
outdoor units, and 25 indoor "types" populating 116 installed indoor
units. The ratio of instance:type for outdoors is ~2:1; for indoors
it's ~4.6:1.

## 2. Field-level shape

### 2.1 `HP: INDOOR-EQUIP` (indoor equipment type)

| Field | Type | Notes |
|---|---|---|
| `MANUFACTURER` | singleSelect | e.g. MITSUBISHI |
| `MODEL_TYPE` | singleSelect | Sub-family code (PLA, TPVFY, TPKFY, PVA, PEAD, TPLFY, LEV) |
| `MODEL` | text | Often a **paired model code** like `PLA-A12EA8 [PUZ-A12NKA7]` — encodes the AHRI pairing in the model string itself |
| `INSTALL_TYPE` | singleSelect | `CEILING-CASSETTE` / `WALL_MOUNTED` / `CEILING-CONCEALED (DUCTED)` / `MULTI-POSITION` / `ERV-INTEGRATED` |
| `DATA_SHEET` | attachments | PDF cut-sheet for the equipment |
| `TONS [NOMINAL]` | number | |
| `FAN SPEED [CFM]` | number | |
| `COOLING CAPACITY [BTUH]` | number | |
| `HEATING CAPACITY @ 47F [BTUH]` | number | AHRI 47 °F rating |
| `HEATING CAPACITY @ 17F [BTUH]` | number | AHRI 17 °F rating — critical for cold-climate PH |
| `HEATING COP [Btuh/W]` | number | |
| `SEER`, `EER`, `HSPF` | number | |
| `SPECIFICATION` | singleSelect | QA evidence status (e.g. "needs-spec") |
| `HP: INDOOR-UNITS` | linkedRecords | back-link to instance rows |

### 2.2 `HP: OUTDOOR-EQUIP` (outdoor equipment type)

| Field | Type | Notes |
|---|---|---|
| `MANUFACTURER` | singleSelect | |
| `MODE_TYPE` | singleSelect | Topology family: `PUZ` (single-zone mini-split), `SUZ` (ducted single-zone), `PUHY` / `TUHYE` (VRF), `NTXM` (multi-zone) |
| `MODEL` | text | Paired model code, e.g. `PUZ-A18NKA7 [PVA-A18AA7]` vs `PUZ-A18NKA7 [PLA-A18EA8]` — **same outdoor model code recorded as TWO separate equipment rows because the AHRI numbers differ per pairing** |
| `DATA_SHEET` | attachments | Manufacturer cut-sheet |
| `AHRI_SHEET` | attachments | **AHRI directory certificate PDF** — separate doc proving the rating |
| `COOLING-KBTUH-95F` | number | AHRI 95 °F cooling |
| `HEATING-KBTUH-47F` / `HEATING-KBTUH-17F` | number | AHRI 47 / 17 °F heating |
| `COP-47F` / `COP-17F` | number | |
| `HSPF`, `EER`, `IEER`, `SEER` | number | |
| `HP: OUTDOOR-UNITS` | linkedRecords | back-link |
| `HP: INDOOR-UNITS [BUILDING]` | rollup | indirect — building zones served via the indoor units |
| `HP: OUTDOOR-EQUIP [COUNT]` | rollup | how many instances of this type are installed |

### 2.3 `HP: INDOOR-UNITS` (installed indoor instance)

| Field | Type | Notes |
|---|---|---|
| `TAG` | text | Drawing schedule tag (e.g. `AHU-17L`, `AHU-3D`) |
| `FLOOR_LEVEL` | text | Free-text floor (e.g. `1`, `1 / 2`) |
| `AREA_SERVED` | text | Free-text (`CORRIDOR / STAIR`, `LOBBY / VESTIBULE`, `NERV`) |
| `BUILDING` | singleSelect | Project zone (e.g. `NAR`) |
| `HP-EQUIP` | linkedRecord | → `HP: INDOOR-EQUIP` |
| `HP: OUTDOOR-UNITS` | linkedRecord | → which outdoor unit instance this indoor is connected to |
| `ERV UNITS` | linkedRecord | **optional** — link to integrated ERV when applicable |
| Several `*[…]` lookup fields | lookup | denormalized display columns from the linked equipment row |
| `NOTE` | text | |

### 2.4 `HP: OUTDOOR-UNITS` (installed outdoor instance)

| Field | Type | Notes |
|---|---|---|
| `TAG` | text | Drawing schedule tag (e.g. `HP-17`, `NHP-N4B-N4C`) |
| `HP: OUTDOOR-EQUIP` | linkedRecord | → equipment type row |
| `HP: INDOOR-UNITS` | linkedRecords (1:N) | reverse-side of the indoor-unit link — one outdoor serves many indoors |
| `DATA_SHEET` | attachments | **Per-instance** datasheet — exists in addition to the equip-level cut-sheet (rare but used) |
| `NOTE` | text | |

## 3. Cardinality observed in the real data

```
HP: OUTDOOR-EQUIP  ──1──N──>  HP: OUTDOOR-UNITS  ──1──N──>  HP: INDOOR-UNITS  ──N──1──>  HP: INDOOR-EQUIP
                                                                        ╲
                                                                         ╲──0..1──>  ERV UNITS   (only when INSTALL_TYPE = ERV-INTEGRATED)
```

Concrete examples from the base:

- Outdoor equipment **`TUHYE1204AN41AN`** (VRF, 115 kBTUH cooling)
  → outdoor units `HP-10, HP-16, HP-17, HP-18, HP-19, HP-20` (6
  installed instances)
  → **`HP-17` alone serves 12 indoor units** (`AHU-17B` … `AHU-17M`)
- Outdoor equipment **`PUZ-A18NKA7 [PLA-A18EA8]`** and
  **`PUZ-A18NKA7 [PVA-A18AA7]`** — same physical outdoor model code
  `PUZ-A18NKA7`, two separate equip rows because their AHRI numbers
  differ (`COP-47F` 4.28 vs 3.78; `HEATING-KBTUH-17F` 11 vs 12).
- ERV-integrated indoor type **`60000 Btu/h LEV Kit`** (a Mitsubishi
  Lossnay-coupled LEV kit) — `INSTALL_TYPE = ERV-INTEGRATED`,
  `MODEL_TYPE = LEV`; the indoor-unit instances using it (`N2B`,
  `N5`) link to ERV rows in the ERV UNITS table.

## 4. Key insights

### 4.1 The "EQUIP" tables are not catalogs in PH-Nav's sense

In the AirTable model, EQUIP rows live **inside the project base** — every project has its own equipment table. They are project-scoped
*type tables*, not a globally-shared library.

The justification (confirmed by what's in the data): a single physical
outdoor model gets *different* AHRI-certified numbers depending on the
indoor unit it's paired with. The pairing is the unit of certification,
and the pairing decision happens **per project**. A naïve cross-project
catalog keyed on `manufacturer + outdoor model` would either lose this
nuance or force the user to pick the "right variant" from a list of
near-identical rows.

That said, there *is* shared reference data we could surface from a
catalog: the manufacturer's nominal performance, the AHRI directory ID,
the cut-sheet PDF, the install-type taxonomy. **A future v1.1+
catalog could provide starting values** that the project copies and
then specializes for its specific pairing — this is the same shape as
the Materials catalog (`catalog_origin: null | <object>`), so we don't
need to commit to it now.

### 4.2 The "model string with brackets" is a workaround for missing pairing semantics

The bracketed-model convention (`PUZ-A18NKA7 [PLA-A18EA8]`) is a
shorthand because AirTable can't natively express "this equipment row
is an AHRI-rated pairing of model X with model Y". In V2 we can model
this cleanly — e.g. an outdoor equip row points to its certified
indoor equip pair(s), and the AHRI numbers belong to that pair.

### 4.3 The drawing-schedule TAG is the user-facing primary key for instances

Both `HP: OUTDOOR-UNITS` and `HP: INDOOR-UNITS` use `TAG` as the
display name (`HP-17`, `AHU-17L`). These match the GC mechanical
drawing schedule. This is the same pattern as Rooms (`number`) and
Thermal Bridges (`record_id`) in V2 — **Record-ID** field in PHN-speak.

### 4.4 ERV integration is a real edge case, not a pathological one

In the reference project, 6 of the 116 indoor units are
`INSTALL_TYPE = ERV-INTEGRATED` (the LEV Kit + Lossnay pattern).
These rows have a real relationship to an ERV row — same physical
device acting as both HP coil and ERV core.

This collides with the existing V2 plan (US-EQ-4 ERVs sub-tab):
should the ERV row be the source-of-truth and the HP indoor row
*reference* it? Or vice versa? Both are valid:

- **ERV-centric**: The integrated unit is fundamentally an ERV that
  also has refrigerant coils. Keep one row in ERVs, add a "linked HP
  indoor" pointer.
- **HP-centric**: The integrated unit is part of a heat-pump system;
  keep one row in HP Indoor Units with `install_type = ervi` and a
  pointer into the ERVs table for the ventilation-side data.

The AirTable base uses **HP-centric**: the indoor unit lives in
`HP: INDOOR-UNITS` and links *out* to a row in `ERV UNITS`. The
ERV row carries the airflow/HRE/electrical data; the HP indoor row
carries the heating/cooling coil data. Both rows physically describe
the same box.

### 4.5 The per-instance `DATA_SHEET` on outdoor units is real

We saw `HP: OUTDOOR-UNITS.DATA_SHEET` populated (in addition to
`HP: OUTDOOR-EQUIP.DATA_SHEET`). Likely use case: the equip-level
cut-sheet is the generic spec; the unit-level attachment is the
AHRI cert with the *as-installed* refrigerant-line-set length, or a
field-marked-up submittal. We should think about whether to support
both, or whether to fold this into a single per-instance datasheet
slot when needed.

### 4.6 What's *not* captured here that we should expect to need

The AirTable model doesn't store:
- **Refrigerant type and charge** (R-410A, R-32, R-454B — Phius/PHIUS
  certification is starting to care about GWP).
- **Refrigerant pipe length** (matters for VRF correction factors).
- **Defrost strategy / low-ambient cutoff** (the ERV table has these
  fields but the HP one doesn't).
- **Backup / supplemental heat** (resistance strip, hot-water coil).
- **Domestic-hot-water integration** (some HPs do dual-purpose
  heating + DHW).
- **Service zone / served-rooms link** (we'd want to mirror the ERV
  → Rooms link so PH energy modeling can attribute loads).

Most of these are deferrable, but **served-rooms link** is probably
v1 because it parallels the existing ERV ↔ Rooms relationship.

## 5. Sketch — possible V2 data shape (NOT a commitment)

Two flavors of the data model are worth comparing in the next pass.
Both share these primitives:

```jsonc
tables.equipment.heat_pumps_outdoor = [
  {
    "id": "hpo_<ULID>",
    "tag": "HP-17",                         // Record-ID
    "outdoor_equip_id": "hpoe_<ULID>",      // → tables.equipment.heat_pump_outdoor_equip
    "datasheet_asset_ids": [],              // per-instance, optional
    "notes": null
  }
]

tables.equipment.heat_pump_outdoor_equip = [
  {
    "id": "hpoe_<ULID>",
    "manufacturer": "opt_<ULID>",           // single-select
    "model_number": "PUZ-A18NKA7",          // bare outdoor model code
    "paired_indoor_model": "PVA-A18AA7",    // explicit pairing field (replaces the bracket trick)
    "system_family": "opt_<ULID>",          // single-select: PUZ / PUHY / TUHYE / SUZ / NTXM / … (renamed from mode_type per D-HP-24)
    "ahri_certificate_number": "12345678",
    "cooling_kbtuh_95f": 18.0,
    "heating_kbtuh_47f": 19.0,
    "heating_kbtuh_17f": 12.0,
    "cop_47f": 4.28,
    "cop_17f": 2.85,
    "hspf": 9.2,
    "eer": 14.4,
    "seer": 25.0,
    "ieer": null,
    "refrigerant": "opt_<ULID>",            // R-410A / R-32 / R-454B
    "datasheet_asset_ids": [],
    "ahri_sheet_asset_ids": [],
    "catalog_origin": null                  // forward-compat
  }
]

tables.equipment.heat_pumps_indoor = [
  {
    "id": "hpi_<ULID>",
    "tag": "AHU-17L",                       // Record-ID
    "indoor_equip_id": "hpie_<ULID>",       // → tables.equipment.heat_pump_indoor_equip
    "outdoor_unit_id": "hpo_<ULID>",        // → which installed outdoor unit
    "served_room_ids": [],                  // mirror of ERV-served pattern
    "linked_erv_unit_id": null,             // only when install_type = ervi
    "floor_level": "opt_<ULID>",            // user-defined single-select
    "area_served": "CORRIDOR / STAIR",      // free-text
    "datasheet_asset_ids": [],
    "notes": null
  }
]

tables.equipment.heat_pump_indoor_equip = [
  {
    "id": "hpie_<ULID>",
    "manufacturer": "opt_<ULID>",
    "model_type": "opt_<ULID>",             // sub-family code (PLA / TPVFY / …)
    "model_number": "PLA-A12EA8",
    "install_type": "opt_<ULID>",           // CASSETTE / WALL / CONCEALED-DUCTED / MULTI-POSITION / ERV-INTEGRATED
    "nominal_tons": 1.0,
    "fan_speed_cfm": 350,
    "cooling_btuh": 12000,
    "heating_btuh_47f": 14000,
    "heating_btuh_17f": 10600,
    "heating_cop": 3.5,
    "seer": 26.9, "eer": 16.4, "hspf": 10.9,
    "datasheet_asset_ids": [],
    "catalog_origin": null
  }
]
```

Open architecture choice — **do we keep the EQUIP/UNIT split, or
inline?**

- **EQUIP/UNIT split** (above). Mirrors AirTable. Pro: an outdoor
  type used by 6 instances has its AHRI numbers in one place. Con:
  4 tables for one feature; complicates the Equipment sub-tab UX.
- **Inlined**. Each HP outdoor row carries its own perf numbers,
  duplicated across instances. Pro: 2 tables; users edit the
  numbers once per unit, not via a separate type-picker. Con: 6
  duplicate copies of `TUHYE1204AN41AN`'s numbers; updating the
  AHRI cert means 6 edits.
- **Hybrid**. One pair of tables (`heat_pumps_outdoor`,
  `heat_pumps_indoor`) where each row carries both the
  identification (manufacturer/model) and the AHRI performance
  numbers. A "Type" view in the UI groups instances by
  `manufacturer + model_number + paired_indoor_model` and lets the
  user edit shared numbers across all sharing instances in one
  action. This collapses the catalog→instance distinction in
  storage but preserves it in UX.

## 6. Open discussion questions

Numbered so we can resolve them in `decisions.md`.

1. **Q-HP-1: Catalog vs project-only.** Confirm: V2 v1 ships HPs
   as project-only equipment (no shared catalog), aligned with
   ERVs / Pumps / Fans. Forward-compat `catalog_origin: null`
   field exists on equipment rows so v1.1+ catalog is purely
   additive.

2. **Q-HP-2: Storage shape — EQUIP/UNIT split, inlined, or
   hybrid?** (See §5 trade-offs.) Affects how many sub-tabs and
   data tables we ship.

3. **Q-HP-3: One sub-tab or two?** Options:
   - "Heat Pumps" single sub-tab with two views toggle
     (Outdoor / Indoor).
   - Two sub-tabs ("HP Outdoor", "HP Indoor"). Pushes
     Equipment-tab count from 5 → 7 (Rooms / TBs / ERVs /
     Pumps / Fans + HP-Out / HP-In).
   - One sub-tab with a master-detail UX: outdoor row at top,
     its indoor children below.

4. **Q-HP-4: ERV-integrated handling.** Where does the
   data for an ERV-INTEGRATED indoor unit live?
   - In `HP: INDOOR-UNITS` with a pointer into `ERV UNITS`
     (AirTable's choice).
   - In `ERV UNITS` with a pointer into `HP: INDOOR-UNITS`.
   - As a separate "integrated unit" sub-table that owns both
     responsibilities.

5. **Q-HP-5: AHRI directory integration.** Should we capture the
   AHRI certificate number explicitly (so we can link to
   ahridirectory.org), or rely on the PDF attachment only?

6. **Q-HP-6: Refrigerant / GWP tracking.** Include `refrigerant`
   single-select on outdoor equip in v1, or defer? Phius is
   moving toward this; Ed has expressed this is on the radar.

7. **Q-HP-7: Served-rooms link.** Add `served_room_ids[]` on the
   indoor instance row (mirroring `tables.rooms[*].erv_unit_ids`)
   in v1, or defer? Energy-model integration argues for v1.

8. **Q-HP-8: Per-instance datasheet on outdoor units.** Keep
   AirTable's optional per-instance `datasheet_asset_ids[]` on
   the outdoor *unit* row, in addition to the equipment-level
   datasheet, or just one slot?

9. **Q-HP-9: Position in the Equipment sub-tab ordering.** Where
   in the existing strip (Rooms / Thermal Bridges / ERVs /
   Pumps / Fans) do HPs land? Likely between ERVs and Pumps
   (heating/cooling first, then auxiliary).

10. **Q-HP-10: Backup / supplemental heat.** Capture in v1 (with
    a `backup_heat_type` and `backup_heat_kw`) or defer?
