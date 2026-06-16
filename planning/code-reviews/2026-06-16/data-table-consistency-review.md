# DataTable Consistency & Architecture Review

DATE: 2026-06-16
TIME: (local)

## Goal

The owner observed an "alarming lack of consistency" in how the app's
DATA-TABLE pages render and behave — single-select pills, link/linked-
record fields, header/row edit modals, and other elements that *should*
look and work identically across **every** data-table page. This review
audits the table surfaces — **Rooms, Equipment/\* (Appliances, Electric
Heaters, Fans, Hot Water Heaters, Hot Water Tanks, Pumps, Ventilators),
Heat Pumps (indoor/outdoor units + indoor/outdoor equip), Thermal
Bridges**, plus Climate as a comparison point — and asks:

1. Where do pages apply **local styling or build duplicate components**
   instead of using the shared `data-table` system?
2. Where are there **unneeded local overrides**, sloppy naming, sloppy
   styling, or **bad architecture**?
3. Where are **data-shapes inconsistent** for the same semantic concept?
4. On the **backend**, what controls / filters / data-shape checks are
   missing or asymmetric across tables?

**Goal state:** maximum consistency in rendering *and* behavior across
all data-tables.

This document is **review only** — no code was changed. It is the input
for a follow-on remediation plan.

## Method

The shared contract was read first-hand:
`context/technical-requirements/data-table.md` (the implementation
contract), the public surface `shared/ui/data-table/index.ts`, the
feature-shell abstraction `shared/ui/data-table/feature/*`
(`useSliceTableController` + `<SliceTableShell>`), and the field render
registry (`fields/registry.ts`, `components/GridBody.tsx`). Four parallel
sub-agents then audited (a) the non-Rooms equipment tables, (b) the heat-
pumps family, (c) cross-cutting styling/duplication across all table
files, and (d) the backend write/validation paths. The load-bearing
findings (the grid render-dispatch order, the Thermal Bridges structure,
the `inside_outside` data-shape split) were re-verified by hand against
source. Every claim below carries a `file:line` citation; paths are
relative to `frontend/src/` or `backend/` unless noted.

This review is the data-table-specific complement to
[`../2026-06-14/frontend-css-styling-review.md`](../2026-06-14/frontend-css-styling-review.md),
which covered app-wide token/color drift. Where the two overlap (feature
CSS is largely token-clean), this review does not re-litigate; it focuses
on **table component architecture, render/behavior consistency, and
backend data-shape controls**.

---

## 1. Executive summary

The shared `data-table` package is, in fact, excellent and complete: a
headless grid (`DataTable.tsx`, ~1600 lines), a typed `FieldDef`
registry that owns render/edit/filter/sort/aggregation per field type, a
feature-shell abstraction (`useSliceTableController` + `SliceTableShell`)
whose own doc-comment names **"Rooms, ERV, Pumps, Fans, Thermal Bridge"**
as its intended consumers, and shared cells for every field type
(`SingleSelectCell`, `LinkedRecordCell`, `LookupCell`, `ColorCell`,
`AttachmentCell`). The contract doc is clear and current.

**The inconsistency the owner is sensing is real, and it has two root
causes — not dozens of unrelated bugs:**

> **Root cause A — One table family went its own way.** The **Heat
> Pumps** family is a parallel, hand-rolled re-implementation of the
> entire stack. It reuses only the leaf `<DataTable>` primitive and
> re-builds everything above it: its own controller, its own view-state
> hook (`useHeatPumpTableViewState`), its own single-select editor
> (`OptionPicker`), its own row modals, its own inverse-link column, and
> its own JSON-Patch backend. Consequence: Heat Pumps cannot get user
> custom fields, locks, formulas, or uniform validation that every other
> table gets for free, and it renders single-selects / links / modals
> differently from the rest of the app.

> **Root cause B — The shared cells aren't exported, so every table
> re-implements them.** `SingleSelectCell`, `shortenUrl`-style link
> rendering, the attachment-column builder, and number-input wrappers are
> **not exposed** from `shared/ui/data-table/index.ts`. Feature authors
> can only reach low-level primitives, so each of ~9 tables copy-pastes
> the same render helpers. Worse, several of these copies are **dead
> code** — the grid dispatches `single_select` to the shared cell
> *before* the column's custom `render` ever runs.

Everything else (duplicated modals, the inverse-link fork, the
record-ID-column fork, the data-shape drift, the backend god-validator)
is a symptom of one of those two causes, or of straightforward
copy-paste drift across sibling tables.

**Severity ranking (worst first):**

