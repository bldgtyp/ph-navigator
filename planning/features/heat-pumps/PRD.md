---
DATE: 2026-06-09
TIME: 14:30
STATUS: DRAFT — first complete PRD pass; awaiting Ed review before
        US-EQ-7..11 user-story stubs land in
        context/user-stories/30-tables-equipment.md.
AUTHOR: Ed May (with Claude)
SCOPE: Heat Pump equipment in PH-Navigator V2 — four project-scoped
       tables (catalog + instance × outdoor + indoor), nested-tab UX
       under the existing Equipment tab, ERV ↔ HP-indoor cross-link,
       and a one-click Phius Multiple Heat Pump Performance Estimator
       export.
RELATED:
  - planning/features/heat-pumps/README.md
  - planning/features/heat-pumps/research.md
  - planning/features/heat-pumps/decisions.md
  - context/PRD.md §6.2 (project document tables), §6.3 (per-project
    non-catalog tables), §7.0 (future equipment catalogs)
  - context/user-stories/30-tables-equipment.md (US-Builder-Tables,
    US-Builder-Equipment; this feature adds US-EQ-7..11 and amends
    US-EQ-4)
  - context/GLOSSARY.md (terms added: HP Outdoor Equipment, HP Indoor
    Equipment, HP Outdoor Unit, HP Indoor Unit, Integrated unit)
  - context/technical-requirements/data-table.md (DataTable contract
    inherited by every sub-tab below)
  - context/technical-requirements/attachments.md (datasheet uploads
    use the existing `<AttachmentCell>` backbone)
  - context/CODING_STANDARDS.md (backend feature split:
    routes/models/service/repository)
---

# PH-Navigator V2 — Heat Pumps Feature PRD

## 0. Current-status note

This PRD is the authoring document for the Heat Pumps feature. The
`STATUS.md` companion (when implementation starts) is the source of
truth for *where we are*; this PRD is the source of truth for *what
we're building and why*. Durable decisions made during implementation
graduate from here into `context/user-stories/30-tables-equipment.md`,
`context/GLOSSARY.md`, and `context/PRD.md`.

## 1. Why this doc exists

Heat Pumps are the largest piece of mechanical equipment the
PH-Navigator project document does not yet model. Every BLDGTYP
multifamily Phius project ships with two to twenty distinct outdoor
condensing units feeding tens to hundreds of indoor air-handlers or
cassettes; the Phius certification submittal hinges on the
**Phius Multiple Heat Pump Performance Estimator** spreadsheet
(currently `v25.1.1`, 2025-04 revision), which aggregates outdoor-unit
performance ratings into the project's certified heating / cooling
load calculations.

Today this data lives in per-project AirTable bases (see
`planning/features/heat-pumps/research.md`). The AirTable model uses a
four-table shape — outdoor equipment / outdoor units / indoor equipment
/ indoor units — that this PRD ports into the V2 project document
with three improvements:

1. **Explicit pairing field** replaces the AirTable model-string
   bracket convention (`PUZ-A18NKA7 [PLA-A18EA8]` → separate
   `model_number` and `paired_indoor_model` columns).
2. **Phius-aligned performance field set** — `heating_data_type` /
   `cooling_data_type` discriminators plus both M1 (HSPF2 / SEER2 /
   EER2) and legacy (HSPF / SEER / EER) metrics so projects can
   record whatever rating procedure the available datasheet
   provides.
3. **ERV cross-link** — the integrated-coil case (Mitsubishi LEV Kit
   + Lossnay LGH) is a first-class relationship, not a
   workaround.

Acceptance criteria, data model, navigation, and phasing are all
spelled out below; the open architecture-shaping decisions have been
resolved in `planning/features/heat-pumps/decisions.md` and are not
re-litigated here.

## 2. Goal and non-goals

### 2.1 Goal

After this feature ships, a CPHC editor can:

1. Define every distinct outdoor condensing unit model used on the
   project as one row in **HP: Equipment — Outdoor**, with full
   manufacturer / model / refrigerant / Phius-calc-aligned
   performance data.
2. Define every distinct indoor head / cassette / concealed-duct
   model used on the project as one row in **HP: Equipment —
   Indoor**.
3. Record every physically installed outdoor condenser as one row in
   **HP: Units — Outdoor**, tagged with the GC drawing schedule label
   (e.g. `HP-17`) and referencing one outdoor equipment row.
