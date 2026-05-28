import {
  computeTableSchemaFingerprint,
  mintCustomFieldId,
  setCustomValue,
  tableFieldDefsToFieldDefs,
  useTableSchema,
  type FieldDef,
  type FieldSchemaMutation,
  type TableFieldDef,
  type TableSchema,
} from "../../../shared/ui/data-table";
import {
  PUMPS_COMPAT_BUILT_IN_FIELD_DEFS,
  pumpsFieldOverlay,
  ROOMS_COMPAT_BUILT_IN_FIELD_DEFS,
  roomsFieldOverlay,
} from "../lib";
import {
  PUMP_DEVICE_TYPE_OPTION_KEY,
  PUMPS_TABLE_NAME,
  ROOMS_TABLE_NAME,
  ROOM_BUILDING_ZONE_OPTION_KEY,
  ROOM_FLOOR_LEVEL_OPTION_KEY,
  type PumpRow,
  type PumpsSlice,
  type RoomRow,
  type RoomsSlice,
} from "../types";

const CREATED_AT = "2026-05-25T00:00:00Z";

export function tableFieldDef(overrides: Partial<TableFieldDef> = {}): TableFieldDef {
  const fieldKey = overrides.field_key ?? "cf_paint";
  return {
    field_key: fieldKey,
    display_name: "Paint",
    field_type: "short_text",
    config: {},
    description: null,
    origin: "custom",
    created_at: CREATED_AT,
    created_by: null,
    ...overrides,
  };
}

export const roomsBuiltInFieldDefs: TableFieldDef[] = [
  ...ROOMS_COMPAT_BUILT_IN_FIELD_DEFS.map(copyTableFieldDef),
];

export function roomsFieldDefs(...customFields: TableFieldDef[]): TableFieldDef[] {
  return [...roomsBuiltInFieldDefs, ...customFields];
}

export const pumpsBuiltInFieldDefs: TableFieldDef[] = [
  ...PUMPS_COMPAT_BUILT_IN_FIELD_DEFS.map(copyTableFieldDef),
];

export function pumpsFieldDefs(...customFields: TableFieldDef[]): TableFieldDef[] {
  return [...pumpsBuiltInFieldDefs, ...customFields];
}

export function buildCustomField(overrides: Partial<TableFieldDef> = {}): TableFieldDef {
  return tableFieldDef({
    field_key: "cf_paint",
    display_name: "Paint",
    field_type: "short_text",
    origin: "custom",
    ...overrides,
  });
}

export function buildFormulaField(overrides: Partial<TableFieldDef> = {}): TableFieldDef {
  return buildCustomField({
    field_key: "cf_label",
    display_name: "Label",
    field_type: "formula",
    config: {
      source: 'concat({Number}, " - ", upper({Name}))',
      ast: null,
      deps: ["number", "name"],
      result_type: "text",
    },
    ...overrides,
  });
}

export function buildRoom(overrides: Partial<RoomRow> = {}): RoomRow {
  return {
    id: "rm_1",
    floor_level: "opt_ground",
    building_zone: null,
    icfa_factor: 1,
    erv_unit_ids: [],
    catalog_origin: null,
    notes: null,
    custom_values: {
      number: "101",
      name: "Living Room",
      num_people: 0,
      num_bedrooms: 0,
    },
    ...overrides,
  };
}

export function buildPump(overrides: Partial<PumpRow> = {}): PumpRow {
  return {
    id: "pmp_1",
    device_type: "opt_circ",
    phase: 1,
    notes: null,
    link: null,
    datasheet_asset_ids: [],
    custom_values: {
      record_id: "P-1",
      use: "DHW recirc",
      manufacturer: null,
      model: null,
      volts: 120,
      horse_power: null,
      wattage: 45,
      flow_gpm: null,
      runtime_khr_yr: null,
    },
    ...overrides,
  };
}

export function withRoomCustomValues(
  room: RoomRow,
  customValues: Partial<RoomRow["custom_values"]>,
): RoomRow {
  const nextCustomValues = { ...room.custom_values };
  for (const [key, value] of Object.entries(customValues)) {
    if (value !== undefined) nextCustomValues[key] = value;
  }
  return {
    ...room,
    custom_values: nextCustomValues,
  };
}

export type RoomsSchemaMutationFixture = FieldSchemaMutation;

