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
import type { Assembly, AssemblyThermalResponse, ThermalStandard } from "../types";

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
  const constructionOnlyLabel = formatConstructionOnlyLabel(thermal, unitSystem);
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
              <InfoTooltip id="assembly-thermal-info-button" label="Thermal performance details">
                <strong>{unitSystem === "IP" ? "Effective R-Value" : "Effective U-Value"}</strong>
                <span>
                  The construction is the Passive House average of the Parallel-Path and
                  Isothermal-Planes methods. Surface film resistances <strong>are included</strong>{" "}
                  in the value shown.
                </span>
                {thermal ? (
                  <>
                    <span data-testid="assembly-thermal-films">
                      {`${STANDARD_LABEL[thermal.thermal_standard]} films, ${
                        thermal.heat_flow_direction
                      } heat flow: Rsi ${formatRValueFromM2KPerW(thermal.rsi_m2k_w, {
                        unitSystem,
                        fractionDigits: 2,
                      })}, Rse ${formatRValueFromM2KPerW(thermal.rse_m2k_w, {
                        unitSystem,
                        fractionDigits: 2,
                      })}`}
                    </span>
                    {constructionOnlyLabel ? (
                      <span data-testid="assembly-thermal-construction-only">
                        {`Construction only, without films: ${constructionOnlyLabel}`}
                      </span>
                    ) : null}
                  </>
                ) : null}
                <em>Reference: ISO 6946; ASHRAE Handbook - Fundamentals, Chapter 25</em>
              </InfoTooltip>
            </dt>
            <dd data-testid="assembly-thermal-label">{thermalLabel}</dd>
          </div>
        </dl>
      </div>
    </header>
  );
}

// `heat_flow_direction` needs no label map — its wire values ("upward" /
// "horizontal" / "downward") are already the display words.
const STANDARD_LABEL: Record<ThermalStandard, string> = {
  iso_6946: "ISO 6946",
  ashrae: "ASHRAE",
};

/** IP reports an R-value, SI a U-value — the metric changes kind by unit system. */
function formatThermalValue(
  rValueM2KW: number | null,
  uValueWm2K: number | null,
  unitSystem: "IP" | "SI",
): string | null {
  if (rValueM2KW === null || uValueWm2K === null) return null;
  return unitSystem === "IP"
    ? formatRValueFromM2KPerW(rValueM2KW, { unitSystem, fractionDigits: 1 })
    : formatUValueFromWm2K(uValueWm2K, { unitSystem, fractionDigits: 3 });
}

function formatThermalLabel(
  thermal: AssemblyThermalResponse | null,
  loading: boolean,
  unitSystem: "IP" | "SI",
): string {
  if (loading) return "Calculating";
  if (!thermal) return "Unavailable";
  const value = formatThermalValue(
    thermal.r_effective_m2k_w,
    thermal.u_effective_w_m2k,
    unitSystem,
  );
  return value ?? statusLabel(thermal.status.flags);
}

function formatConstructionOnlyLabel(
  thermal: AssemblyThermalResponse | null,
  unitSystem: "IP" | "SI",
): string | null {
  if (!thermal) return null;
  return formatThermalValue(thermal.r_construction_m2k_w, thermal.u_construction_w_m2k, unitSystem);
}