| # | Finding | Type | Severity |
|---|---|---|---|
| B1 | Attachment asset-id arrays never validated against `project_assets` on **any** write path | Backend correctness/security | **High** |
| F1 | Heat Pumps is a parallel architecture (no shared controller/shell/custom-fields) | Frontend architecture | **High** |
| B2 | Heat-pump single-select option-id references never existence-checked | Backend correctness | **High** |
| B3 | Heat Pumps enforces identifier (tag) uniqueness, contradicting the spec the other 9 tables follow | Backend/spec conflict | Med-High |
| F8 | Same semantic field has different storage + field_type across tables (`inside_outside`, `phase`) | Data-shape | Med-High |
| F2/F3 | Dead per-table `optionPill` render + 7–9 copies of render helpers (shared cells unexported) | Frontend duplication | Medium |
| F4 | 6 near-duplicate row-edit modals (~60–70% boilerplate) | Frontend duplication | Medium |
| F5/F6 | Single-select and linked-record render two ways (grid vs modal; registry vs hand-rolled inverse) | Frontend rendering consistency | Medium |
| B4 | Numeric controls asymmetric (`phase ∈ {1,3}` on 3 of 5 tables; no ranges on quantities) | Backend correctness | Medium |
| B5–B8 | Heat-pump backend layer-collapse, dual contracts per path, god-method validator, orphaned config | Backend structure | Medium |
| F7/F9/F10 | Record-ID column built two ways; `hp-` class leakage, dead className, typo, magic widths; view-state fork | Frontend naming/structure | Low-Med |

---

## 2. The canonical model (what "correct" looks like)

So this review and any remediation share one reference, here is the
intended pattern, drawn from the contract and the Rooms implementation.

- **Compose, don't rebuild.** A feature table tab = `useSliceTableController`
  (owns `onWrite`, draft/etag, view-state, custom-field handlers,
  conflict handling) + `<SliceTableShell>` (banner/blocker/error chrome)
  + `<DataTable>` (the grid). The 7 equipment tabs already do this — one
  shell + 7 controllers owned by `routes/EquipmentPageBody.tsx`
  (`:250–:367`, shell `:549`); each `*TableSlot` is a thin prop-forwarder
  (`RoomsTableSlot.tsx:83–100`). Rooms additionally owns its controller
  in `RoomsPage.tsx` plus a broadcast layer (`useRoomsSliceWiring`).
- **FieldDef drives rendering.** One typed `FieldDef` per column maps to
  one shared cell. The grid's `renderCellContent` dispatches on
  `fieldDef.field_type` **before** any column-level `render`/`cell`:
  `color → <ColorCell>`, `single_select → <SingleSelectCell>`,
  `lookup → <LookupCell>`, `linked_record → <LinkedRecordCell>`, else
  the column's `render` fallback (`components/GridBody.tsx:523–549`,
  verified). **Implication:** for `single_select`/`linked_record`/
  `lookup`/`color` columns, a per-table `render:` is never reached — it
  is dead code.
- **View-state is the controller's job**, persisted per
  `(user, project, table_key)` through `useProjectTableViewState`
  (`features/table_views`), which `useSliceTableController` already wraps
  internally (`feature/useSliceTableController.ts:151`).
- **Identifier column** is a label, declared via `IdentifierConfig`;
  Rooms uses `computedFieldColumnDef({ fieldKey: RECORD_ID_FIELD_KEY, … })`
  (`RoomsTable.tsx:96–102`). Header is always "Record-ID"; never unique-
  constrained (contract §"Identifier Column").
- **Custom fields / locks / formulas** ride for free through
  `tableSchema` + `customFieldColumnDefs` + the `FieldSchemaMutation`
  backend path — every conforming table inherits them.

Measured against this model, the table family conformance is:

| Table family | Shell+Controller | tableSchema/custom fields | Identifier col | Row modal | View state | Backend write path |
|---|---|---|---|---|---|---|
| **Rooms** (canon) | ✅ (RoomsPage) | ✅ | `computedFieldColumnDef` | RoomModal | controller | generic slice + mutate |
| Equipment ×7 | ✅ (EquipmentPageBody) | ✅ | plain-text col (≠ Rooms) | only Ventilators | controller | generic slice + mutate |
| Thermal Bridges | ✅ | ✅ | plain-text col (≠ Rooms) | none | controller | generic slice + mutate |
| **Heat Pumps ×4** | ❌ hand-rolled | ❌ none | typed `tag` column | 4 bespoke modals | `useHeatPumpTableViewState` fork | bespoke JSON-Patch |
| Climate | n/a (static report `.climate-table`) | n/a | n/a | n/a | n/a | n/a |

Rooms, the 7 equipment tabs, and Thermal Bridges are *structurally*
consistent; their divergence is concentrated in per-table column/render
code and the optional row modal. **Heat Pumps is the structural
outlier.**

---

## 3. Frontend findings

