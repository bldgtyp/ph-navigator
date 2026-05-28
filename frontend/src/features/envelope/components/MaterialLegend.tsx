import { formatConductivityFromWmK, useUnitPreference } from "../../../lib/units";
import type { ProjectMaterial } from "../types";
import { materialColor } from "../lib";

export function MaterialLegend({ materials }: { materials: ProjectMaterial[] }) {
  const { unitSystem } = useUnitPreference();
  if (materials.length === 0) return null;
  return (
    <aside className="material-legend" aria-label="Material legend">
      <h2>Legend</h2>
      <div>
        {materials.map((material) => {
          const lambdaMissing = material.conductivity_w_mk === null;
          const lambdaClassName = lambdaMissing
            ? "material-chip-lambda is-missing"
            : "material-chip-lambda";
          const lambdaLabel = formatConductivityFromWmK(material.conductivity_w_mk, {
            unitSystem,
            empty: "Missing lambda",
          });
          return (
            <span key={material.id} className="material-chip">
              <i style={{ background: materialColor(material) }} aria-hidden="true" />
              <span className="material-chip-name">{material.name}</span>
              <span className={lambdaClassName}>{lambdaLabel}</span>
            </span>
          );
        })}
      </div>
    </aside>
  );
}
