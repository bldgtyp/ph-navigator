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
  { key: "ground", label: "Ground", colorVar: "--chart-4" },
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

// Monthly N/E/S/W/global radiation (kWh/m²). Radiation has no IP form in the
// units registry, so it stays SI regardless of the toggle (as in the tables).
export function buildMonthlyRadiationRows(record: ClimateRecord): MonthlyChartRow[] {
  const { monthly_radiation } = record.climate;
  return MONTH_LABELS.map((month, index) => ({
    month,
    north: monthly_radiation.north[index] ?? 0,
    east: monthly_radiation.east[index] ?? 0,
    south: monthly_radiation.south[index] ?? 0,
    west: monthly_radiation.west[index] ?? 0,
    glob: monthly_radiation.glob[index] ?? 0,
  }));
}