### F1 — Heat Pumps is a parallel architecture *(High)*

The four heat-pump tables (`IndoorUnitsTable.tsx` 491 lines,
`OutdoorUnitsTable.tsx` 490, `IndoorEquipTable.tsx` 304,
`OutdoorEquipTable.tsx` 400) compose only `<DataTable>` and rebuild the
orchestration layer the rest of the app shares:

- **No controller, no `SlicePayloadBuilders`.** Each table holds its own
  `ModalState` union + `useState`, calls `useHeatPumpPatchMutation` /
  `useHeatPumpOptionMutation` directly, and hand-writes its own
  `handleWrite(op: WriteOp)` switch re-implementing the cell / fill /
  rowInsert / rowDelete dispatch the controller already provides
  (`IndoorUnitsTable.tsx:49–68, 74–75, 226–336`;
  `OutdoorEquipTable.tsx:44–65, 235–293`). There is no
  `HeatPumpsTableSlot`; `HeatPumpsPanel.tsx:74–103` renders the four
  tables with raw props.
- **No `tableSchema` → no custom fields, locks, or formulas.** The
  `*-columns.tsx` files build `FieldDef[]` statically client-side
  (`indoor-unit-columns.tsx:11`, `outdoor-equip-columns.tsx:56`) instead
  of consuming server `tableSchema.fieldDefs` (`RoomsTable.tsx:79`).
  `customFieldColumnDefs`, `onAddCustomField`, `RECORD_ID_FIELD_KEY`
  computed column, and the whole Plan-31 lock/custom-field surface are
  **absent**. Heat Pumps structurally cannot participate in the
  custom-field / locks work the other tables share.
- **Stale-etag "read freshest slice from cache" dance duplicated 3×**
  (`heat-pumps/api.ts:56–58`, `:119–121`, inline in
  `OutdoorEquipTable.tsx:240–273`) — exactly what the controller
  centralizes.

The one thing Heat Pumps does *right*: linked-record cells use the shared
`buildLinkedRecordOps` + `LinkedRecordCell` (`IndoorUnitsTable.tsx:139–209`),
and `LinkedVentilatorModalHost` correctly wraps the canonical
`VentilatorRowModal` (`LinkedVentilatorModalHost.tsx:4,34`).

> **Note on scope:** the heat-pump *slice* legitimately differs from
> Rooms — it holds four row-types + option lists together, not one
> row-type. Reconciling it onto the shared abstraction likely needs a
> multi-row-type controller variant, not a trivial swap. This is the
> single largest item in the roadmap and warrants its own design pass.

### F2 — Dead per-table `optionPill` render on single-select columns *(Medium)*

Because the grid dispatches `single_select` to `<SingleSelectCell>`
before the column `render` fallback (`GridBody.tsx:525–527`, verified),
every per-table `render: (row) => optionPill(...)` on a single_select
column **never executes in the grid**. Confirmed instances:

- Appliances `appliance_type` (`AppliancesTable.tsx:98–105`),
  `energy_star` (`:136–143`); Fans `fan_type` (`FansTable.tsx:104–110`);
  HotWaterHeaters `heater_type` (`HotWaterHeatersTable.tsx:110–118`);
  HotWaterTanks `tank_type` (`HotWaterTanksTable.tsx:110–117`); Pumps
  `device_type` (`PumpsTable.tsx:115–121`); Ventilators `inside_outside`
  (`VentilatorsTable.tsx:176–185`); Rooms `floor_level`/`building_zone`
  (`RoomsTable.tsx:188`); Thermal Bridges `thermal_bridge_type`
  (`ThermalBridgesTable.tsx:130–131`, verified).

Each table also carries a **byte-identical local `optionPill`** copy
(9 copies: the 7 equipment tables + Rooms `:188` + Thermal Bridges
`:199–213`, verified) plus the inline
`style={{ "--option-color": option.color }}` passthrough that lives only
because the JSX is hand-rebuilt (`ThermalBridgesTable.tsx:208`, and the
parallel lines in each table). **All of it is dead** for single_select
columns — `SingleSelectCell` already pills + colors them.

### F3 — Shared cells aren't exported → copy-pasted render helpers *(Medium)*

The shared implementations exist but are **not exported** from
`shared/ui/data-table/index.ts`, so features rebuild them:

- **`SingleSelectCell` / `SingleSelectPill`** — not exported; 9
  `optionPill` reimplementations (see F2). Exporting the shared cell
  deletes all 9 + their inline-style + className-ternary variants.