export function applyRoomsSchemaMutationFixture(
  slice: RoomsSlice,
  mutation: RoomsSchemaMutationFixture,
  nextDraftEtag: string,
  options: {
    rowsComputed?: (
      rooms: RoomRow[],
      fieldDefs: TableFieldDef[],
    ) => RoomsSlice["rows_computed"] | undefined;
  } = {},
): RoomsSlice {
  let fieldDefs = slice.field_defs.map(copyTableFieldDef);
  let rooms = slice.rooms;
  switch (mutation.kind) {
    case "addField":
      fieldDefs.push(copyTableFieldDef(mutation.after));
      break;
    case "editFieldBundle":
      fieldDefs = fieldDefs.map((field) =>
        field.field_key === mutation.fieldId ? copyTableFieldDef(mutation.after) : field,
      );
      break;
    case "renameField":
      fieldDefs = fieldDefs.map((field) =>
        field.field_key === mutation.fieldId
          ? { ...field, display_name: mutation.displayName }
          : field,
      );
      break;
    case "duplicateField": {
      const sourceIndex = fieldDefs.findIndex(
        (field) => field.field_key === mutation.sourceFieldId,
      );
      fieldDefs.splice(sourceIndex + 1, 0, copyTableFieldDef(mutation.after));
      break;
    }
    case "setDescription":
      fieldDefs = fieldDefs.map((field) =>
        field.field_key === mutation.fieldId
          ? { ...field, description: mutation.description }
          : field,
      );
      break;
    case "deleteField":
      fieldDefs = fieldDefs.filter((field) => field.field_key !== mutation.fieldId);
      rooms = rooms.map((row) => setCustomValue(row, mutation.fieldId, undefined));
      break;
    case "changeType":
    case "editOptions":
    case "setFormula":
      break;
  }
  return {
    ...slice,
    source: "draft",
    draft_etag: nextDraftEtag,
    field_defs: fieldDefs,
    rooms,
    rows_computed: options.rowsComputed?.(rooms, fieldDefs),
  };
}

function copyTableFieldDef(fieldDef: TableFieldDef): TableFieldDef {
  return { ...fieldDef, config: { ...fieldDef.config } };
}

export function buildRoomsSlice(overrides: Partial<RoomsSlice> = {}): RoomsSlice {
  return {
    project_id: "00000000-0000-0000-0000-000000000001",
    version_id: "00000000-0000-0000-0000-000000000002",
    source: "draft",
    version_etag: "v-etag",
    draft_etag: "d-etag",
    rooms: [],
    field_defs: roomsFieldDefs(),
    single_select_options: {
      [ROOM_FLOOR_LEVEL_OPTION_KEY]: [
        { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 },
      ],
      [ROOM_BUILDING_ZONE_OPTION_KEY]: [],
    },
    ...overrides,
  };
}

export function buildPumpsSlice(overrides: Partial<PumpsSlice> = {}): PumpsSlice {
  return {
    project_id: "proj_1",
    version_id: "ver_1",
    source: "draft",
    version_etag: "v1",
    draft_etag: "d1",
    pumps: [],
    field_defs: pumpsFieldDefs(),
    single_select_options: {
      [PUMP_DEVICE_TYPE_OPTION_KEY]: [
        { id: "opt_circ", label: "Circulator", color: "#3b82f6", order: 0 },
      ],
    },
    ...overrides,
  };
}

export function schemaForRooms(slice: RoomsSlice): TableSchema {
  return tableSchemaFor({
    fieldDefs: slice.field_defs,
    renderedFieldDefs: renderFieldDefsForRooms(slice),
  });
}

export function schemaForPumps(slice: PumpsSlice): TableSchema {
  return tableSchemaFor({
    fieldDefs: slice.field_defs,
    renderedFieldDefs: tableFieldDefsToFieldDefs({
      tableKey: PUMPS_TABLE_NAME,
      fieldDefs: slice.field_defs,
      fieldOverlay: pumpsFieldOverlay(slice),
      singleSelectOptions: slice.single_select_options,
    }),
  });
}

export function useRoomsTableSchema(slice: RoomsSlice): TableSchema {
  return useTableSchema({
    tableKey: ROOMS_TABLE_NAME,
    fieldDefs: slice.field_defs,
    fieldOverlay: roomsFieldOverlay(slice),
    singleSelectOptions: slice.single_select_options,
  });
}

export function usePumpsTableSchema(slice: PumpsSlice): TableSchema {
  return useTableSchema({
    tableKey: PUMPS_TABLE_NAME,
    fieldDefs: slice.field_defs,
    fieldOverlay: pumpsFieldOverlay(slice),
    singleSelectOptions: slice.single_select_options,
  });
}

export function renderFieldDefsForRooms(slice: RoomsSlice): FieldDef[] {
  return tableFieldDefsToFieldDefs({
    tableKey: ROOMS_TABLE_NAME,
    fieldDefs: slice.field_defs,
    fieldOverlay: roomsFieldOverlay(slice),
    singleSelectOptions: slice.single_select_options,
  });
}

function tableSchemaFor(args: {
  fieldDefs: TableFieldDef[];
  renderedFieldDefs: FieldDef[];
}): TableSchema {
  return {
    fieldDefs: args.renderedFieldDefs,
    coreFieldKeys: new Set(
      args.fieldDefs
        .filter((fieldDef) => fieldDef.origin === "built_in")
        .map((fieldDef) => fieldDef.field_key),
    ),
    customFields: args.fieldDefs.filter((fieldDef) => fieldDef.origin === "custom"),
    schemaFingerprint: computeTableSchemaFingerprint(args.fieldDefs),
    mintCustomFieldId,
  };
}
