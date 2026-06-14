import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { UnitSystem } from "../../../lib/units";
import {
  buildMonthlyRadiationRows,
  buildMonthlyTemperatureRows,
  RADIATION_SERIES,
  TEMPERATURE_SERIES,
  type ChartSeries,
  type MonthlyChartRow,
} from "../chart-data";
import type { ClimateRecord } from "../types";

// The standardized climate record rendered as monthly line graphs: the
// temperature series (IP/SI-aware) and the radiation series (always SI). The
// scalar summary + design conditions stay in the table view (toggled in
// `ClimateRecordView`); graphs cover only the monthly series.
export function ClimateRecordCharts({
  record,
  unitSystem,
}: {
  record: ClimateRecord;
  unitSystem: UnitSystem;
}) {
  const tempUnit = `°${unitSystem === "IP" ? "F" : "C"}`;
  return (
    <div className="climate-charts">
      <MonthlyLineChart
        caption="Monthly temperatures"
        unitNote={tempUnit}
        rows={buildMonthlyTemperatureRows(record, unitSystem)}
        series={TEMPERATURE_SERIES}
      />
      <MonthlyLineChart
        caption="Monthly radiation"
        unitNote="kWh/m²"
        rows={buildMonthlyRadiationRows(record)}
        series={RADIATION_SERIES}
      />
    </div>
  );
}

function MonthlyLineChart({
  caption,
  unitNote,
  rows,
  series,
}: {
  caption: string;
  unitNote: string;
  rows: MonthlyChartRow[];
  series: ChartSeries[];
}) {
  return (
    <figure className="climate-chart">
      <figcaption>
        {caption} <span className="climate-table-unit">{unitNote}</span>
      </figcaption>
      <div className="climate-chart-canvas">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
            <XAxis dataKey="month" stroke="var(--chart-axis)" fontSize={12} tickMargin={6} />
            <YAxis stroke="var(--chart-axis)" fontSize={12} width={44} />
            <Tooltip
              contentStyle={{
                background: "var(--bg-card)",
                border: "1px solid var(--chart-grid)",
                borderRadius: "var(--phn-radius)",
                fontSize: "0.8rem",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "0.78rem" }} />
            {series.map((line) => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                name={line.label}
                stroke={`var(${line.colorVar})`}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