- **`shortenUrl` — 7 byte-identical copies**, no shared version:
  `AppliancesTable.tsx:281`, `ElectricHeatersTable.tsx:157`,
  `FansTable.tsx:276`, `HotWaterHeatersTable.tsx:297`,
  `HotWaterTanksTable.tsx:252`, `PumpsTable.tsx:336`,
  `VentilatorsTable.tsx:277`. The **URL link column** itself
  (`<a className="data-table-link-cell">{shortenUrl(...)}</a>`) is
  copy-pasted ~6× (e.g. `AppliancesTable.tsx:185–202`).
- **Attachment column builder** — the ~15-line block (`AttachmentCell` +
  `sameAttachmentAssetIds` guard + `.join`/count `measureText` +
  `onWrite`) is copy-pasted ~5–6×: `AppliancesTable.tsx:204–228`,
  `FansTable.tsx:209–232`, `HotWaterHeatersTable.tsx:223–249`,
  `HotWaterTanksTable.tsx:156–180`, `PumpsTable.tsx:217–246`,
  `ThermalBridgesTable.tsx:138–161` (verified). The guard helper itself
  is correctly shared (`assets/lib.ts`); the column builder is not.
- **Number-input parser — 3 reinventions of one function:**
  `heat-pumps/lib.ts:210` `numericValue` (canonical, exported within the
  feature), `model_viewer/lib/fieldConfigs.ts:348` private `numericValue`,
  `VentilatorRowModal.tsx:236` `readNumberInput`.
- **`OPTION_COLOR_PALETTE` duplicated** — `heat-pumps/lib.ts:176–181`
  re-declares the palette already exported as
  `OPTION_COLOR_PALETTE` from `shared/ui/data-table/index.ts`.

### F4 — Six near-duplicate row-edit modals *(Medium)*

`RoomModal` (220 lines), `VentilatorRowModal` (240), and the four
heat-pump modals (`IndoorUnitRowModal` 203, `OutdoorUnitRowModal` 149,
`IndoorEquipRowModal` 288, `OutdoorEquipRowModal` 332) share one
copy-pasted skeleton — an estimated 60–70% boilerplate:

- identical `useState(row)` draft + `error` + `isSaving` triplet
  (`VentilatorRowModal.tsx:24–26`; `RoomModal.tsx:35,45,46`;
  `IndoorEquipRowModal.tsx:35–37`; `OutdoorEquipRowModal.tsx:43–45`);
- identical `save()` scaffold (`setError(null); setIsSaving(true); try …
  catch errorMessage(...)`) (`VentilatorRowModal.tsx:30–39`;
  `RoomModal.tsx:49–62`; `IndoorEquipRowModal.tsx:45–84`);
- identical `<ModalDialog>` → `<form className="project-form …">` → error
  `<p>` → field grid → `modal-actions` footer with Cancel/submit (+
  optional Delete).

Gratuitous internal divergence within these duplicates:

- `VentilatorRowModal` defines its **own local** `setCustomValue(setDraft,
  draft, key, value)` (`:221–234`) and `readNumberInput` (`:236–240`),
  **shadowing** the shared `setCustomValue` that `RoomModal` imports from
  `shared/ui/data-table` (`RoomModal.tsx:4`). Same name, different
  signature — a real refactor footgun. And `RoomModal` itself calls the
  shared helper with two different signatures (`:93` vs `:131–135`).
- `NumberInput` is defined twice verbatim (`IndoorEquipRowModal.tsx:262–288`,
  `OutdoorEquipRowModal.tsx:274–300`); `TextField`/`NumberField` exist
  only in `VentilatorRowModal.tsx:172–219`. Four local field-wrapper sets
  across three modals.

These should collapse into one field-driven `<RowEditModal>` /
`useRowEditForm` (shared state/save/error scaffold + ModalDialog/form
chrome + footer triad + one `setCustomValue` convention, with optional
`onDelete`/`frozenReason`).

### F5 — Single-select renders two ways *(Medium)*

Inside the **same** heat-pump feature, single-selects render via the
shared `SingleSelectPopover` in the grid (the `newOptions` plumbing at
`OutdoorEquipTable.tsx:247–258` + `OUTDOOR_FIELD_TO_OPTION_KEY` proves
it) but via the bespoke **`OptionPicker`** in the row modals
(`OptionPicker.tsx`, a `<select>` + inline "Add option" disclosure with
its own draft/pending/error and its own duplicate-label check at
`:50–57`). The shared `SingleSelectPopover` already provides find-or-
create (`SingleSelectPopover.tsx:39`), keyboard nav, and pill rendering.
Likewise, RoomModal hand-rolls a `<datalist>`-backed `<input>` for its
selects (`RoomModal.tsx:105–122`) and VentilatorRowModal a raw `<select>`
(`VentilatorRowModal.tsx:83–99`). That is **four idioms** for "pick a
single-select option in a modal."

### F6 — Linked-record / inverse-link implemented two ways *(Medium)*

