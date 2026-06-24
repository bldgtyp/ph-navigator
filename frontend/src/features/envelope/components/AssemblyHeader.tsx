import type { ReactNode } from "react";
import {
  formatLengthFromMm,
  formatRValueFromM2KPerW,
  formatUValueFromWm2K,
  useUnitPreference,
} from "../../../lib/units";
import { InfoTooltip } from "../../../shared/ui/info-tooltip";
import { InlineHeaderNameEditor } from "../../../shared/ui/InlineHeaderNameEditor";
import { statusLabel, totalThicknessMm } from "../lib";
import type { Assembly, AssemblyThermalResponse } from "../types";

export function AssemblyHeader({
  activeAssembly,
  thermal,
  thermalLoading,
  canEdit,
  busy,
  actions,
  onRename,
}: {
  activeAssembly: Assembly;
  thermal: AssemblyThermalResponse | null;
  thermalLoading: boolean;
  canEdit: boolean;
  busy: boolean;
  actions?: ReactNode;
  onRename: (name: string) => void;
}) {
  const { unitSystem } = useUnitPreference();
  const thermalLabel = formatThermalLabel(thermal, thermalLoading, unitSystem);
  const assemblyWarning = activeAssembly.status.is_complete
    ? null
    : statusLabel(activeAssembly.status.flags);
  return (
    <header id="assembly-builder-header" className="assembly-header" data-reveal-edit-on-hover>
      <div className="assembly-header-main">
        <InlineHeaderNameEditor
          value={activeAssembly.name}
          canEdit={canEdit}
          busy={busy}
          editLabel="Edit assembly name"
          inputLabel="Assembly name"
          onSubmit={onRename}
        />
        {actions ? <div className="assembly-header-actions">{actions}</div> : null}
      </div>
      <div className="assembly-header-summary">
        <dl id="assembly-header-metrics" className="assembly-header-metrics">
          <div id="assembly-total-thickness-metric">
            <dt>Total thickness</dt>
            <dd data-testid="total-thickness">
              {formatLengthFromMm(totalThicknessMm(activeAssembly), { unitSystem })}
            </dd>
          </div>
        </dl>
        <dl id="assembly-header-alerts" className="assembly-header-alerts">
          {assemblyWarning ? (
            <div id="assembly-status-warning" className="assembly-header-warning">
              <dt>Warning</dt>
              <dd>{assemblyWarning}</dd>
            </div>
          ) : null}
          <div id="assembly-thermal-metric">
            <dt className="assembly-header-metric-label">
              <span>Thermal</span>
              <InfoTooltip
                id="assembly-thermal-info-button"
                label="Effective Thermal Resistance details"
              >
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
              </InfoTooltip>
            </dt>
            <dd data-testid="assembly-thermal-label">{thermalLabel}</dd>
          </div>
        </dl>
      </div>
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
  return value;
}