4. Record every physically installed indoor unit as one row in
   **HP: Units — Indoor**, tagged with the drawing schedule label
   (e.g. `AHU-17L`), referencing one indoor equipment row, one
   outdoor unit it's wired to, and the rooms it serves.
5. For Mitsubishi-style integrated coils, additionally link the HP
   indoor unit to its corresponding row in the **ERV** sub-tab —
   one physical box, two rows of metadata.
6. Export the **HP: Equipment — Outdoor** table directly into the
   Phius Multiple Heat Pump Performance Estimator's
   "Air Source Heat Pump Performance Data" section, with `Qty`
   auto-derived from instance counts.
7. Use a Viewer (read-only) URL to share any of the four DataTables
   with a contractor or certifier without granting write access.

### 2.2 Non-goals (V2 v1)

- **Shared / global Heat Pump catalog.** Performance is pairing-
  specific and project-specific; a cross-project catalog is rejected
  for v1 (per `decisions.md` D-HP-1). The `catalog_origin` field
  shape exists on equipment rows so a v1.1+ catalog can land
  additively.
- **AHRI directory integration.** No `ahri_certificate_number` field,
  no link-out, no automatic scrape. The user attaches whatever
  rating PDF the manufacturer ships (per `decisions.md` D-HP-AHRI).
- **Backup / supplemental heat fields** (resistance strip, hot-water
  coil, separate furnace). Deferred to v1.1+ (per `decisions.md`
  D-HP-12).
- **Domestic-hot-water integration.** HPs that also produce DHW are
  not modeled in v1; this is a heat-pump-water-heater conversation
  that belongs in a future DHW feature.
- **Refrigerant-pipe-length correction factors.** Not modeled in v1;
  the user records the rated values from the certified pairing.
- **Schedule output to Rhino / HBJSON.** HBJSON consumes Rooms
  data; HPs are downstream metadata, not geometry. Future
  integration is a separate feature.

## 3. Vocabulary additions (graduate to GLOSSARY.md on merge)

| Term | Definition |
|---|---|
| **HP Outdoor Equipment** | Project-scoped type table; one row per unique AHRI-rated outdoor + indoor pairing used on the project. Carries the performance data the Phius calculator consumes. |
| **HP Indoor Equipment** | Project-scoped type table; one row per unique indoor model used on the project. |
| **HP Outdoor Unit** | An installed condenser instance with a drawing-schedule tag (e.g. `HP-17`). References one HP Outdoor Equipment row. |
| **HP Indoor Unit** | An installed indoor head / cassette / concealed-duct instance with a drawing-schedule tag (e.g. `AHU-17L`). References one HP Indoor Equipment row, the HP Outdoor Unit it's wired to, and 0..N served Rooms. |
| **Integrated unit** | A physical box that implements both an HP indoor coil and an ERV core (e.g. Mitsubishi LEV Kit + Lossnay LGH). Modeled as one HP Indoor Unit row + one ERV row, linked by `linked_erv_unit_id`. |
| **Phius HP Performance Estimator** | The current-version spreadsheet (`Phius_Heat Pump Performance Estimator_v25.1.1_2025.04.xlsx`) the project's certified heating/cooling totals are aggregated through. Its "Air Source Heat Pump Performance Data" section is the export target. |

## 4. Data model

### 4.1 Storage location

Heat-pump tables live in the project document body under the
existing `tables.equipment` namespace (sibling of `ervs`, `pumps`,
`fans`):

```jsonc
{
  "tables": {
    "equipment": {
      "ervs": [ /* unchanged */ ],
      "pumps": [ /* unchanged */ ],
      "fans": [ /* unchanged */ ],
      "heat_pump_outdoor_equip": [ /* NEW */ ],
      "heat_pump_indoor_equip":  [ /* NEW */ ],
      "heat_pump_outdoor_units": [ /* NEW */ ],
      "heat_pump_indoor_units":  [ /* NEW */ ]
    }
  }
}
```

All mutations route through the draft buffer as JSON-Patches
(`tables.equipment.heat_pump_outdoor_equip[N]` etc.), inheriting the
US-Builder-Tables criterion 15 contract.

### 4.2 `heat_pump_outdoor_equip[*]` — outdoor equipment row

20 fields. Per `decisions.md` D-HP-6 / D-HP-7. See decisions doc for
the full field-level rationale; only the canonical shape is repeated
here.

