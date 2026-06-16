import type { DataTableColumnDef, FieldDef } from "../../../shared/ui/data-table";
import type { HeatPumpIndoorUnitRow } from "./types";

export const HEAT_PUMP_LINK_TARGETS = {
  indoorEquip: ["equipment", "heat_pumps", "indoor_equip"],
  outdoorUnits: ["equipment", "heat_pumps", "outdoor_units"],
  indoorUnits: ["equipment", "heat_pumps", "indoor_units"],
} as const;

export const INCOMING_INDOOR_UNITS_FIELD_KEY = "incoming_indoor_unit_ids";

const EMPTY_INDOOR_UNIT_IDS: readonly string[] = [];

export function incomingIndoorUnitsFieldDef(displayName = "Indoor units"): FieldDef {
  return {
    field_key: INCOMING_INDOOR_UNITS_FIELD_KEY,
    field_type: "linked_record",
    display_name: displayName,
    read_only: true,
    linked_record_config: {
      target_table_path: [...HEAT_PUMP_LINK_TARGETS.indoorUnits],
      max_links: null,
    },
  };
}

export function incomingIndoorUnitColumnDef<TRow>({
  header = "Indoor units",
  indoorUnits,
  getIncomingIds,
}: {
  header?: string;
  indoorUnits: readonly HeatPumpIndoorUnitRow[];
  getIncomingIds: (row: TRow) => readonly string[];
}): DataTableColumnDef<TRow> {
  const unitLabelById = new Map(indoorUnits.map((unit) => [unit.id, indoorUnitLabel(unit)]));
  const labelFor = (id: string) => unitLabelById.get(id) ?? id;
  return {
    id: INCOMING_INDOOR_UNITS_FIELD_KEY,
    fieldKey: INCOMING_INDOOR_UNITS_FIELD_KEY,
    header,
    accessor: (row) => getIncomingIds(row),
    measureText: (row) => getIncomingIds(row).map(labelFor).join(", "),
    defaultWidth: 180,
    className: "data-table-inverse-link-cell",
  };
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

function indoorUnitLabel(row: HeatPumpIndoorUnitRow): string {
  return row.tag || row.id;
}

function groupIndoorUnitIds(
  indoorUnits: readonly HeatPumpIndoorUnitRow[],
  getTargetId: (unit: HeatPumpIndoorUnitRow) => string | null,
): ReadonlyMap<string, readonly string[]> {
  const index = new Map<string, string[]>();
  for (const unit of indoorUnits) {
    const targetId = getTargetId(unit);
    if (!targetId) continue;
    const ids = index.get(targetId);
    if (ids) {
      ids.push(unit.id);
    } else {
      index.set(targetId, [unit.id]);
    }
  }
  return index;
}
