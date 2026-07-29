import { useMemo, useState } from "react";
import {
  buildLayerLabelMap,
  defaultProfileMonth,
  monthByNumber,
  orderedCondensationMonths,
  type ProfileAxis,
} from "../condensation-chart-data";
import type { AssemblyCondensationResponse } from "../condensation-types";
import type { Assembly, ProjectMaterial } from "../types";
import { PressureProfileChart, TemperatureProfileChart } from "./CondensationCharts";

export function CondensationWherePanel({
  assembly,
  materials,
  result,
}: {
  assembly: Assembly;
  materials: ProjectMaterial[];
  result: AssemblyCondensationResponse;
}) {
  const [selectedMonth, setSelectedMonth] = useState(() => defaultProfileMonth(result));
  const [axis, setAxis] = useState<ProfileAxis>("thickness");
  const layerLabels = useMemo(
    () => buildLayerLabelMap(assembly, materials, result.worst_path_id),
    [assembly, materials, result.worst_path_id],
  );
  const month = monthByNumber(result, selectedMonth) ?? result.monthly[0] ?? null;

  if (!month) {
    return (
      <div className="condensation-risk-empty">
        <h3>Profile unavailable</h3>
        <p>The screened result did not include monthly profile data.</p>
      </div>
    );
  }

  return (
    <div className="condensation-where">
      <div className="condensation-profile-controls">
        <label>
          <span>Month</span>
          <select
            aria-label="Profile month"
            value={month.month}
            onChange={(event) => setSelectedMonth(Number(event.currentTarget.value))}
          >
            {orderedCondensationMonths(result).map((item) => (
              <option key={item.month} value={item.month}>
                {item.month_name}
              </option>
            ))}
          </select>
        </label>
        <div className="pill-tab-list" role="group" aria-label="Profile horizontal axis">
          <button
            type="button"
            className="pill-tab"
            aria-pressed={axis === "sd"}
            onClick={() => setAxis("sd")}
          >
            Vapour resistance (sd)
          </button>
          <button
            type="button"
            className="pill-tab"
            aria-pressed={axis === "thickness"}
            onClick={() => setAxis("thickness")}
          >
            Real thickness
          </button>
        </div>
      </div>
      <p className="condensation-profile-note">
        The sd view reveals vapour-control layers; the thickness view shows their near-zero physical
        width.
      </p>
      <div className="condensation-profile-charts">
        <PressureProfileChart month={month} axis={axis} layerLabels={layerLabels} />
        <TemperatureProfileChart month={month} axis={axis} />
      </div>
    </div>
  );
}