```jsonc
{
  "id": "hpoe_<ULID>",
  "manufacturer":           "opt_<ULID> | null",   // single_select, user-defined
  "model_number":           "PUZ-A18NKA7",          // bare outdoor model code; required
  "paired_indoor_model":    "PVA-A18AA7 | null",    // indoor model whose AHRI cert this row carries
  "mode_type":              "opt_<ULID> | null",    // single_select; e.g. PUZ / PUHY / TUHYE / SUZ / NTXM
  "refrigerant":            "opt_<ULID> | null",    // single_select; e.g. R-410A / R-32 / R-454B

  "heating_data_type":      "cops | hspf2 | null",  // Phius export discriminator
  "heating_cap_kbtuh_17f":  null,                   // ✅ Phius (cops)
  "heating_cap_kbtuh_47f":  null,                   // ✅ Phius (cops)
  "heating_cop_17f":        null,                   // ✅ Phius (cops)
  "heating_cop_47f":        null,                   // ✅ Phius (cops)
  "hspf2":                  null,                   // ✅ Phius (hspf2)
  "hspf":                   null,                   // legacy, reference only

  "cooling_data_type":      "eer2_seer2 | ieer | null",  // Phius export discriminator
  "cooling_cap_kbtuh_95f":  null,                   // ✅ Phius (both)
  "eer2":                   null,                   // ✅ Phius (eer2_seer2)
  "seer2":                  null,                   // ✅ Phius (eer2_seer2)
  "ieer":                   null,                   // ✅ Phius (ieer)
  "eer":                    null,                   // legacy, reference only
  "seer":                   null,                   // legacy, reference only

  "datasheet_asset_ids":    [],                     // see context/technical-requirements/attachments.md
  "notes":                  null,
  "catalog_origin":         null                    // forward-compat for v1.1+ catalog
}
```

### 4.3 `heat_pump_indoor_equip[*]` — indoor equipment row

Per `decisions.md` D-HP-8. Indoor performance fields use the older
labels because the Phius calc does not consume per-indoor metrics.

```jsonc
{
  "id": "hpie_<ULID>",
  "manufacturer":      "opt_<ULID> | null",   // single_select
  "model_type":        "opt_<ULID> | null",   // single_select; e.g. PLA / TPVFY / TPKFY / PVA / PEAD / TPLFY / LEV
  "model_number":      "PLA-A12EA8",
  "install_type":      "opt_<ULID> | null",   // single_select; e.g. CASSETTE / WALL-MOUNTED / CONCEALED-DUCTED / MULTI-POSITION / ERV-INTEGRATED
  "nominal_tons":      null,
  "fan_speed_cfm":     null,
  "cooling_btuh":      null,
  "heating_btuh_47f":  null,
  "heating_btuh_17f":  null,
  "heating_cop":       null,
  "seer":              null,
  "eer":               null,
  "hspf":              null,
  "datasheet_asset_ids": [],
  "notes":             null,
  "catalog_origin":    null
}
```

### 4.4 `heat_pump_outdoor_units[*]` — outdoor unit (instance) row

Per `decisions.md` D-HP-9.

```jsonc
{
  "id": "hpou_<ULID>",
  "tag":               "HP-17",              // Record-ID; required; unique within project (trim + case-insensitive)
  "outdoor_equip_id":  "hpoe_<ULID>",        // → heat_pump_outdoor_equip[*].id; required
  "building_zone":     "opt_<ULID> | null",  // same option list as tables.rooms[*].building_zone
  "datasheet_asset_ids": [],                  // rarely populated; AirTable model has this slot occasionally used
  "notes":             null
}
```

### 4.5 `heat_pump_indoor_units[*]` — indoor unit (instance) row

Per `decisions.md` D-HP-10 / D-HP-11 / D-HP-4.

```jsonc
{
  "id": "hpiu_<ULID>",
  "tag":                  "AHU-17L",          // Record-ID; required; unique within project
  "indoor_equip_id":      "hpie_<ULID>",       // → heat_pump_indoor_equip[*].id; required
  "outdoor_unit_id":      "hpou_<ULID> | null",// → heat_pump_outdoor_units[*].id; nullable (in-progress entry)
  "linked_erv_unit_id":   "erv_<ULID> | null", // → tables.equipment.ervs[*].id; populated only for integrated coils
  "served_room_ids":      [],                  // each id → tables.rooms[*].id; energy-model load attribution
  "floor_level":          "opt_<ULID> | null", // same option list as tables.rooms[*].floor_level
  "area_served":          null,                // free text, e.g. "CORRIDOR / STAIR"
  "datasheet_asset_ids":  [],
  "notes":                null
}
```

