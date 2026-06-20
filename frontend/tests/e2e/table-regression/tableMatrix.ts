// DataTable regression suite — the canonical table matrix.
//
// Every editable project DataTable surface is described here exactly
// once, as data, so the smoke / behavior / view-state specs can iterate
// the matrix instead of copy/pasting per-table test code. A failure that
// prints `case.id` / `case.label` is debuggable without reverse-
// engineering which table broke.
//
// Phase 01 deliverable (see
// planning/archive/data-table-regression-suite/phases/
// phase-01-inventory-and-harness.md). Behavior assertions land in later
// phases; this file carries no assertions.
//
// Source of truth for each fact is cited inline as `file:line` so a
// future table change can re-confirm the matrix without re-discovering
// the whole app. Backend table keys come from
// backend/features/project_document/tables/registry.py; the frontend
// view-state key passed to `useSliceTableController` is identical to the
// backend key for every target table.

/** The four nav areas the target tables live under. */
export type TableArea = "spaces" | "equipment" | "heat-pumps" | "assets";

/** The editable field types the suite exercises through the grid. */
export type TableFieldType = "text" | "number" | "single_select" | "linked_record";

/** A built-in linked-record column on a source table. */
export type LinkedRecordTarget = {
  /** Header label shown on the source table for this link column. */
  header: string;
  /** Backend generic-table key of the link target. */
  targetTableKey: string;
  /** Max links the field allows. Omitted = unlimited. */
  maxLinks?: number;
  /** Inverse/incoming column header shown on the target table, if any. */
  inverseHeader?: string;
  /**
   * True when the column is a read-only incoming/inverse link whose edits
   * land on the *other* table via the shared `IncomingLinkPicker`, not by
   * a direct cell editor. Behavior tests must drive these through the
   * picker, not a dblclick-type-Enter commit.
   */
  incoming?: boolean;
};

/** How a table grows a new row. */
export type AddRowSpec =
  | {
      /** Footer button inserts a blank row directly into the grid. */
      mode: "inline";
      /** Verbatim `aria-label` of the footer add-row button. */
      buttonName: string;
    }
  | {
      /** Footer button opens a modal that must be filled and submitted. */
      mode: "dialog";
      /** Verbatim `aria-label` of the footer add-row button. */
      buttonName: string;
      /** Accessible name of the modal dialog. */
      dialogTitle: string;
      /** Verbatim name of the modal submit button. */
      submitName: string;
      /** Inputs to fill before submitting (label → value). */
      fields: ReadonlyArray<{ label: string; value: string }>;
      /**
       * Some leaf add buttons are disabled until a parent table has rows.
       * Names the backend table key that must be seeded first.
       */
      requiresSeededTableKey?: string;
    };

/** One representative `field_key` per field type that exists on the table. */
export type RepresentativeFields = Partial<Record<TableFieldType, string>>;

/**
 * A representative single-select option for the Phase 04 behavior matrix.
 * `existing` picks a template-seeded option by its visible label; `create`
 * mints a brand-new option through the popover's "+ Create" footer. Only
 * present on tables whose representative single-select is deterministic to
 * drive — a seeded option to pick, or a select known to allow creation.
 * Tables whose built-in select ships with NO seeded options and an unproven
 * create path (e.g. heat-pump `manufacturer`) omit this and are skipped by
 * the select step (documented in phase-04-cell-behavior-matrix.md).
 */
export type SingleSelectSample = {
  mode: "existing" | "create";
  /** Visible option label to pick (existing) or mint (create). */
  label: string;
};

/** A single target table in the regression matrix. */
export type TableRegressionCase = {
  /** Stable, unique matrix id (used in test titles + failure messages). */
  id: string;
  /** Human label shown in the UI (region / leaf heading). */
  label: string;
  area: TableArea;
  /** Direct deep-link route that lands on the table. */
  route: (projectId: string) => string;
  /**
   * Backend generic-table key AND frontend view-state key (identical for
   * every target table). Used both for the draft-table read API and for
   * `(projectId, tableKey)` view-state assertions.
   */
  tableKey: string;
  /** `aria-label` of the `<section role="region">` that wraps the grid. */
  regionName: string;
  /** Header label of the pinned identifier column ("Display Name" or "Tag"). */
  identifierHeader: string;
  /** Core built-in headers visible by default (excludes default-hidden). */
  expectedHeaders: ReadonlyArray<string>;
  /** Built-in headers hidden by default — documented, not asserted visible. */
  defaultHiddenHeaders?: ReadonlyArray<string>;
  /** Representative `field_key`s for the field types present on the table. */
  representativeFields: RepresentativeFields;
  /**
   * The option the Phase 04 behavior matrix commits into the representative
   * single-select cell. Omitted when the select step is intentionally not
   * exercised for this table (no representative select, or an empty-seeded
   * select deferred to a focused flow).
   */
  singleSelectSample?: SingleSelectSample;
  /** Built-in linked-record columns keyed by `field_key`. */
  linkedRecordTargets?: Record<string, LinkedRecordTarget>;
  /** How to add a row to this table. */
  addRow: AddRowSpec;
  /** Free-form notes for downstream phases. */
  notes?: string;
};

