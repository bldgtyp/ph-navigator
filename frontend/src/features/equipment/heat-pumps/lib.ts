import type {
  HeatPumpIndoorEquipRow,
  HeatPumpIndoorUnitRow,
  HeatPumpOutdoorEquipRow,
  HeatPumpOutdoorUnitRow,
} from "./types";

export function buildEmptyOutdoorEquipRow(overrides: Partial<HeatPumpOutdoorEquipRow> = {}) {
  return {
    id: heatPumpId("hpoe"),
    manufacturer: null,
    model_number: "",
    paired_indoor_equip_id: null,
    system_family: null,
    refrigerant: null,
    heating_data_type: null,
    heating_cap_kbtuh_17f: null,
    heating_cap_kbtuh_47f: null,
    heating_cop_17f: null,
    heating_cop_47f: null,
    hspf2: null,
    hspf: null,
    cooling_data_type: null,
    cooling_cap_kbtuh_95f: null,
    eer2: null,
    seer2: null,
    ieer: null,
    eer: null,
    seer: null,
    datasheet_asset_ids: [],
    notes: null,
    catalog_origin: null,
    ...overrides,
  } satisfies HeatPumpOutdoorEquipRow;
}

export function buildEmptyIndoorEquipRow(overrides: Partial<HeatPumpIndoorEquipRow> = {}) {
  return {
    id: heatPumpId("hpie"),
    manufacturer: null,
    model_type: null,
    model_number: "",
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
    ...overrides,
  } satisfies HeatPumpIndoorEquipRow;
}

export function buildEmptyOutdoorUnitRow(overrides: Partial<HeatPumpOutdoorUnitRow> = {}) {
  return {
    id: heatPumpId("hpou"),
    tag: "",
    outdoor_equip_id: "",
    building_zone: null,
    datasheet_asset_ids: [],
    notes: null,
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
    floor_level: null,
    area_served: null,
    datasheet_asset_ids: [],
    notes: null,
    ...overrides,
  } satisfies HeatPumpIndoorUnitRow;
}

export function sortedOutdoorEquip(rows: HeatPumpOutdoorEquipRow[]) {
  return sortBy(rows, (row) => row.model_number);
}

export function sortedIndoorEquip(rows: HeatPumpIndoorEquipRow[]) {
  return sortBy(rows, (row) => row.model_number);
}

export function sortedOutdoorUnits(rows: HeatPumpOutdoorUnitRow[]) {
  return sortBy(rows, (row) => row.tag);
}

export function sortedIndoorUnits(rows: HeatPumpIndoorUnitRow[]) {
  return sortBy(rows, (row) => row.tag);
}

function sortBy<T extends { id: string }>(rows: T[], key: (row: T) => string): T[] {
  return [...rows].sort((a, b) => {
    const primary = key(a).localeCompare(key(b), undefined, {
      numeric: true,
      sensitivity: "base",
    });
    return primary || a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" });
  });
}

/**
 * Resolves a unique tag inside a table by appending `(2)`, `(3)`, … on collision.
 * Comparison is trim + case-fold so "AHU-1" and "ahu-1 " collide.
 * Used on add only — rename collisions are rejected with an error instead.
 */
export function uniqueTagForAdd(desired: string, existing: readonly { tag: string }[]): string {
  const trimmed = desired.trim();
  const taken = new Set(existing.map((row) => row.tag.trim().toLocaleLowerCase()));
  if (!taken.has(trimmed.toLocaleLowerCase())) return trimmed;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${trimmed} (${suffix})`;
    if (!taken.has(candidate.toLocaleLowerCase())) return candidate;
  }
  return `${trimmed} (${Date.now()})`;
}

/**
 * Returns true when `desired` collides with another row in `existing` (excluding the
 * row being renamed by id). Caller uses this on rename to reject duplicates.
 */
export function tagCollides(
  desired: string,
  existing: readonly { id: string; tag: string }[],
  excludeId: string,
): boolean {
  const target = desired.trim().toLocaleLowerCase();
  return existing.some(
    (row) => row.id !== excludeId && row.tag.trim().toLocaleLowerCase() === target,
  );
}

export function optionIdFromLabel(label: string): string | null {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug ? `opt_${slug}` : null;
}

export function optionLabelFromId(id: string | null): string {
  if (!id) return "";
  return id
    .replace(/^opt_/, "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function numericValue(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

export function outdoorEquipLabel(row: HeatPumpOutdoorEquipRow | null | undefined): string {
  if (!row) return "";
  const manufacturer = optionLabelFromId(row.manufacturer);
  return manufacturer ? `${manufacturer} ${row.model_number}` : row.model_number;
}

export function indoorEquipLabel(row: HeatPumpIndoorEquipRow | null | undefined): string {
  if (!row) return "";
  const manufacturer = optionLabelFromId(row.manufacturer);
  return manufacturer ? `${manufacturer} ${row.model_number}` : row.model_number;
}

export function outdoorUnitLabel(row: HeatPumpOutdoorUnitRow | null | undefined): string {
  return row?.tag ?? "";
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