### 4.6 Referential integrity rules

| When | What happens | Why |
|---|---|---|
| Outdoor equip row deleted while >0 outdoor units reference it | Block delete; toast lists referencing units | Same pattern as deleting a referenced single-select option (US-Builder-Tables §16) |
| Indoor equip row deleted while >0 indoor units reference it | Block delete; toast lists referencing units | Same |
| Outdoor unit row deleted while >0 indoor units reference it | Indoor units' `outdoor_unit_id` set to `null`; soft-warning toast lists affected indoor tags | Same shape as US-EQ-2 criterion 6 (ERV-delete → rooms unset) |
| ERV row deleted while >0 indoor HP units link to it via `linked_erv_unit_id` | Indoor units' `linked_erv_unit_id` set to `null`; soft-warning toast | Mirrors above; the HP unit's other data is still valid |
| Room row deleted while >0 indoor HP units reference it via `served_room_ids[]` | Each referencing indoor unit's `served_room_ids[]` array filters out the deleted id; no toast (silent) | Mirrors ERV ↔ rooms direction |
| HP indoor unit row deleted while linked to an ERV row | ERV row untouched; reverse-lookup surface (§5.4) drops the deleted indoor reference | One-way link; HP-side deletion is fully reversible from the user's POV without ERV-side disruption |

## 5. UI and navigation

### 5.1 Sub-tab structure (per `decisions.md` D-HP-3 / D-HP-13)

Equipment tab gains one slot called **Heat Pumps**, which contains a
nested sub-tab strip with four leaf pages:

```text
Equipment tab (existing)
  ├─ Rooms
  ├─ Thermal Bridges
  ├─ ERVs
  ├─ Heat Pumps                                ◄── new outer slot
  │   ├─ Equipment — Outdoor   (default)        ◄── DataTable: heat_pump_outdoor_equip
  │   ├─ Equipment — Indoor                     ◄── DataTable: heat_pump_indoor_equip
  │   ├─ Units — Outdoor                        ◄── DataTable: heat_pump_outdoor_units
  │   └─ Units — Indoor                         ◄── DataTable: heat_pump_indoor_units
  ├─ Pumps
  └─ Fans
```

The outer tab strip uses the existing shadcn `Tabs` variant; the
nested strip uses a visually subordinate variant
(`size="sm"` or equivalent — final treatment is a phase-plan
detail). One DataTable per leaf page — no horizontal splits, no
segmented overlays.

### 5.2 Routes

```
/projects/{id}/equipment/heat-pumps
   → redirect to /equipment-outdoor

/projects/{id}/equipment/heat-pumps/equipment-outdoor
/projects/{id}/equipment/heat-pumps/equipment-indoor
/projects/{id}/equipment/heat-pumps/units-outdoor
/projects/{id}/equipment/heat-pumps/units-indoor
```

Browser back / forward navigates between leaf pages within the
Heat Pumps slot. Per US-Builder-Tables criterion 3, view state
(sort / filter / group) is in-memory per leaf and resets on reload.

### 5.3 Default column visibility on the wide outdoor-equip table

20 fields would be unusable as a default view. Default-visible
columns (subject to phase-plan refinement):

1. Manufacturer
2. Model number
3. Paired indoor model
4. Mode type
5. Refrigerant
6. Heating data type
7. Cooling data type
8. Cooling capacity @ 95°F
9. The "active" heating perf field — chosen from the row's
   `heating_data_type`: if `cops`, show `heating_cop_47f` and
   `heating_cop_17f`; if `hspf2`, show `hspf2`. This is a
   **conditional column** — visible based on per-row value.
   (Alternative: show both columns always, hidden cells render
   empty. Pin the choice in phase 1.)
10. The "active" cooling perf field — same conditional rule.
11. Datasheet (`<AttachmentCell>`)

Hidden-by-default: the legacy `hspf`, `seer`, `eer`, the
inactive-side performance fields, `notes`. User toggles via the
column-visibility overflow menu (US-Builder-Tables §14 / general
DataTable contract).

### 5.4 ERV cross-link surfaces