// --- Route builders ---------------------------------------------------
// Kept inline (and self-contained) rather than importing app path
// helpers so the e2e suite has no dependency on `frontend/src` module
// resolution. Cross-check against the cited source if app routes change.

/** features/spaces/paths.ts — spaceTypesPath(). */
const spaceTypesRoute = (projectId: string) => `/projects/${projectId}/spaces/space-types`;
/** features/spaces/paths.ts — spacesRoomsPath(). */
const roomsRoute = (projectId: string) => `/projects/${projectId}/spaces/rooms`;
/** features/equipment/routes/EquipmentPageBody.tsx — `?tab=<key>` seeds the active sub-tab. */
const equipmentRoute = (tab: string) => (projectId: string) =>
  `/projects/${projectId}/equipment?tab=${tab}`;
/** features/equipment/heat-pumps/routes/heatPumpLeafTabs.ts — heatPumpLeafPath(). */
const heatPumpLeafRoute = (leaf: string) => (projectId: string) =>
  `/projects/${projectId}/equipment/heat-pumps/${leaf}`;
/** features/projects/lib.ts — projectTabPath("thermal-bridges"). */
const thermalBridgesRoute = (projectId: string) => `/projects/${projectId}/thermal-bridges`;

// --- The matrix -------------------------------------------------------

