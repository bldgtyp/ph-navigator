import { Info } from "lucide-react";
import { createSearchParams, useNavigate } from "react-router-dom";
import { AutocompleteSelect } from "../../../shared/ui/AutocompleteSelect";
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
  const assemblyWarning = activeAssembly.status.is_complete
    ? null
    : statusLabel(activeAssembly.status.flags);
  return (
    <header className="assembly-header">
      <div className="assembly-picker-field">
        <AutocompleteSelect
          id="assembly-picker"
          label="Assembly"
          value={activeAssembly.id}
          compact
          options={assemblies.map((assembly) => ({ value: assembly.id, label: assembly.name }))}
          onChange={(nextAssemblyId) => {
            const path = envelopeAssemblyPath(projectId, nextAssemblyId);
            navigate(`${path}${query ? `?${query}` : ""}`);
          }}
        />
      </div>
      <dl className="assembly-header-metrics">
        <div>
          <dt>Total thickness</dt>
          <dd data-testid="total-thickness">
            {formatLengthFromMm(totalThicknessMm(activeAssembly), { unitSystem })}
          </dd>
        </div>
        {assemblyWarning ? (
          <div className="assembly-header-warning">
            <dt>Warning</dt>
            <dd>{assemblyWarning}</dd>
          </div>
        ) : null}
        <div>
          <dt className="assembly-header-metric-label">
            <span>Thermal</span>
            <button
              type="button"
              className="assembly-header-info-button"
              aria-label="Effective Thermal Resistance details"
            >
              <Info aria-hidden="true" size={12} strokeWidth={1.8} />
              <span className="assembly-header-info-tooltip" role="tooltip">
                <strong>Effective Thermal Resistance</strong>
                <span>
                  Calculated using the Passive House method: the average of the Parallel-Path and
                  Isothermal-Planes methods.
                </span>
                <span>
                  Note: Surface film resistances (air films) are NOT included in the value shown
                  here.
                </span>
                <em>Reference: ASHRAE Handbook - Fundamentals, Chapter 27</em>
              </span>
            </button>
          </dt>
          <dd data-testid="assembly-thermal-label">{thermalLabel}</dd>
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
