import {
  incomingLinkColumn,
  incomingLinkFieldDef,
  type DataTableColumnDef,
  type FieldDef,
} from "../../../shared/ui/data-table";
import type { HeatPumpIndoorUnitRow, HeatPumpOutdoorUnitRow } from "./types";

export const HEAT_PUMP_LINK_TARGETS = {
  outdoorEquip: ["equipment", "heat_pumps", "outdoor_equip"],
  indoorEquip: ["equipment", "heat_pumps", "indoor_equip"],
  outdoorUnits: ["equipment", "heat_pumps", "outdoor_units"],
  indoorUnits: ["equipment", "heat_pumps", "indoor_units"],
  ventilators: ["equipment", "ervs"],
} as const;

export const INCOMING_INDOOR_UNITS_FIELD_KEY = "incoming_indoor_unit_ids";
export const INCOMING_OUTDOOR_UNITS_FIELD_KEY = "incoming_outdoor_unit_ids";

const EMPTY_INDOOR_UNIT_IDS: readonly string[] = [];
const EMPTY_OUTDOOR_UNIT_IDS: readonly string[] = [];

export function incomingIndoorUnitsFieldDef(displayName = "Indoor units"): FieldDef {
  return incomingUnitsFieldDef({
    fieldKey: INCOMING_INDOOR_UNITS_FIELD_KEY,
    displayName,
    targetTablePath: HEAT_PUMP_LINK_TARGETS.indoorUnits,
  });
}

export function incomingIndoorUnitColumnDef<TRow>({
  header = "Indoor units",
  indoorUnits,
  getIncomingIds,
  onActivateEdit,
}: {
  header?: string;
  indoorUnits: readonly HeatPumpIndoorUnitRow[];
  getIncomingIds: (row: TRow) => readonly string[];
  onActivateEdit?: (row: TRow) => void;
}): DataTableColumnDef<TRow> {
  return incomingUnitColumnDef({
    fieldKey: INCOMING_INDOOR_UNITS_FIELD_KEY,
    header,
    units: indoorUnits,
    getIncomingIds,
    getLabel: indoorUnitLabel,
    onActivateEdit,
  });
}

export function incomingOutdoorUnitsFieldDef(displayName = "Outdoor units"): FieldDef {
  return incomingUnitsFieldDef({
    fieldKey: INCOMING_OUTDOOR_UNITS_FIELD_KEY,
    displayName,
    targetTablePath: HEAT_PUMP_LINK_TARGETS.outdoorUnits,
  });
}

export function incomingOutdoorUnitColumnDef<TRow>({
  header = "Outdoor units",
  outdoorUnits,
  getIncomingIds,
  onActivateEdit,
}: {
  header?: string;
  outdoorUnits: readonly HeatPumpOutdoorUnitRow[];
  getIncomingIds: (row: TRow) => readonly string[];
  onActivateEdit?: (row: TRow) => void;
}): DataTableColumnDef<TRow> {
  return incomingUnitColumnDef({
    fieldKey: INCOMING_OUTDOOR_UNITS_FIELD_KEY,
    header,
    units: outdoorUnits,
    getIncomingIds,
    getLabel: outdoorUnitLabel,
    onActivateEdit,
  });
}

export function indoorUnitIdsByIndoorEquip(
  indoorUnits: readonly HeatPumpIndoorUnitRow[],
): ReadonlyMap<string, readonly string[]> {
  return groupIndoorUnitIds(indoorUnits, (unit) => unit.indoor_equip_id);
}

export function indoorUnitIdsByOutdoorUnit(
  indoorUnits: readonly HeatPumpIndoorUnitRow[],
): ReadonlyMap<string, readonly string[]> {
  return groupIndoorUnitIds(indoorUnits, (unit) => unit.outdoor_unit_id);
}

export function incomingIndoorUnitIds(
  index: ReadonlyMap<string, readonly string[]>,
  targetId: string,
): readonly string[] {
  return index.get(targetId) ?? EMPTY_INDOOR_UNIT_IDS;
}