**On the HP indoor row-detail modal** (`Units — Indoor` page):

- A "Linked ERV unit" field appears in the modal. Visible when the
  row's referenced indoor equip has `install_type` matching an
  ERV-integrated option (initial seeded set includes
  `ERV-INTEGRATED`; user can rename). Hidden otherwise.
- The field is a single-select dropdown listing the project's ERV
  rows by `name`.
- Cleared field = `linked_erv_unit_id: null`.

**On the ERV row-detail modal** (`ERVs` sub-tab — US-EQ-4):

- A small read-only badge appears in the modal header:
  `"Linked from HP indoor: AHU-N2B"` when one or more HP indoor
  rows link to this ERV.
- Clicking the tag opens the linked HP indoor row in the
  `Units — Indoor` page. (Tab-deep-link per Q-LAND-1 conventions.)

**On the ERVs DataTable** (`ERVs` sub-tab):

- A small column "Linked HP indoor" (default-hidden) shows the
  count of HP indoor units linked to each ERV row. Lets a user
  quickly find integrated-unit ERVs vs standalone ERVs.

This requires a small amendment to US-EQ-4 (ERVs sub-tab) — the
new column and the modal badge are additive; no schema change to
ERV rows.

### 5.5 Add-row UX

All four DataTables inherit US-Builder-Tables criterion 7
(hand-enter row + "Pick from catalog" hidden). The catalog button
stays hidden in V2 v1 for all four; `catalog_origin` is `null` on
new rows and the field shape is forward-compatible for v1.1+.

**Outdoor unit add-row** opens the row-detail modal with an
"Outdoor equipment" picker (required) sourcing
`heat_pump_outdoor_equip[*]`. Inline "Create new outdoor equipment"
shortcut at the bottom of the picker shortcuts the user into the
outdoor-equip add-row flow without leaving the page.

**Indoor unit add-row** offers the same two picker shortcuts —
"Indoor equipment" (required) and "Outdoor unit" (optional). The
Rooms multi-select shows the project's rooms by `name` / `number`
per US-EQ-2.

### 5.6 Empty states

| Page | Empty copy |
|---|---|
| Equipment — Outdoor | "No outdoor heat-pump models defined. **[+ Add outdoor model]**." |
| Equipment — Indoor | "No indoor heat-pump models defined. **[+ Add indoor model]**." |
| Units — Outdoor | "No outdoor units installed. **[+ Add outdoor unit]**." Secondary line if `heat_pump_outdoor_equip` is empty: "Add an outdoor model first." |
| Units — Indoor | Same as outdoor with parallel copy. |

### 5.7 Locked-version + Viewer rendering

Inherits US-Builder-Tables criterion 13. All four pages render
read-only: cell edits disabled, add / delete hidden, sort / filter /
group / ⌘C still functional. The ERV-link badge stays visible (it's
just metadata); the picker dropdowns become bare display fields.

## 6. Phius Multiple Heat Pump Performance Estimator export

### 6.1 What gets exported

Source: `tables.equipment.heat_pump_outdoor_equip[]`. One CSV row
per outdoor equipment record. Indoor data, instance data, and ERV
links are not part of this export — they exist for project-side
documentation.

### 6.2 Column mapping

| Calc column | Source field | Notes |
|---|---|---|
| Device(s) | `model_number` + ` [` + `paired_indoor_model` + `]` | Reconstructs the bracketed display the calc expects |
| Qty | `count(heat_pump_outdoor_units where outdoor_equip_id = this.id)` | Derived, never user-entered |
| Heating Data Type | `heating_data_type` ∈ {`COPs`, `HSPF2`} | Title-cased values matching the calc dropdown |
| Cap @ 17°F | `heating_cap_kbtuh_17f` | Only when `heating_data_type=cops` |
| Cap @ 47°F | `heating_cap_kbtuh_47f` | Only when `heating_data_type=cops` |
| COP @ 17°F | `heating_cop_17f` | Only when `heating_data_type=cops` |
| COP @ 47°F | `heating_cop_47f` | Only when `heating_data_type=cops` |
| HSPF (header label) | `hspf2` | Only when `heating_data_type=hspf2` (the calc accepts only HSPF2 here despite the legacy column header) |
| Cooling Data Type | `cooling_data_type` ∈ {`EER2/SEER2`, `IEER`} | |
| Cap @ 95°F | `cooling_cap_kbtuh_95f` | Both modes |
| EER | `eer2` | Only when `cooling_data_type=eer2_seer2` |
| SEER | `seer2` | Only when `cooling_data_type=eer2_seer2` |
| IEER | `ieer` | Only when `cooling_data_type=ieer` |