The "show incoming/inverse links as clickable pills" feature exists in
three places with two implementations:

- **Ventilators** uses the registry path correctly:
  `incomingIndoorUnitColumnDef` + `buildLinkedRecordOps` passed as
  `linkedRecordOps` (`VentilatorsTable.tsx:212–233`), pills resolve real
  tags, click opens an in-page modal.
- **Pumps** hand-rolls the same concept: synthetic FieldDefs inline +
  `<LinkedRecordCell resolve={() => ({ recordId: null })} …>` (so pills
  show raw ids, not labels) + local helpers `inverseFieldKey` /
  `inverseColumnHeader` / `inverseIdsForPump` (`PumpsTable.tsx:248–267,
  304–318`), click **navigates via router** instead of a modal.
- **Heat Pumps** hand-rolls a third: `link-fields.ts:154–178`
  `incomingUnitColumnDef` with `className: "data-table-inverse-link-cell"`.

Result: three behaviors (modal vs route nav), two pill-label policies
(real tags vs raw ids), and divergent header formats (`"HP indoor units"`
literal vs `"${table} ← ${field}"` built string) for one feature. Also:
the heat-pump `link-fields.ts` is the de-facto shared link layer but
lives under `heat-pumps/`, and `VentilatorsTable.tsx:13–19` imports from
it cross-feature.

### F7 — Record-ID identifier column built two ways *(Low-Med)*

Rooms uses `computedFieldColumnDef({ fieldKey: RECORD_ID_FIELD_KEY,
defaultWidth: 180, … })` (`RoomsTable.tsx:96–102`). All 7 equipment
tables **and** Thermal Bridges instead hand-roll a plain-text column
reading `customTextValue(row, RECORD_ID_FIELD_KEY)` with
`header ?? "Tag"` and `defaultWidth: 100` (e.g. `AppliancesTable.tsx:90–96`;
`ThermalBridgesTable.tsx:82–87`, verified). Same semantic column, two
render paths and two default widths (180 vs 100). Heat Pumps uses a typed
`tag` column — a third variant. Pick one identifier-column helper.

### F8 — Inconsistent data-shapes for the same field *(Med-High)*

- **`inside_outside` is shaped two different ways (verified).** On
  Ventilators it is a **top-level `string|null` row prop** declared
  `field_type: "single_select"` and pill-rendered
  (`equipment/types.ts:149`, `equipment/lib.ts:397`,
  `VentilatorsTable.tsx:176–185`). On HotWaterTanks the **same** field is
  a **`custom_values` entry** declared `field_type: "short_text"` and
  plain-text rendered (`equipment/lib.ts:482`,
  `HotWaterTanksTable.tsx:118–124`). One field name → two storage
  locations, two field types, two render paths. This is the clearest
  data-shape bug.
- **`phase`** is a top-level numeric on Pumps/Fans/HotWaterHeaters
  (`equipment/types.ts:104,228,268`) read raw via `row.phase` with a
  `numeric-cell` className but **no** `customNumberValue` pipeline
  (`FansTable.tsx:160–166`); on HotWaterTanks/Appliances/ElectricHeaters
  it is a `custom_values` number. Same concept, two storage tiers, two
  read paths.
- **Built-in single-selects live top-level, custom ones in
  `custom_values`** — the house pattern (Rooms does it too), but it forces
  every controller to special-case its built-in option keys
  (`equipment/types.ts:97,143,221,261,301`), multiplying near-identical
  controller code (see F-controllers below).
- **Controllers / `buildEmpty*Row` are 7 near-identical objects** that
  differ only by forwarded function names + field lists
  (`appliancesController.ts:22–48` vs `pumpsController.ts:14–35` vs
  `ventilatorsController.ts:18–49`). Contract surface is *inconsistent*:
  Rooms' controller adds `collapseCellWritesToReplacements` +
  `remoteSliceChangesActiveRow`; Ventilators omits
  `remoteSliceChangesActiveRow` though it now has a modal. `buildEmptyPumpRow.ts:16`
  clones `datasheet_asset_ids` while the other datasheet tables don't —
  inconsistent defensive copying.

### F9 — Naming / styling sloppiness *(Low-Med)*

- **Dead className (real no-op):** `PumpsTable.tsx:266` sets
  `className: "data-table-inverse-link-cell"`, a class defined in **no**
  CSS file (only `.data-table-link-cell` exists, `DataTable.css:2889`).
- **`hp-` CSS classes leak out of heat-pumps.** `VentilatorRowModal.tsx:44,56,58,104`
  consumes `hp-modal-form`/`hp-modal-section`/`hp-form-grid`/`hp-form-grid__wide`
  (defined `equipment.css:48–72`). The `hp-` prefix is now a misnomer —
  these are the de-facto shared modal-form layout classes and should get
  a neutral namespace.
