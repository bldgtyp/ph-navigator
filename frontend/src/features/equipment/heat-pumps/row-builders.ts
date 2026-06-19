import type {
  HeatPumpIndoorEquipRow,
  HeatPumpIndoorUnitRow,
  HeatPumpOutdoorEquipRow,
  HeatPumpOutdoorUnitRow,
} from "./types";

export function buildEmptyOutdoorEquipRow(overrides: Partial<HeatPumpOutdoorEquipRow> = {}) {
  return {
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
  } satisfies HeatPumpOutdoorEquipRow;
}

export function buildEmptyIndoorEquipRow(overrides: Partial<HeatPumpIndoorEquipRow> = {}) {
  return {
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
  } satisfies HeatPumpIndoorEquipRow;
}

export function buildEmptyOutdoorUnitRow(overrides: Partial<HeatPumpOutdoorUnitRow> = {}) {
  return {
    id: heatPumpId("hpou"),
    tag: "",
    outdoor_equip_id: "",
    datasheet_asset_ids: [],
    notes: null,
    custom_values: {},
    custom_links: {},
    ...overrides,
  } satisfies HeatPumpOutdoorUnitRow;
}

export function buildEmptyIndoorUnitRow(overrides: Partial<HeatPumpIndoorUnitRow> = {}) {
  return {
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
  } satisfies HeatPumpIndoorUnitRow;
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
