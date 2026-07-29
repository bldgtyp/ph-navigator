import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumberWithUnit } from "../../../lib/units/format";
import {
  axisLabel,
  buildMoistureChartRows,
  buildPressureProfileRows,
  buildTemperatureProfileRows,
  type ProfileAxis,
} from "../condensation-chart-data";
import type { AssemblyCondensationResponse, CondensationMonth } from "../condensation-types";

const CHART_MARGIN = { top: 24, right: 28, bottom: 8, left: 2 };
const INITIAL_CHART_DIMENSION = { width: 800, height: 280 };
const PROFILE_CHART_MARGIN = { ...CHART_MARGIN, bottom: 28 };
const PROFILE_CHART_DIMENSION = { ...INITIAL_CHART_DIMENSION, height: 300 };
const PROFILE_LEGEND_STYLE = { bottom: 0 };

export function AccumulatedMoistureChart({ result }: { result: AssemblyCondensationResponse }) {
  const rows = buildMoistureChartRows(result);
  return (
    <figure className="condensation-chart condensation-chart--hero">
      <figcaption>
        Accumulated interstitial moisture <span>g/m²</span>
      </figcaption>
      <div className="condensation-chart__canvas">
        <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL_CHART_DIMENSION}>
          <LineChart data={rows} margin={CHART_MARGIN}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
            <XAxis dataKey="monthLabel" stroke="var(--chart-axis)" tickMargin={6} interval={0} />
            <YAxis stroke="var(--chart-axis)" width={52} />
            <Tooltip
              formatter={(value) => formatChartValue(value, "g/m²")}
              labelFormatter={(_, payload) => payload[0]?.payload.monthName ?? "Month"}
              contentStyle={TOOLTIP_STYLE}
            />
            <Legend />
            <ReferenceLine
              y={result.settings.ma_limit_g_m2}
              name="Selected limit"
              stroke="var(--chart-2)"
              strokeDasharray="5 4"
              ifOverflow="extendDomain"
              label={{
                value: `Limit ${formatNumberWithUnit(result.settings.ma_limit_g_m2, "g/m²", {
                  unitSystem: "SI",
                  fractionDigits: 2,
                })}`,
                position: "insideTopRight",
                fill: "var(--chart-2)",
              }}
            />
            <Line
              type="monotone"
              dataKey="accumulatedMoisture"
              name="Accumulated Ma"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={{ r: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export function PressureProfileChart({
  month,
  axis,
  layerLabels,
}: {
  month: CondensationMonth;
  axis: ProfileAxis;
  layerLabels: Map<string, string>;
}) {
  const rows = buildPressureProfileRows(month, axis, layerLabels);
  const interfaces = rows.filter((row) => row.interfaceLabel !== null);
  return (
    <figure className="condensation-chart condensation-chart--profile">
      <figcaption>
        Vapour-pressure profile <span>Pa · {month.month_name}</span>
        <span className="sr-only">Horizontal axis: {axisLabel(axis)}</span>
      </figcaption>
      <div className="condensation-chart__canvas">
        <ResponsiveContainer width="100%" height="100%" initialDimension={PROFILE_CHART_DIMENSION}>
          <LineChart data={rows} margin={PROFILE_CHART_MARGIN}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
            <XAxis
              dataKey="position"
              type="number"
              domain={["dataMin", "dataMax"]}
              stroke="var(--chart-axis)"
              tickFormatter={formatAxisNumber}
              tickMargin={6}
              label={{
                value: axisLabel(axis),
                position: "insideBottom",
                offset: -12,
                fill: "var(--chart-axis)",
              }}
            />
            <YAxis stroke="var(--chart-axis)" width={58} />
            <Tooltip
              formatter={(value, name) => [formatChartValue(value, "Pa"), name]}
              labelFormatter={(value) => `${axisLabel(axis)}: ${formatAxisNumber(value)}`}
              contentStyle={TOOLTIP_STYLE}
            />
            <Legend wrapperStyle={PROFILE_LEGEND_STYLE} />
            {interfaces.map((row) => (
              <ReferenceLine
                key={`${row.nodeIndex}-${row.position}`}
                x={row.position}
                stroke="var(--chart-4)"
                strokeDasharray="4 3"
                label={{
                  value: row.interfaceLabel ?? "",
                  position: "insideTopRight",
                  fill: "var(--chart-4)",
                }}
              />
            ))}
            <Line
              type="linear"
              dataKey="saturationPressure"
              name="Saturation pressure psat"
              stroke="var(--chart-2)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="vaporPressure"
              name="Partial pressure pv"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={(props) => pressureDot(props, rows)}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {interfaces.length > 0 ? (
        <p className="condensation-chart__interfaces">
          Condensing interface: {interfaces.map((row) => row.interfaceLabel).join("; ")}
        </p>
      ) : (
        <p className="condensation-chart__interfaces">No condensing interface this month.</p>
      )}
    </figure>
  );
}

export function TemperatureProfileChart({
  month,
  axis,
}: {
  month: CondensationMonth;
  axis: ProfileAxis;
}) {
  const rows = buildTemperatureProfileRows(month, axis);
  const interiorPosition = rows.at(-1)?.position ?? 0;
  return (
    <figure className="condensation-chart condensation-chart--profile">
      <figcaption>
        Temperature profile <span>°C · {month.month_name}</span>
        <span className="sr-only">Horizontal axis: {axisLabel(axis)}</span>
      </figcaption>
      <div className="condensation-chart__canvas">
        <ResponsiveContainer width="100%" height="100%" initialDimension={PROFILE_CHART_DIMENSION}>
          <LineChart data={rows} margin={PROFILE_CHART_MARGIN}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
            <XAxis
              dataKey="position"
              type="number"
              domain={["dataMin", "dataMax"]}
              stroke="var(--chart-axis)"
              tickFormatter={formatAxisNumber}
              tickMargin={6}
              label={{
                value: axisLabel(axis),
                position: "insideBottom",
                offset: -12,
                fill: "var(--chart-axis)",
              }}
            />
            <YAxis stroke="var(--chart-axis)" width={48} unit="°" />
            <Tooltip
              formatter={(value) => formatChartValue(value, "°C")}
              labelFormatter={(value) => `${axisLabel(axis)}: ${formatAxisNumber(value)}`}
              contentStyle={TOOLTIP_STYLE}
            />
            <Legend wrapperStyle={PROFILE_LEGEND_STYLE} />
            <Line
              type="linear"
              dataKey="temperature"
              name="Layer temperature"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={{ r: 2 }}
              isAnimationActive={false}
            />
            <ReferenceDot
              x={interiorPosition}
              y={month.interior_surface_temp_c}
              r={4}
              fill="var(--chart-1)"
              stroke="var(--bg-card)"
              ifOverflow="extendDomain"
              label={{
                value: "Interior surface",
                position: "insideTopLeft",
                fill: "var(--chart-1)",
              }}
            />
            <ReferenceDot
              x={interiorPosition}
              y={month.mold_threshold_c}
              r={4}
              fill="var(--chart-4)"
              stroke="var(--bg-card)"
              ifOverflow="extendDomain"
              label={{
                value: "80% RH mould threshold",
                position: "insideBottomLeft",
                fill: "var(--chart-4)",
              }}
            />
            <ReferenceDot
              x={interiorPosition}
              y={month.dewpoint_threshold_c}
              r={4}
              fill="var(--chart-2)"
              stroke="var(--bg-card)"
              ifOverflow="extendDomain"
              label={{
                value: "100% RH condensation threshold",
                position: "insideBottomLeft",
                fill: "var(--chart-2)",
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="condensation-chart__interfaces">
        Interior surface{" "}
        {formatNumberWithUnit(month.interior_surface_temp_c, "°C", {
          unitSystem: "SI",
          fractionDigits: 2,
        })}{" "}
        · mould threshold{" "}
        {formatNumberWithUnit(month.mold_threshold_c, "°C", {
          unitSystem: "SI",
          fractionDigits: 2,
        })}{" "}
        · condensation threshold{" "}
        {formatNumberWithUnit(month.dewpoint_threshold_c, "°C", {
          unitSystem: "SI",
          fractionDigits: 2,
        })}
      </p>
    </figure>
  );
}

const TOOLTIP_STYLE = {
  background: "var(--bg-card)",
  border: "1px solid var(--chart-grid)",
  borderRadius: "var(--phn-radius)",
};

function pressureDot(
  props: {
    cx?: number;
    cy?: number;
    index?: number;
  },
  rows: ReturnType<typeof buildPressureProfileRows>,
) {
  const { cx, cy, index = -1 } = props;
  if (cx === undefined || cy === undefined || !rows[index]?.isCondensing) return <></>;
  return <circle cx={cx} cy={cy} r={4} fill="var(--chart-4)" stroke="var(--bg-card)" />;
}

function formatChartValue(value: unknown, unit: string): string {
  return typeof value === "number" && Number.isFinite(value)
    ? formatNumberWithUnit(value, unit, { unitSystem: "SI", fractionDigits: 2 })
    : "—";
}

function formatAxisNumber(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? formatNumberWithUnit(value, "", {
        unitSystem: "SI",
        fractionDigits: 2,
        showUnit: false,
      })
    : "—";
}