- **Typo:** HotWaterHeaters `temperature_c` header falls back to
  `"Temperatur"` (`HotWaterHeatersTable.tsx:144`).
- **Magic widths everywhere** as bare ints; the strongly-semantic
  recurring values should be named constants: 180 (link, ×19), 280
  (attachment, ×8), 260 (notes, ×15), 100 (record-id, ×15), 90
  (small-numeric, ×10). `phase`/`volts` even drift (90 vs 80) for the
  same concept (`FansTable.tsx:164` vs `PumpsTable.tsx:156`). The shared
  `resolveColumnWidth` / `FIELD_TYPE_DEFAULT_WIDTH` helpers already exist
  and are bypassed.
- **Magic tag-prefix strings** inline in rowInsert handlers: `"AHU"`
  (`IndoorUnitsTable.tsx:331`), `"OE"` (`OutdoorEquipTable.tsx:289`).
- **`assetUrlById as never`** type-escape repeated in all four heat-pump
  column files (`indoor-unit-columns.tsx:144`, etc.) where the canonical
  `PumpsTable.tsx:223` passes a properly typed map.
- **Pumps Datasheet header** skips the `display_name ??` lookup all the
  other tables do (`PumpsTable.tsx:220` vs `AppliancesTable.tsx:206`).

### F10 — `useHeatPumpTableViewState` is a redundant fork *(Low-Med)*

`useHeatPumpTableViewState.ts:11–55` wraps `useProjectTableViewState`
(`:46`) — but `useSliceTableController` **already** wraps that same hook
(`feature/useSliceTableController.ts:151`). So the heat-pump hook
re-derives `defaults` (`:28–35`) and `schemaFingerprint` (`:36–44`) by
hand, duplicating controller logic, and exists only because the heat-pump
tables refuse to take a controller. It persists correctly per
`(project, table)`, so it is not *broken* — it is **redundant**. Delete
it when F1 lands.

---

## 4. Backend findings

The backend has a clean centralization story for the generic tables —
all 9 (Rooms, 7 Equipment, Thermal Bridges) persist into one
`ProjectDocumentV1`, validated by one `model_validator`
(`features/project_document/document.py`), through one generic slice-
replace (`PUT /draft/tables/{table_name}`) + one `FieldSchemaMutation`
path (`POST …/custom-fields:mutate`), driven by per-table `TableContract`
data (`tables/registry.py:70`). **Heat Pumps is a separate feature**
(`backend/features/heat_pumps/`) with its own routes/service and a
JSON-Patch write model — the backend mirror of F1.

### B1 — Attachment asset-id arrays never validated against `project_assets` *(High — correctness/security)*

On **every** write path, `*_asset_ids` arrays (`datasheet_asset_ids`,
`pdf_report_asset_ids`, `photo_asset_ids`, heat-pump datasheets) are
stored as opaque `list[str]` with **zero** existence validation. A client
can persist ids pointing at non-existent, **other-project**, or
wrong-kind assets. The rich policy in `assets/registry.py:29`
`ATTACHMENT_FIELDS` (asset_kinds, content types, `max_count`, size) is
enforced only on *upload* and *delete-protection*
(`assets/registry.py:157` scans the reverse direction), never when ids
land in the document. Given this is a **public repo handling licensed /
PHI-adjacent data**, cross-project asset-reference leakage is the top
gap. Enforce existence + project ownership + `asset_kind` / `max_count` /
content-type inside `validate_document_references`.
(`rows.py:109,373`, `heat_pumps/models.py:64`, `assets/registry.py:29`.)

### B2 — Heat-pump single-select option-id refs never existence-checked *(High)*

Generic tables reject row references to non-existent single-select
options for both built-in and custom selects (`document.py` built-in
loops + `_validators.py:140–153` for customs). The heat-pump option keys
(`heat_pumps.manufacturer/system_family/refrigerant/model_type/install_type`,
`heat_pumps/models.py:167–171`) are **not** validated against their lists
at any layer (not in `document.py:524–566`, not in
`service.py::_validate_slice`). They are also absent from the document's
`single_select_options` defaults / `setdefault` loop
(`document.py:223–255`), so absence-vs-empty semantics differ from every
other table.

### B3 — Identifier uniqueness contradicts the spec *(Med-High)*

The contract states identifiers are **never** unique-constrained
(`data-table.md` §"Identifier Column"), and the 9 generic tables honor
this. Heat Pumps enforces **per-table, case-insensitive tag uniqueness**
— and does it **twice** (`document.py:672–689`
`_validate_heat_pump_table_ids_and_tags`, duplicated in
`service.py:214–226` `_validate_slice`). Decide one rule and apply it
uniformly; if HP genuinely needs uniqueness, that belongs in the spec.

