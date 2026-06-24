import type {
  HeatPumpIndoorEquipRow,
  HeatPumpIndoorUnitRow,
  HeatPumpOutdoorEquipRow,
  HeatPumpOutdoorUnitRow,
} from "./types";
import { STATUS_DEFAULT_OPTION_ID, STATUS_FIELD_KEY } from "../types";

// The built-in `status` single-select rides in `custom_values.status`, not as
// a typed row column. New equipment rows default to `opt_status_needed`. The
// DataTable insert path passes the grid `fieldDefaults` as top-level overrides
// (`{ ...fieldDefaults, id: rowId }`), so a `status` default can arrive either
// inside `overrides.custom_values` or as a stray top-level `status` key — lift
// both into `custom_values` here so equipment-only tables stay consistent.
function withStatusDefault<TRow extends { custom_values: Record<string, unknown> }>(
  row: TRow & { status?: unknown },
): TRow {
  const { status: topLevelStatus, ...rest } = row;
  const next = rest as TRow;
  const existing = next.custom_values?.[STATUS_FIELD_KEY];
  return {
    ...next,
    custom_values: {
      [STATUS_FIELD_KEY]: existing ?? topLevelStatus ?? STATUS_DEFAULT_OPTION_ID,
      ...next.custom_values,
    },
  };
}

export function buildEmptyOutdoorEquipRow(
  overrides: Partial<HeatPumpOutdoorEquipRow> & { status?: unknown } = {},
) {
  return withStatusDefault({
    id: heatPumpId("hpoe"),
    tag: "",
    manufacturer: null,
    model_number: null,
    paired_indoor_equip_id: null,
    system_family: null,
    refrigerant: null,
    heating_cap_kw_17f: null,
    heating_cap_kw_47f: null,
    heating_data_type: null,
    heating_cop_17f: null,
    heating_cop_47f: null,
    hspf: null,
    cooling_cap_kw_95f: null,
    cooling_data_type: null,
    eer: null,
    seer: null,
    ieer: null,
    datasheet_asset_ids: [],
    notes: null,
    catalog_origin: null,
    custom_values: {},
    custom_links: {},
    ...overrides,
  }) satisfies HeatPumpOutdoorEquipRow;
}

export function buildEmptyIndoorEquipRow(
  overrides: Partial<HeatPumpIndoorEquipRow> & { status?: unknown } = {},
) {
  return withStatusDefault({
    id: heatPumpId("hpie"),
    tag: "",
    manufacturer: null,
    model_type: null,
    model_number: null,
    install_type: null,
    nominal_tons: null,
    fan_speed_cfm: null,
    cooling_btuh: null,
    heating_btuh_47f: null,
    heating_btuh_17f: null,
    heating_cop: null,
    seer: null,
    eer: null,
    hspf: null,
    datasheet_asset_ids: [],
    notes: null,
    catalog_origin: null,
    custom_values: {},
    custom_links: {},
    ...overrides,
  }) satisfies HeatPumpIndoorEquipRow;
}

export function buildEmptyOutdoorUnitRow(
  overrides: Partial<HeatPumpOutdoorUnitRow> & { status?: unknown } = {},
) {
  return withStatusDefault({
    id: heatPumpId("hpou"),
    tag: "",
    outdoor_equip_id: "",
    datasheet_asset_ids: [],
    notes: null,
    custom_values: {},
    custom_links: {},
    ...overrides,
  }) satisfies HeatPumpOutdoorUnitRow;
}

export function buildEmptyIndoorUnitRow(
  overrides: Partial<HeatPumpIndoorUnitRow> & { status?: unknown } = {},
) {
  return withStatusDefault({
    id: heatPumpId("hpiu"),
    tag: "",
    indoor_equip_id: "",
    outdoor_unit_id: null,
    linked_erv_unit_id: null,
    served_room_ids: [],
    datasheet_asset_ids: [],
    notes: null,
    custom_values: {},
    custom_links: {},
    ...overrides,
  }) satisfies HeatPumpIndoorUnitRow;
}

function heatPumpId(prefix: "hpoe" | "hpie" | "hpou" | "hpiu"): string {
  return `${prefix}_${ulidSuffix()}`;
}

function ulidSuffix(): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  let value = BigInt(Date.now());
  for (const byte of bytes.slice(0, 10)) {
    value = (value << 8n) | BigInt(byte);
  }
  let output = "";
  for (let index = 0; index < 26; index += 1) {
    output = alphabet[Number(value & 31n)] + output;
    value >>= 5n;
  }
  return output;
}