export const TABLE_REGRESSION_CASES: ReadonlyArray<TableRegressionCase> = [
  // -- Spaces ---------------------------------------------------------
  {
    id: "space-types",
    label: "Space Types",
    area: "spaces",
    route: spaceTypesRoute,
    tableKey: "space_types",
    regionName: "Space-Types",
    identifierHeader: "Display Name",
    // Only two built-in columns; everything else is user custom fields or
    // the read-only inverse "Rooms ← Space Type" column.
    expectedHeaders: ["Display Name", "Tag"],
    representativeFields: { text: "name" },
    addRow: { mode: "inline", buttonName: "Add Space-Type" },
    notes:
      "Target of the Rooms `space_type_id` link; the inverse column " +
      '"Rooms ← Space Type" only appears once a Room links here.',
  },
  {
    id: "rooms",
    label: "Rooms",
    area: "spaces",
    route: roomsRoute,
    tableKey: "rooms",
    regionName: "Rooms",
    // Identifier is the editable `{Number} — {Name}` formula column.
    identifierHeader: "Display Name",
    expectedHeaders: [
      "Display Name",
      "Number",
      "Name",
      "Floor",
      "Zone",
      "Space Type",
      "People",
      "Bedrooms",
      "iCFA",
    ],
    representativeFields: {
      text: "name",
      number: "num_people",
      single_select: "floor_level",
      linked_record: "space_type_id",
    },
    // `rooms.floor_level` seeds with an empty option list (templates.py),
    // so the behavior matrix mints a fresh option via the popover's Create
    // footer — the one create-mode select in the suite.
    singleSelectSample: { mode: "create", label: "Ground" },
    linkedRecordTargets: {
      space_type_id: {
        header: "Space Type",
        targetTableKey: "space_types",
        maxLinks: 1,
        inverseHeader: "Rooms ← Space Type",
      },
    },
    addRow: {
      mode: "dialog",
      buttonName: "Add New Room",
      dialogTitle: "New room",
      submitName: "Save room",
      // Floor/Zone default; Number+Name are enough for a deterministic row.
      fields: [
        { label: "Number", value: "101" },
        { label: "Name", value: "Living Room" },
      ],
    },
    notes:
      "Highest-priority linked-record table. Rooms also gains a custom " +
      "`Pump` link in the Rooms↔Pumps flow (covered by the existing " +
      "record-linking-rooms-pumps spec), not a built-in column.",
  },

  // -- Equipment (generic slice tables) -------------------------------
  {
    id: "ventilators",
    label: "Ventilators",
    area: "equipment",
    route: equipmentRoute("ventilators"),
    tableKey: "ventilators",
    regionName: "Equipment",
    identifierHeader: "Display Name",
    expectedHeaders: [
      "Display Name",
      "Tag",
      "Airflow Rate",
      "Model",
      "Manufacturer",
      "Inside / Outside",
    ],
    representativeFields: {
      text: "name",
      number: "airflow_rate_m3h",
      single_select: "inside_outside",
      linked_record: "incoming_indoor_unit_ids",
    },
    singleSelectSample: { mode: "existing", label: "Inside" },
    linkedRecordTargets: {
      incoming_indoor_unit_ids: {
        header: "HP indoor units",
        targetTableKey: "heat_pumps_indoor_units",
        inverseHeader: "Linked ERV",
        incoming: true,
      },
    },
    addRow: { mode: "inline", buttonName: "Add ventilator" },
    notes:
      '"HP indoor units" is the read-only inverse of the Indoor Units ' +
      "`linked_erv_unit_id` link; edit it via the Link picker, not a cell editor.",
  },
  {
    id: "pumps",
    label: "Pumps",
    area: "equipment",
    route: equipmentRoute("pumps"),
    tableKey: "pumps",
    regionName: "Equipment",
    identifierHeader: "Display Name",
    expectedHeaders: [
      "Display Name",
      "Tag",
      "Device",
      "Use",
      "Manufacturer",
      "Volts",
      "Phase",
      "Flow",
    ],
    representativeFields: {
      text: "use",
      number: "wattage",
      single_select: "device_type",
    },
    singleSelectSample: { mode: "existing", label: "10-Other" },
    addRow: { mode: "inline", buttonName: "Add pump" },
    notes:
      "No built-in linked-record column. A dynamic inverse `Rooms ← Pump` " +
      "column appears only after a Rooms custom field targets Pumps (the " +
      "existing record-linking-rooms-pumps spec covers that flow).",
  },
  {
    id: "fans",
    label: "Fans",
    area: "equipment",
    route: equipmentRoute("fans"),
    tableKey: "fans",
    regionName: "Equipment",
    identifierHeader: "Display Name",
    expectedHeaders: [
      "Display Name",
      "Tag",
      "Quantity",
      "Type",
      "Model",
      "Manufacturer",
      "Airflow",
      "Phase",
    ],
    representativeFields: {
      text: "model",
      number: "annual_runtime_min_yr",
      single_select: "fan_type",
    },
    singleSelectSample: { mode: "existing", label: "1-Dryer" },
    addRow: { mode: "inline", buttonName: "Add fan" },
  },
  {
    id: "hot-water-heaters",
    label: "Hot Water Heaters",
    area: "equipment",
    route: equipmentRoute("hot-water-heaters"),
    tableKey: "hot_water_heaters",
    regionName: "Equipment",
    identifierHeader: "Display Name",
    expectedHeaders: [
      "Tag",
      "Display Name",
      "Quantity",
      "Type",
      "Model",
      "Manufacturer",
      "Size",
      "Temperature",
      "Phase",
    ],
    representativeFields: {
      text: "name",
      number: "quantity",
      single_select: "heater_type",
    },
    singleSelectSample: { mode: "existing", label: "1-Electric" },
    addRow: { mode: "inline", buttonName: "Add hot water heater" },
    notes: 'Sub-tab button label is "Hot-water heaters"; region/heading is "Hot Water Heaters".',
  },
  {
    id: "hot-water-tanks",
    label: "Hot Water Tanks",
    area: "equipment",
    route: equipmentRoute("hot-water-tanks"),
    tableKey: "hot_water_tanks",
    regionName: "Equipment",
    identifierHeader: "Display Name",
    expectedHeaders: [
      "Tag",
      "Display Name",
      "Quantity",
      "Type",
      "Inside / Outside",
      "Manufacturer",
      "Model",
      "Size",
      "Heat Loss Rate",
    ],
    representativeFields: {
      text: "name",
      number: "size_l",
      single_select: "tank_type",
    },
    singleSelectSample: { mode: "existing", label: "2-DHW only" },
    addRow: { mode: "inline", buttonName: "Add hot water tank" },
    notes:
      'Sub-tab button label is "Hot-water tanks". A second built-in select ' +
      "`inside_outside` (Inside / Outside) is also present.",
  },
  {
    id: "electric-heaters",
    label: "Electric Heaters",
    area: "equipment",
    route: equipmentRoute("electric-heaters"),
    tableKey: "electric_heaters",
    regionName: "Equipment",
    identifierHeader: "Display Name",
    expectedHeaders: ["Tag", "Display Name", "Model", "Manufacturer", "Watt"],
    // Leanest equipment table: no single-select, no linked-record.
    representativeFields: {
      text: "name",
      number: "watt",
    },
    addRow: { mode: "inline", buttonName: "Add electric heater" },
    notes: 'Sub-tab button label is "Electric heaters".',
  },
  {
    id: "appliances",
    label: "Appliances",
    area: "equipment",
    route: equipmentRoute("appliances"),
    tableKey: "appliances",
    regionName: "Equipment",
    identifierHeader: "Display Name",
    expectedHeaders: [
      "Display Name",
      "Tag",
      "Type",
      "Quantity",
      "Model",
      "Manufacturer",
      "EnergyStar",
      "Capacity",
    ],
    representativeFields: {
      text: "name",
      number: "annual_energy_kwh",
      single_select: "appliance_type",
    },
    singleSelectSample: { mode: "existing", label: "4-fridge" },
    addRow: { mode: "inline", buttonName: "Add appliance" },
    notes: "A second built-in select `energy_star` (EnergyStar) is also present.",
  },

  // -- Heat Pumps (four leaf tables) ----------------------------------
  {
    id: "heat-pumps-equipment-outdoor",
    label: "Heat Pumps - Equipment Outdoor",
    area: "heat-pumps",
    route: heatPumpLeafRoute("equipment-outdoor"),
    tableKey: "heat_pumps_outdoor_equip",
    regionName: "Equipment",
    // Heat-pump leaves pin Tag via `schemaFieldKey`, not an `isIdentifier` flag.
    identifierHeader: "Tag",
    expectedHeaders: [
      "Tag",
      "Model number",
      "Manufacturer",
      "Paired indoor equip",
      "System family",
      "Refrigerant",
    ],
    representativeFields: {
      text: "model_number",
      number: "heating_cap_kw_17f",
      single_select: "manufacturer",
      linked_record: "paired_indoor_equip_id",
    },
    linkedRecordTargets: {
      paired_indoor_equip_id: {
        header: "Paired indoor equip",
        targetTableKey: "heat_pumps_indoor_equip",
        maxLinks: 1,
      },
      incoming_outdoor_unit_ids: {
        header: "Outdoor units",
        targetTableKey: "heat_pumps_outdoor_units",
        inverseHeader: "Equipment",
        incoming: true,
      },
    },
    addRow: {
      mode: "dialog",
      buttonName: "Add outdoor equipment",
      dialogTitle: "New outdoor equipment",
      submitName: "Save outdoor equipment",
      fields: [{ label: "Tag", value: "HP-OE-01" }],
    },
    notes:
      "Heat-pump `manufacturer` seeds with no options, so no " +
      "`singleSelectSample`: the Phase 04 behavior matrix skips the select " +
      "step here (create-flow coverage stays in the shared edit contract).",
  },
  {
    id: "heat-pumps-equipment-indoor",
    label: "Heat Pumps - Equipment Indoor",
    area: "heat-pumps",
    route: heatPumpLeafRoute("equipment-indoor"),
    tableKey: "heat_pumps_indoor_equip",
    regionName: "Equipment",
    identifierHeader: "Tag",
    expectedHeaders: [
      "Tag",
      "Model number",
      "Manufacturer",
      "Model type",
      "Install type",
      "Nominal tons",
      "Cooling Capacity",
      "Heating Capacity",
      "Indoor units",
    ],
    defaultHiddenHeaders: ["Fan CFM", "Heat 17F Btu/h", "Heat COP", "SEER", "EER", "HSPF", "Notes"],
    representativeFields: {
      text: "model_number",
      number: "nominal_tons",
      single_select: "manufacturer",
      linked_record: "incoming_indoor_unit_ids",
    },
    linkedRecordTargets: {
      incoming_indoor_unit_ids: {
        header: "Indoor units",
        targetTableKey: "heat_pumps_indoor_units",
        inverseHeader: "Equipment",
        incoming: true,
      },
    },
    addRow: {
      mode: "dialog",
      buttonName: "Add indoor model",
      dialogTitle: "New indoor equipment",
      submitName: "Create indoor equipment",
      fields: [{ label: "Tag", value: "HP-IE-01" }],
    },
    notes:
      "No outgoing built-in link; only the read-only inverse `Indoor units` " +
      "column (incoming from Indoor Units `indoor_equip_id`).",
  },
  {
    id: "heat-pumps-units-outdoor",
    label: "Heat Pumps - Units Outdoor",
    area: "heat-pumps",
    route: heatPumpLeafRoute("units-outdoor"),
    tableKey: "heat_pumps_outdoor_units",
    regionName: "Equipment",
    identifierHeader: "Tag",
    expectedHeaders: ["Tag", "Equipment", "Indoor units"],
    defaultHiddenHeaders: ["Notes"],
    // No numeric or single-select built-ins on this lean unit table.
    representativeFields: {
      text: "tag",
      linked_record: "outdoor_equip_id",
    },
    linkedRecordTargets: {
      outdoor_equip_id: {
        header: "Equipment",
        targetTableKey: "heat_pumps_outdoor_equip",
        maxLinks: 1,
        inverseHeader: "Outdoor units",
      },
      incoming_indoor_unit_ids: {
        header: "Indoor units",
        targetTableKey: "heat_pumps_indoor_units",
        inverseHeader: "Outdoor unit",
        incoming: true,
      },
    },
    addRow: {
      mode: "dialog",
      buttonName: "Add outdoor unit",
      dialogTitle: "New outdoor unit",
      submitName: "Create outdoor unit",
      // The "Outdoor equipment" picker is required; seed equipment first.
      fields: [{ label: "Tag", value: "HP-OU-01" }],
      requiresSeededTableKey: "heat_pumps_outdoor_equip",
    },
    notes: "Add button is disabled until an Equipment - Outdoor row exists.",
  },
  {
    id: "heat-pumps-units-indoor",
    label: "Heat Pumps - Units Indoor",
    area: "heat-pumps",
    route: heatPumpLeafRoute("units-indoor"),
    tableKey: "heat_pumps_indoor_units",
    regionName: "Equipment",
    identifierHeader: "Tag",
    expectedHeaders: ["Tag", "Equipment", "Outdoor unit", "Rooms", "Linked ERV"],
    defaultHiddenHeaders: ["Notes"],
    // Highest-risk link table: four distinct outgoing linked-record fields.
    representativeFields: {
      text: "tag",
      linked_record: "indoor_equip_id",
    },
    linkedRecordTargets: {
      indoor_equip_id: {
        header: "Equipment",
        targetTableKey: "heat_pumps_indoor_equip",
        maxLinks: 1,
        inverseHeader: "Indoor units",
      },
      outdoor_unit_id: {
        header: "Outdoor unit",
        targetTableKey: "heat_pumps_outdoor_units",
        maxLinks: 1,
        inverseHeader: "Indoor units",
      },
      served_room_ids: {
        header: "Rooms",
        targetTableKey: "rooms",
      },
      linked_erv_unit_id: {
        header: "Linked ERV",
        targetTableKey: "ventilators",
        maxLinks: 1,
        inverseHeader: "HP indoor units",
      },
    },
    addRow: {
      mode: "dialog",
      buttonName: "Add indoor unit",
      dialogTitle: "New indoor unit",
      submitName: "Create indoor unit",
      // The "Indoor equipment" picker is required; seed equipment first.
      // The `served_room_ids` link is grid-only (not in the add dialog).
      fields: [{ label: "Tag", value: "HP-IU-01" }],
      requiresSeededTableKey: "heat_pumps_indoor_equip",
    },
    notes: "Add button is disabled until an Equipment - Indoor row exists.",
  },

  // -- Assets ---------------------------------------------------------
  {
    id: "thermal-bridges",
    label: "Thermal Bridges",
    area: "assets",
    route: thermalBridgesRoute,
    tableKey: "thermal_bridges",
    regionName: "Thermal Bridges",
    identifierHeader: "Display Name",
    expectedHeaders: [
      "Tag",
      "Display Name",
      "Sheet Name",
      "Drawing Number",
      "Psi-Value",
      "fRSI Value",
      "Type",
      "Notes",
    ],
    representativeFields: {
      text: "sheet_name",
      number: "psi_value_w_mk",
      single_select: "thermal_bridge_type",
    },
    singleSelectSample: { mode: "existing", label: "15-Ambient" },
    addRow: { mode: "inline", buttonName: "Add thermal bridge" },
  },
];

/** Find a case by its stable matrix id. Throws if unknown. */
export function tableCaseById(id: string): TableRegressionCase {
  const found = TABLE_REGRESSION_CASES.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown table regression case id: ${id}`);
  return found;
}