### B4 — Numeric controls are asymmetric *(Medium)*

- `phase ∈ {1,3}` is enforced as a typed column only on Pumps / Fans /
  HotWaterHeaters (`rows.py:119–124,188,230`); on HotWaterTanks /
  Appliances / ElectricHeaters `phase` is an **unconstrained** `number`
  custom field (matches the F8 data-shape split).
- `volts`, `wattage`, `quantity`, `horse_power`, flow rates, etc. have
  **no** range/positivity validation anywhere (`coerce_custom_value` only
  checks "is numeric", `custom_fields.py:275–278`). Negative/absurd
  values pass.
- Inverted expectation: the deep heat-pump models are actually
  **stricter** (`NonNegativeFloat`/`PositiveFloat`,
  `heat_pumps/models.py:33–63`) than the user-facing equipment tables.
  Ad-hoc exceptions exist (tank `heat_loss_rate>=0` `document.py:422`;
  TB `psi>=0`, `0<=frsi<=1` `document.py:586–591`) but are not systematic.
- **Verify the new ventilator-modal numerics have backend counterparts.**
  The uncommitted `VentilatorRowModal.tsx` / `lib/ventilatorModalPayload.ts`
  carry heat-recovery %, MERV, electrical-efficiency, airflow inputs;
  none of these have backend range checks.

### B5 — Heat-pump backend collapses layers *(Medium)*

`heat_pumps/service.py` (529 lines) mixes request DTOs (`JsonPatchOp`,
`OptionPatchOp`, `HeatPumpsReadResponse`, `CascadePreview` — should be in
`models.py` per standards) with patch parsing, cascade logic, slice
validation, and option logic (`:40–94, 214–257, 409–421`). Its
`repository.py` is a 24-line stub; real persistence reuses
`project_document.repository.upsert_draft`. HP is a routes+service
feature grafted onto the document repo, not the clean 4-file split the
standards require.

### B6 — Dual contracts at the same table path *(Medium)*

`tables/registry.py:70` registers **two** contracts per equipment type at
the **same** `table_path`: the rich slice contract (e.g. `fans_contract`,
name `"fans"`) and a simple dict attachment contract
(`equipment_fans_contract`, name `"equipment_fans"`,
`attachments.py:163`). The simple one (`make_simple_attachment_contract`,
`attachments.py:36`) does a blind `model_dump`/path-write/validate
round-trip with `extra="allow"` rows, **bypassing** the typed slice
request model. Two writable surfaces for one dataset with different
validation strictness — a consistency/security hazard and likely leftover
scaffolding to remove or consolidate.

### B7 — God-method validator + duplicated invariants *(Medium)*

`validate_document_references` is a ~430-line method
(`document.py:238–670`) with near-identical 7-line stanzas repeated per
table (id-dedupe + option-existence + 3 validator calls). Drive it from
`iter_table_contracts()` + `field_registry` instead. Separately, the
heat-pump tag/FK invariants are duplicated between `document.py:524–566`
and `heat_pumps/service.py:214–257` — two copies that can drift.

### B8 — Orphaned attachment config *(Low)*

`thermal_bridges.simulation_file_asset_ids` is registered in
`ATTACHMENT_FIELDS` (`assets/registry.py:72`) but has **no** matching
column on `ThermalBridgeRow` (`rows.py:366–374`). Also: attachment fields
are modeled as `long_text` FieldDefs (e.g. `tables/fans.py:83`) rather
than a dedicated attachment field type — a modeling smell that helps
explain B1.

---

## 5. Cross-cutting themes (root causes)

1. **Under-exported shared layer.** The shared package *has* the right
   cells and helpers; it just doesn't expose them
   (`SingleSelectCell`, a `LinkCell`/`shortenUrl`, an attachment-column
   builder, number-input wrappers, width constants). Every table then
   rebuilds them, and several rebuilds are dead code. **Fixing exports +
   adopting them removes the bulk of the frontend duplication with near-
   zero behavior risk** (the shared impls already match).
2. **One family (Heat Pumps) forked the whole stack** — frontend and
   backend. It is the source of most *behavioral* inconsistency
   (single-select two ways, links three ways, no custom fields, uniqueness
   mismatch) and the largest remediation item.
3. **Copy-paste sibling drift.** The 7 equipment tables + Thermal Bridges
   are one template stamped out, accreting small unexplained differences
   (widths, headers, defensive copies, controller contract surface,
   `link` vs `url` field key). Factoring shared column builders + a
   table-descriptor collapses this.
4. **Backend validation is structurally centralized but content-
   incomplete** — the gate exists (`validate_document_references`), but
   asset-ids, HP option refs, and numeric ranges fall through it, and HP
   bypasses it for its own copy.