export function outdoorUnitIdsByOutdoorEquip(
  outdoorUnits: readonly HeatPumpOutdoorUnitRow[],
): ReadonlyMap<string, readonly string[]> {
  return groupOutdoorUnitIds(outdoorUnits, (unit) => unit.outdoor_equip_id);
}

export function indoorEquipIdsByOutdoorEquip({
  outdoorUnits,
  indoorUnits,
}: {
  outdoorUnits: readonly HeatPumpOutdoorUnitRow[];
  indoorUnits: readonly HeatPumpIndoorUnitRow[];
}): ReadonlyMap<string, readonly string[]> {
  const outdoorEquipIdByUnitId = new Map(
    outdoorUnits.map((unit) => [unit.id, unit.outdoor_equip_id]),
  );
  const grouped = new Map<string, string[]>();
  for (const unit of indoorUnits) {
    if (!unit.outdoor_unit_id) continue;
    const outdoorEquipId = outdoorEquipIdByUnitId.get(unit.outdoor_unit_id);
    if (!outdoorEquipId) continue;
    const ids = grouped.get(outdoorEquipId) ?? [];
    if (!ids.includes(unit.indoor_equip_id)) ids.push(unit.indoor_equip_id);
    grouped.set(outdoorEquipId, ids);
  }
  return grouped;
}

export function incomingOutdoorUnitIds(
  index: ReadonlyMap<string, readonly string[]>,
  targetId: string,
): readonly string[] {
  return index.get(targetId) ?? EMPTY_OUTDOOR_UNIT_IDS;
}

export function firstLinkedId(value: unknown): string | null {
  return linkedIds(value)[0] ?? null;
}

export function linkedIds(value: unknown): string[] {
  if (typeof value === "string") return value.length > 0 ? [value] : [];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function incomingUnitsFieldDef({
  fieldKey,
  displayName,
  targetTablePath,
}: {
  fieldKey: string;
  displayName: string;
  targetTablePath: readonly string[];
}): FieldDef {
  return incomingLinkFieldDef({ fieldKey, displayName, targetTablePath });
}

function incomingUnitColumnDef<TRow, TUnit extends { id: string }>({
  fieldKey,
  header,
  units,
  getIncomingIds,
  getLabel,
  onActivateEdit,
}: {
  fieldKey: string;
  header: string;
  units: readonly TUnit[];
  getIncomingIds: (row: TRow) => readonly string[];
  getLabel: (unit: TUnit) => string;
  onActivateEdit?: (row: TRow) => void;
}): DataTableColumnDef<TRow> {
  const unitLabelById = new Map(units.map((unit) => [unit.id, getLabel(unit)]));
  return incomingLinkColumn({
    id: fieldKey,
    fieldKey,
    header,
    getIncomingIds,
    resolveLabel: (id) => unitLabelById.get(id) ?? null,
    onActivateEdit,
    accessorValue: "ids",
  });
}

function indoorUnitLabel(row: HeatPumpIndoorUnitRow): string {
  return row.tag || row.id;
}

function outdoorUnitLabel(row: HeatPumpOutdoorUnitRow): string {
  return row.tag || row.id;
}

function groupIndoorUnitIds(
  indoorUnits: readonly HeatPumpIndoorUnitRow[],
  getTargetId: (unit: HeatPumpIndoorUnitRow) => string | null,
): ReadonlyMap<string, readonly string[]> {
  return groupRowIds(indoorUnits, getTargetId);
}

function groupOutdoorUnitIds(
  outdoorUnits: readonly HeatPumpOutdoorUnitRow[],
  getTargetId: (unit: HeatPumpOutdoorUnitRow) => string | null,
): ReadonlyMap<string, readonly string[]> {
  return groupRowIds(outdoorUnits, getTargetId);
}

function groupRowIds<TRow extends { id: string }>(
  rows: readonly TRow[],
  getTargetId: (row: TRow) => string | null,
): ReadonlyMap<string, readonly string[]> {
  const index = new Map<string, string[]>();
  for (const row of rows) {
    const targetId = getTargetId(row);
    if (!targetId) continue;
    const ids = index.get(targetId);
    if (ids) {
      ids.push(row.id);
    } else {
      index.set(targetId, [row.id]);
    }
  }
  return index;
}
