import type {
  HeatPumpIndoorEquipRow,
  HeatPumpIndoorUnitRow,
  HeatPumpOutdoorEquipRow,
  HeatPumpOutdoorUnitRow,
} from "./types";

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
