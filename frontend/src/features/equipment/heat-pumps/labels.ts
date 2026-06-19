import { optionLabelFromId } from "./option-helpers";
import type {
  HeatPumpIndoorEquipRow,
  HeatPumpOutdoorEquipRow,
  HeatPumpOutdoorUnitRow,
  HeatPumpSingleSelectOption,
} from "./types";

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
