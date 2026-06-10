import type {
  HeatPumpIndoorEquipRow,
  HeatPumpIndoorUnitRow,
  HeatPumpOutdoorEquipRow,
  HeatPumpOutdoorUnitRow,
  HeatPumpSingleSelectOption,
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
  return sortBy(rows, (row) => row.tag);
}

export function sortedIndoorEquip(rows: HeatPumpIndoorEquipRow[]) {
  return sortBy(rows, (row) => row.tag);
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

/**
 * Resolve the human-readable label for an option id from an explicit option
 * list. Returns "" if `id` is null, "" if `options` is empty, or the raw id
 * (without the `opt_` prefix) if the id isn't present in the list — that fallback
 * keeps existing rows readable while the option list is being populated for the
 * first time, and avoids a blank column for catalog-imported rows that
 * reference an option from a different project.
 */
export function optionLabelFromId(
  id: string | null,
  options: readonly HeatPumpSingleSelectOption[],
): string {
  if (!id) return "";
  const hit = options.find((option) => option.id === id);
  if (hit) return hit.label;
  return id.replace(/^opt_/, "");
}

/**
 * Look up an option by case-insensitive trimmed label match. Returns null when
 * the label doesn't match any existing option — callers that want "find or
 * create" should mint a new option and call the options-mutation API instead of
 * slugging the label client-side.
 */
export function findOptionByLabel(
  label: string,
  options: readonly HeatPumpSingleSelectOption[],
): HeatPumpSingleSelectOption | null {
  const target = label.trim().toLocaleLowerCase();
  if (!target) return null;
  return options.find((option) => option.label.trim().toLocaleLowerCase() === target) ?? null;
}

const OPTION_COLOR_PALETTE = [
  "#3b82f6",
  "#10b981",
  "#a16207",
  "#7c3aed",
  "#0f766e",
  "#be123c",
] as const;

/**
 * Mint a fresh `opt_*` id + cycling color for an option created from the UI.
 * The backend mints its own id when add ops omit one, but we mint here so the
 * optimistic patch payload stays self-consistent.
 */
export function buildNewHeatPumpOption(
  label: string,
  existing: readonly HeatPumpSingleSelectOption[],
): HeatPumpSingleSelectOption {
  const trimmed = label.trim();
  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const id = slug ? `opt_${slug}_${randomSuffix(4)}` : `opt_${randomSuffix(8)}`;
  const color = OPTION_COLOR_PALETTE[existing.length % OPTION_COLOR_PALETTE.length] ?? "#3b82f6";
  const order =
    existing.length === 0 ? 0 : Math.max(...existing.map((option) => option.order)) + 1;
  return { id, label: trimmed, color, order };
}

function randomSuffix(length: number): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function numericValue(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

export function outdoorEquipLabel(
  row: HeatPumpOutdoorEquipRow | null | undefined,
  manufacturerOptions: readonly HeatPumpSingleSelectOption[] = [],
): string {
  if (!row) return "";
  return equipLabel(row.tag, row.manufacturer, row.model_number, manufacturerOptions);
}

export function indoorEquipLabel(
  row: HeatPumpIndoorEquipRow | null | undefined,
  manufacturerOptions: readonly HeatPumpSingleSelectOption[] = [],
): string {
  if (!row) return "";
  return equipLabel(row.tag, row.manufacturer, row.model_number, manufacturerOptions);
}

function equipLabel(
  tag: string,
  manufacturerId: string | null,
  modelNumber: string | null,
  manufacturerOptions: readonly HeatPumpSingleSelectOption[],
): string {
  const manufacturer = optionLabelFromId(manufacturerId, manufacturerOptions);
  const model = (modelNumber ?? "").trim();
  const spec = [manufacturer, model].filter(Boolean).join(" ");
  if (!tag) return spec;
  return spec ? `${tag} — ${spec}` : tag;
}

export function outdoorUnitLabel(row: HeatPumpOutdoorUnitRow | null | undefined): string {
  return row?.tag ?? "";
}

export function ventilatorLabel(
  row: { custom_values: Record<string, unknown> } | null | undefined,
): string {
  if (!row) return "";
  const recordId = stringValue(row.custom_values.record_id);
  const name = stringValue(row.custom_values.name);
  if (recordId && name) return `${recordId} — ${name}`;
  return recordId || name || "(unnamed)";
}

export function roomLabel(
  row: { custom_values: Record<string, unknown> } | null | undefined,
): string {
  if (!row) return "";
  const number = stringValue(row.custom_values.number);
  const name = stringValue(row.custom_values.name);
  if (number && name) return `${number} — ${name}`;
  return number || name || "(unnamed)";
}

function stringValue(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
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
