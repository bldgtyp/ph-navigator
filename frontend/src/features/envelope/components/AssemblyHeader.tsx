import { createSearchParams, useNavigate } from "react-router-dom";
import {
  formatLengthFromMm,
  formatRValueFromM2KPerW,
  formatUValueFromWm2K,
  useUnitPreference,
} from "../../../lib/units";
import { statusLabel, totalThicknessMm } from "../lib";
import { envelopeAssemblyPath } from "../paths";
import type { Assembly, AssemblyThermalResponse } from "../types";

export function AssemblyHeader({
  projectId,
  assemblies,
  activeAssembly,
  search,
  thermal,
  thermalLoading,
}: {
  projectId: string;
  assemblies: Assembly[];
  activeAssembly: Assembly;
  search: URLSearchParams;
  thermal: AssemblyThermalResponse | null;
  thermalLoading: boolean;
}) {
  const { unitSystem } = useUnitPreference();
  const navigate = useNavigate();
  const query = createSearchParams(search).toString();
  const thermalLabel = formatThermalLabel(thermal, thermalLoading, unitSystem);
  return (
    <header className="assembly-header">
      <div className="assembly-picker-field">
        <label htmlFor="assembly-picker">Assembly</label>
        <select
          id="assembly-picker"
          value={activeAssembly.id}
          onChange={(event) => {
            const path = envelopeAssemblyPath(projectId, event.currentTarget.value);
            navigate(`${path}${query ? `?${query}` : ""}`);
          }}
        >
          {assemblies.map((assembly) => (
            <option key={assembly.id} value={assembly.id}>
              {assembly.name}
            </option>
          ))}
        </select>
      </div>
      <dl className="assembly-header-metrics">
        <div>
          <dt>Total thickness</dt>
          <dd data-testid="total-thickness">
            {formatLengthFromMm(totalThicknessMm(activeAssembly), { unitSystem })}
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{statusLabel(activeAssembly.status.flags)}</dd>
        </div>
        <div>
          <dt>Thermal</dt>
          <dd title={thermalTooltip(thermal)} data-testid="assembly-thermal-label">
            {thermalLabel}
          </dd>
        </div>
      </dl>
    </header>
  );
}

function formatThermalLabel(
  thermal: AssemblyThermalResponse | null,
  loading: boolean,
  unitSystem: "IP" | "SI",
): string {
  if (loading) return "Calculating";
  if (!thermal) return "Unavailable";
  if (thermal.r_effective_m2k_w === null || thermal.u_effective_w_m2k === null) {
    return statusLabel(thermal.status.flags);
  }
  const value =
    unitSystem === "IP"
      ? formatRValueFromM2KPerW(thermal.r_effective_m2k_w, {
          unitSystem,
          fractionDigits: 1,
        })
      : formatUValueFromWm2K(thermal.u_effective_w_m2k, {
          unitSystem,
          fractionDigits: 3,
        });
  return thermal.status.is_complete ? value : `${value} (${statusLabel(thermal.status.flags)})`;
}

function thermalTooltip(thermal: AssemblyThermalResponse | null): string {
  if (!thermal) return "Construction-only thermal value. Surface films are excluded.";
  return [
    "Construction-only PH average of Parallel-Path and Isothermal-Planes. Surface films are excluded.",
    ...thermal.warnings,
  ].join(" ");
}
