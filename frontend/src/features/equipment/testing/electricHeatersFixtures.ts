import {
  buildTableSchema,
  useTableSchema,
  type TableFieldDef,
  type TableSchema,
} from "../../../shared/ui/data-table";
import { ELECTRIC_HEATERS_COMPAT_BUILT_IN_FIELD_DEFS, electricHeatersFieldOverlay } from "../lib";
import {
  ELECTRIC_HEATERS_TABLE_NAME,
  type ElectricHeaterRow,
  type ElectricHeatersSlice,
} from "../types";

function copyTableFieldDef(fieldDef: TableFieldDef): TableFieldDef {
  return { ...fieldDef, config: { ...fieldDef.config } };
}

export const electricHeatersBuiltInFieldDefs: TableFieldDef[] = [
  ...ELECTRIC_HEATERS_COMPAT_BUILT_IN_FIELD_DEFS.map(copyTableFieldDef),
];

export function electricHeatersFieldDefs(...customFields: TableFieldDef[]): TableFieldDef[] {
  return [...electricHeatersBuiltInFieldDefs, ...customFields];
}

export function buildElectricHeater(overrides: Partial<ElectricHeaterRow> = {}): ElectricHeaterRow {
  return {
    id: "heatr_1",
    url: null,
    notes: null,
    custom_values: {
      record_id: "EH-1",
      name: "Bath electric heater",
      model: "EH-1000",
      manufacturer: "Acme",
      watt: 1000,
    },
    ...overrides,
  };
}

export function buildElectricHeatersSlice(
  overrides: Partial<ElectricHeatersSlice> = {},
): ElectricHeatersSlice {
  return {
    project_id: "proj_1",
    version_id: "ver_1",
    source: "draft",
    version_etag: "v1",
    draft_etag: "d1",
    electric_heaters: [],
    field_defs: electricHeatersFieldDefs(),
    single_select_options: {},
    ...overrides,
  };
}

export function schemaForElectricHeaters(slice: ElectricHeatersSlice): TableSchema {
  return buildTableSchema({
    tableKey: ELECTRIC_HEATERS_TABLE_NAME,
    fieldDefs: slice.field_defs,
    fieldOverlay: electricHeatersFieldOverlay(),
    singleSelectOptions: slice.single_select_options,
  });
}

export function useElectricHeatersTableSchema(slice: ElectricHeatersSlice): TableSchema {
  return useTableSchema({
    tableKey: ELECTRIC_HEATERS_TABLE_NAME,
    fieldDefs: slice.field_defs,
    fieldOverlay: electricHeatersFieldOverlay(),
    singleSelectOptions: slice.single_select_options,
  });
}
