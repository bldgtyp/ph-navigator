// Pure transforms from a standardized ClimateRecord into the row arrays the
// recharts monthly graphs consume. Kept separate from the chart component so
// the mapping (incl. the IP/SI temperature conversion) is unit-testable
// without rendering recharts (whose ResponsiveContainer needs a real layout).

import { cToF } from "../../lib/units/temperature";
import type { UnitSystem } from "../../lib/units";
import { MONTH_LABELS } from "./lib";
import type { ClimateRecord } from "./types";

// One plotted series: the row-object key it reads, its legend label, and the
// design-token CSS variable name used for its stroke (resolved to `var(--…)`
// by the chart component, keeping feature code hex-free).
export type ChartSeries = {
  key: string;
  label: string;
  colorVar: string;
};

// A single month's row: the axis label plus one numeric field per series key.
export type MonthlyChartRow = { month: string; [series: string]: number | string };

export const TEMPERATURE_SERIES: ChartSeries[] = [
  { key: "air", label: "Air", colorVar: "--chart-1" },
  { key: "dewpoint", label: "Dewpoint", colorVar: "--chart-2" },
  { key: "sky", label: "Sky", colorVar: "--chart-5" },
];

export const RADIATION_SERIES: ChartSeries[] = [
  { key: "north", label: "North", colorVar: "--chart-1" },
  { key: "east", label: "East", colorVar: "--chart-2" },
  { key: "south", label: "South", colorVar: "--chart-3" },
  { key: "west", label: "West", colorVar: "--chart-4" },
  { key: "glob", label: "Global", colorVar: "--chart-5" },
];

// Monthly air/dewpoint/sky/ground temperatures, converted to the active unit
// system (°F for IP, °C for SI) so the axis + tooltip read in display units.
export function buildMonthlyTemperatureRows(
  record: ClimateRecord,
  unitSystem: UnitSystem,
): MonthlyChartRow[] {
  const { monthly_temps } = record.climate;
  const toDisplay = (valueC: number) => (unitSystem === "IP" ? cToF(valueC) : valueC);
  return MONTH_LABELS.map((month, index) => ({
    month,
    air: toDisplay(monthly_temps.air_c[index] ?? 0),
    dewpoint: toDisplay(monthly_temps.dewpoint_c[index] ?? 0),
    sky: toDisplay(monthly_temps.sky_c[index] ?? 0),
    ground: toDisplay(monthly_temps.ground_c[index] ?? 0),
  }));
}

export const KWH_M2_TO_KBTU_FT2 = 0.317;
export const W_M2_TO_BTU_H_FT2 = 0.317;

// Monthly N/E/S/W/global radiation, converted to kBtu/ft²·mo in IP mode.
export function buildMonthlyRadiationRows(
  record: ClimateRecord,
  unitSystem: UnitSystem = "SI",
): MonthlyChartRow[] {
  const { monthly_radiation } = record.climate;
  const toDisplay = (value: number) => (unitSystem === "IP" ? value * KWH_M2_TO_KBTU_FT2 : value);
  return MONTH_LABELS.map((month, index) => ({
    month,
    north: toDisplay(monthly_radiation.north[index] ?? 0),
    east: toDisplay(monthly_radiation.east[index] ?? 0),
    south: toDisplay(monthly_radiation.south[index] ?? 0),
    west: toDisplay(monthly_radiation.west[index] ?? 0),
    glob: toDisplay(monthly_radiation.glob[index] ?? 0),
  }));
}
