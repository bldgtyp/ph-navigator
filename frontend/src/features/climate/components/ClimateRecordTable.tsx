import { formatTemperatureFromC, type UnitSystem } from "../../../lib/units";
import { elevationUnitLabel, formatLocationElevationDisplay } from "../../projects/location-form";
import { KWH_M2_TO_KBTU_FT2, W_M2_TO_BTU_H_FT2 } from "../chart-data";
import { formatSi, MONTH_LABELS } from "../lib";
import type { ClimatePeakLoad, ClimateRecord, Monthly12 } from "../types";

// The standardized climate record rendered as read-only tables: a scalar
// summary, the monthly temperature + radiation series, and the design
// (peak-load) conditions. Temperatures respect the IP/SI toggle;
// radiation/energy use the Climate-tab display units from D-CL-21.
export function ClimateRecordTable({
  record,
  unitSystem,
}: {
  record: ClimateRecord;
  unitSystem: UnitSystem;
}) {
  const { climate, aux, location } = record;

  return (
    <div className="climate-record">
      <dl className="climate-record-summary">
        <Scalar label="Station elevation">
          {formatLocationElevationDisplay(climate.station_elevation_m, unitSystem)}{" "}
          {elevationUnitLabel(unitSystem)}
        </Scalar>
        <Scalar label="Summer temp swing">{climate.summer_daily_temperature_swing_k} K</Scalar>
        <Scalar label="Avg wind speed">{formatSi(climate.average_wind_speed_ms, 1)} m/s</Scalar>
        <Scalar label="UTC offset">{location.hours_from_utc} h</Scalar>
        <Scalar label="Heating degree-hours">{formatSi(aux.heating_degree_hours_12_20)} kKh</Scalar>
        <Scalar label="Cooling degree-hours">{formatSi(aux.cooling_degree_hours_24)} kKh</Scalar>
        <Scalar label="Albedo">{formatSi(aux.albedo, 2)}</Scalar>
      </dl>

      <MonthlyClimateTables record={record} unitSystem={unitSystem} />
      <ClimatePeakLoadsTable peaks={climate.peak_loads} unitSystem={unitSystem} />
    </div>
  );
}

export function MonthlyClimateTables({
  record,
  unitSystem,
}: {
  record: ClimateRecord;
  unitSystem: UnitSystem;
}) {
  const { climate } = record;
  const temp = (value: number) => formatTemperatureFromC(value, { unitSystem, showUnit: false });
  const monthlyRadiation = (value: number) =>
    formatSi(unitSystem === "IP" ? value * KWH_M2_TO_KBTU_FT2 : value, unitSystem === "IP" ? 1 : 0);
  return (
    <>
      <MonthlyTable
        caption="Monthly temperatures"
        unitNote={`°${unitSystem === "IP" ? "F" : "C"}`}
        rows={[
          { label: "Air", values: climate.monthly_temps.air_c, format: temp },
          { label: "Dewpoint", values: climate.monthly_temps.dewpoint_c, format: temp },
          { label: "Sky", values: climate.monthly_temps.sky_c, format: temp },
          { label: "Ground", values: climate.monthly_temps.ground_c, format: temp },
        ]}
      />

      <MonthlyTable
        caption="Monthly radiation"
        unitNote={unitSystem === "IP" ? "kBtu/ft²·mo" : "kWh/m²"}
        rows={[
          { label: "North", values: climate.monthly_radiation.north, format: monthlyRadiation },
          { label: "East", values: climate.monthly_radiation.east, format: monthlyRadiation },
          { label: "South", values: climate.monthly_radiation.south, format: monthlyRadiation },
          { label: "West", values: climate.monthly_radiation.west, format: monthlyRadiation },
          { label: "Global", values: climate.monthly_radiation.glob, format: monthlyRadiation },
        ]}
      />
    </>
  );
}

function Scalar({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function MonthlyTable({
  caption,
  unitNote,
  rows,
}: {
  caption: string;
  unitNote: string;
  rows: { label: string; values: Monthly12; format: (value: number) => string }[];
}) {
  return (
    <table className="climate-table">
      <caption>
        {caption} <span className="climate-table-unit">{unitNote}</span>
      </caption>
      <thead>
        <tr>
          <th scope="col">Series</th>
          {MONTH_LABELS.map((month) => (
            <th key={month} scope="col">
              {month}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            {row.values.map((value, index) => (
              <td key={MONTH_LABELS[index]}>{row.format(value)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ClimatePeakLoadsTable({
  peaks,
  unitSystem,
}: {
  peaks: {
    heat_load_1: ClimatePeakLoad;
    heat_load_2: ClimatePeakLoad;
    cooling_load_1: ClimatePeakLoad;
    cooling_load_2: ClimatePeakLoad;
  };
  unitSystem: UnitSystem;
}) {
  const formatTemp = (value: number) => formatTemperatureFromC(value, { unitSystem });
  const formatRadiation = (value: number) =>
    formatSi(unitSystem === "IP" ? value * W_M2_TO_BTU_H_FT2 : value, unitSystem === "IP" ? 1 : 0);
  const rows = [
    { label: "Heating 1", peak: peaks.heat_load_1 },
    { label: "Heating 2", peak: peaks.heat_load_2 },
    { label: "Cooling 1", peak: peaks.cooling_load_1 },
    { label: "Cooling 2", peak: peaks.cooling_load_2 },
  ];
  return (
    <table className="climate-table">
      <caption>
        Design conditions{" "}
        <span className="climate-table-unit">
          temp · radiation {unitSystem === "IP" ? "Btu/h·ft²" : "W/m²"}
        </span>
      </caption>
      <thead>
        <tr>
          <th scope="col">Condition</th>
          <th scope="col">Temp</th>
          <th scope="col">North</th>
          <th scope="col">East</th>
          <th scope="col">South</th>
          <th scope="col">West</th>
          <th scope="col">Global</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ label, peak }) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            <td>{formatTemp(peak.temp_c)}</td>
            <td>{formatRadiation(peak.rad_north)}</td>
            <td>{formatRadiation(peak.rad_east)}</td>
            <td>{formatRadiation(peak.rad_south)}</td>
            <td>{formatRadiation(peak.rad_west)}</td>
            <td>{formatRadiation(peak.rad_global)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