### 6.3 Export UX

A "Export to Phius HP Estimator…" item appears in the overflow
`⋯` menu of the **Equipment — Outdoor** page, alongside the
existing "Download as JSON" (US-Builder-Tables criterion 14). When
clicked:

1. Backend computes the per-row `Qty` from outdoor-unit instance
   counts.
2. Returns a CSV with the column order above. (Optional v1
   stretch: also offer an xlsx-paste payload that respects the
   calc's exact cell coordinates.)
3. Browser triggers download.

### 6.4 Pre-export validation

Per row, before export:

- `heating_data_type` populated. If null, export marks row with a
  warning and writes empty cells for that row's heating block.
- For `heating_data_type=cops`: all four COPs fields populated.
- For `heating_data_type=hspf2`: `hspf2` populated.
- `cooling_data_type` populated. Same conditional logic.

The download UX surfaces a pre-flight dialog listing rows with
missing required fields. User can proceed (with gaps) or cancel
and fix.

## 7. User stories (graduate to context/user-stories/30-tables-equipment.md)

This PRD generates five new user stories and one amendment. All
inherit US-Builder-Tables criteria 1–17 and US-Builder-Equipment
(US-EQ-1).

| Story | Title | Source-of-truth fields | Inherits |
|---|---|---|---|
| **US-EQ-7** | Heat Pumps sub-tab structure (nested-tab navigation) | The Heat Pumps slot in Equipment + four leaf routes | US-EQ-1 |
| **US-EQ-8** | HP Equipment — Outdoor DataTable | `heat_pump_outdoor_equip[]` shape + 6.x Phius export | US-Builder-Tables 1–17 |
| **US-EQ-9** | HP Equipment — Indoor DataTable | `heat_pump_indoor_equip[]` shape | US-Builder-Tables 1–17 |
| **US-EQ-10** | HP Units — Outdoor DataTable | `heat_pump_outdoor_units[]` shape + outdoor-equip picker | US-Builder-Tables 1–17 |
| **US-EQ-11** | HP Units — Indoor DataTable | `heat_pump_indoor_units[]` shape + indoor-equip, outdoor-unit, ERV, rooms pickers | US-Builder-Tables 1–17 |
| **US-EQ-4 amend** | ERVs sub-tab — "Linked from HP indoor" surfaces | Reverse-lookup badge + count column + cross-table delete handling | — |

Story body drafts will land in the same `30-tables-equipment.md`
file alongside US-EQ-2 / 3 / 4 / 5 / 6 once this PRD is approved.

## 8. Backend contract

Following `context/CODING_STANDARDS.md`, each new table gets its
own feature folder with `routes.py` / `models.py` / `service.py` /
`repository.py`. Because the four tables share a domain, we group
them under one feature module rather than four:

```
backend/features/heat_pumps/
  __init__.py
  models.py            # Pydantic v2 row models + table containers
  repository.py        # Raw SQL through the project_document body
  service.py           # Validation, referential integrity, ERV
                       # cross-link rules, Phius export computation
  routes.py            # REST endpoints for the four tables + export
  phius_export.py      # Phius calc column mapping + CSV serializer
```

### 8.1 REST endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/projects/{id}/equipment/heat-pumps` | Returns all four tables as one composite payload (matches the Equipment-tab read pattern) |
| `PATCH` | `/api/v1/projects/{id}/equipment/heat-pumps/{table}` | One JSON-Patch operation per call, against `tables.equipment.{table}[*]` |
| `POST` | `/api/v1/projects/{id}/equipment/heat-pumps/export-phius` | Returns CSV; query param `?format=xlsx-paste` for the v1 stretch payload |

`{table}` ∈ `outdoor-equip` / `indoor-equip` / `outdoor-units` /
`indoor-units`. Routes follow `context/technical-requirements/api.md`
shapes.

### 8.2 MCP tools

Each DataTable inherits the four standard MCP tools per
US-Builder-Tables §LLM-friendliness hook (`read_table`, `add_row`,
`update_row`, `delete_row`). Plus one heat-pump-specific tool:

- `export_phius_hp_estimator(project_id) → text/csv` — produces
  the Phius export payload for the project's outdoor equipment.

These land in `context/technical-requirements/llm-mcp-schema.md`
alongside the other equipment tables' tool definitions.

## 9. Phasing

Six phases. Each phase ships a green CI build and a working slice
the user can verify; later phases only depend on earlier ones,
never the reverse.

| Phase | Title | What ships |
|---|---|---|
| **0** | Backend foundation | Pydantic v2 row models, repository, service skeleton, migration to extend `tables.equipment` shape, REST endpoints (no validation logic yet), seed data for one project, pytest coverage |
| **1** | HP Equipment — Outdoor DataTable | Frontend page wired to backend; full 20-field row-detail modal with conditional column visibility; column visibility defaults; basic add / edit / delete; legacy + v2 field acceptance |
| **2** | HP Equipment — Indoor DataTable | Frontend page wired; row-detail modal; inherits patterns from Phase 1 |
| **3** | HP Units — Outdoor + Indoor DataTables | Two pages wired; outdoor-unit picker on the indoor units page; outdoor-equip picker on the outdoor units page; indoor-equip picker on the indoor units page; tag uniqueness; referential-integrity rules |
| **4** | ERV cross-link + Rooms link | `linked_erv_unit_id` picker on indoor unit modal (gated by `install_type`); reverse-lookup badge on ERV modal; new ERVs column; `served_room_ids[]` picker; US-EQ-4 amendment lands |
| **5** | Phius export + polish | `export_phius_hp_estimator` MCP tool; CSV download from `⋯` menu; pre-export validation dialog; MCP `read/add/update/delete_row` tools wired for all four tables; full e2e Playwright pass |

A v1.1+ Phase 6 (column-visibility persistence, AHRI directory
integration, backup-heat fields, shared catalog) is out of scope for
this PRD and not pre-planned.

### 9.1 Phase ordering rationale

Phase 0 unblocks all frontend work. Phases 1–2 are structurally
identical pages; landing them in sequence lets Phase 1 establish the
conditional-column-visibility primitive that Phase 2 reuses. Phase 3
introduces the picker primitive shared by both unit pages, and
exercises cross-table referential integrity. Phase 4 is the only
phase that touches existing US-EQ-4 surfaces, so it ships
independently (and merges cleanly with concurrent ERV-side work).
Phase 5 lands the Phius export and the MCP tool stack, which depend
on the underlying data being clean — not a moment sooner.

## 10. Open implementation questions (phase-plan scope)

These are not architectural; they're decisions the phase author
makes when writing the phase file.

- **OPQ-1**: Conditional column visibility on the outdoor-equip
  DataTable (per-row based on discriminator) vs always-visible-but-
  empty cells. Pin in Phase 1.
- **OPQ-2**: Exact shadcn variant for the nested Heat Pumps sub-tab
  strip. Pin in Phase 1.
- **OPQ-3**: xlsx-paste payload format (v1 stretch goal in Phase 5)
  — exact rectangular range, header included or not, sheet-name
  override.
- **OPQ-4**: Whether the "Linked ERV unit" field is hidden vs
  disabled when `install_type` isn't ERV-integrated. Hidden is
  simpler; disabled is more discoverable. Pin in Phase 4.

## 11. Cross-doc graduation checklist (run at merge)

When the feature merges to main, fold the durable bits back per
`planning/.instructions.md` §Source-Of-Truth Rules:

- [ ] `context/GLOSSARY.md` — add §3 vocabulary entries.
- [ ] `context/user-stories/30-tables-equipment.md` — add US-EQ-7..11
      bodies, amend US-EQ-1's sub-tab list, amend US-EQ-4 for the
      reverse-lookup surface.
- [ ] `context/PRD.md` §6.2 — add the four new tables to the
      equipment-tables enumeration.
- [ ] `context/technical-requirements/data-model.md` — add row
      schemas.
- [ ] `context/technical-requirements/api.md` — add §9.X entry for
      the heat-pumps endpoints + Phius export.
- [ ] `context/technical-requirements/llm-mcp-schema.md` — add the
      heat-pump MCP tool definitions including
      `export_phius_hp_estimator`.
- [ ] `planning/features/heat-pumps/STATUS.md` — mark Complete with
      evidence (test count, e2e proof, screenshots).
- [ ] This PRD's §0 — update the current-status note pointing to
      the graduated context docs.