---

## 6. Prioritized remediation roadmap

Ordered for value-per-risk; each item is independently shippable except
where noted. This is a menu for a follow-on plan, not a committed
schedule.

**Phase 0 — Pure subtraction / correctness (low risk, do first)**
- Export `SingleSelectCell`/`SingleSelectPill` from
  `shared/ui/data-table/index.ts`; delete the 9 `optionPill` copies +
  their dead `render:` + inline styles (F2, F3).
- Delete dead `data-table-inverse-link-cell` className (F9); fix
  `"Temperatur"` typo (F9); give Pumps' Datasheet header the
  `display_name` lookup (F9).
- Fix the `setCustomValue` shadow in `VentilatorRowModal` (F4) — rename or
  refactor onto the shared helper.
- **Backend B1**: validate attachment asset-ids against `project_assets`
  (existence + project ownership + kind/count) in
  `validate_document_references`. Highest-severity correctness fix.

**Phase 1 — Extract shared frontend building blocks**
- `LinkCell` + shared `shortenUrl` (F3); shared attachment-column builder
  (F3); shared `recordIdColumn` helper — one decision, `computedFieldColumnDef`
  vs plain text (F7); named width constants feeding `resolveColumnWidth`
  (F9); shared number-input parser + field wrappers (F3, F4).
- Unify `RoomModal` + `VentilatorRowModal` (and later the HP modals) into
  one `<RowEditModal>` / `useRowEditForm` (F4).

**Phase 2 — Reconcile data-shapes + backend symmetry**
- Fix `inside_outside` (one storage + one field_type) and `phase` (one
  tier) across tables (F8, B4); add numeric range validation systematically
  (B4); reconcile identifier-uniqueness rule (B3); validate HP option refs
  (B2); remove/consolidate the dual `equipment_*` contracts (B6); collapse
  the duplicated HP invariants and refactor the god-method validator
  (B7); clear the orphaned TB attachment config (B8).

**Phase 3 — Bring Heat Pumps onto the shared abstraction (largest)**
- Design a multi-row-type slice controller variant; introduce
  `HeatPumpsTableSlot` + `SlicePayloadBuilders`; delete the four bespoke
  `handleWrite` switches, the inline CRUD verbs, the stale-etag dance, and
  `useHeatPumpTableViewState` (F1, F10); replace `OptionPicker` with the
  shared single-select editor and the raw-`<select>` linked pickers with
  the shared `Picker` (F5); unify the inverse-link column across Pumps /
  Ventilators / Heat Pumps (F6); de-`hp-` the modal CSS namespace (F9).
  Backend: bring HP under the generic `TableContract`/`FieldSchemaMutation`
  path or document the divergence (B5). This unlocks custom fields, locks,
  and formulas for Heat Pumps (intersects Plan-31).

---

## 7. What is already good (keep)

- The shared `data-table` package itself: contract, `FieldDef` registry,
  render dispatch, `useSliceTableController`/`SliceTableShell`, and the
  per-field shared cells. The fix is to *use* it more, not change it.
- The 7 equipment tabs + Thermal Bridges already share one shell + one
  controller-per-table and consume `tableSchema` — structurally correct.
- Feature CSS (`equipment.css`, `climate.css`) is token-clean: no
  hardcoded colors, no `!important`, no `.data-table-*` overrides
  (consistent with the 2026-06-14 styling review). The debt is in TSX
  duplication, not in stylesheets.
- Backend has one document validator gate and a generic slice +
  schema-mutation path for the 9 generic tables; linked-record and option
  validation for those tables is solid.

---

## Appendix — files reviewed

**Shared contract:** `context/technical-requirements/data-table.md`;
`shared/ui/data-table/{index.ts, DataTable.tsx, components/GridBody.tsx,
components/SingleSelectCell.tsx, fields/registry.ts, fields/types.ts,
feature/{index.ts, types.ts, SliceTableShell.tsx, useSliceTableController.ts}}`.

**Frontend pages:** `features/equipment/components/*Table*.tsx` +
`*Modal*.tsx`; `features/equipment/lib/*Controller.ts` + `buildEmpty*Row.ts`;
`features/equipment/heat-pumps/**`; `features/assets/thermal-bridges/*`;
`features/assets/components/Attachment*.tsx`;
`features/climate/components/ClimateRecordTable.tsx`.

**Backend:** `backend/features/project_document/{document.py, validation.py,
_validators.py, drafts.py, rows.py, custom_fields.py, options.py,
tables/*, mutations/*}`; `backend/features/assets/registry.py`;
`backend/features/heat_pumps/{routes.py, service.py, models.py,
repository.py, phius_export.py}`.
