import {
  formatConductivityFromWmK,
  formatRPerInFromConductivityWmK,
  useUnitPreference,
} from "../../../lib/units";
import type { ProjectMaterial } from "../types";
import { materialColor } from "../lib";

export function MaterialLegend({ materials }: { materials: ProjectMaterial[] }) {
  const { unitSystem } = useUnitPreference();
  if (materials.length === 0) return null;
  const valueHeader = unitSystem === "IP" ? "Resistivity [R/inch]" : "Conductivity [W/(m-K)]";
  return (
    <aside className="material-legend" aria-label="Material legend">
      <table className="material-legend-table">
        <thead>
          <tr>
            <th scope="col">Color</th>
            <th scope="col">Material</th>
            <th scope="col">{valueHeader}</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((material) => {
            const valueMissing = material.conductivity_w_mk === null;
            const valueLabel =
              unitSystem === "IP"
                ? formatRPerInFromConductivityWmK(material.conductivity_w_mk, {
                    unitSystem,
                    empty: "Missing",
                    fractionDigits: 3,
                    showUnit: false,
                  })
                : formatConductivityFromWmK(material.conductivity_w_mk, {
                    unitSystem,
                    empty: "Missing",
                    fractionDigits: 3,
                    showUnit: false,
                  });
            return (
              <tr key={material.id}>
                <td>
                  <span
                    className="material-legend-swatch"
                    style={{ background: materialColor(material) }}
                    aria-hidden="true"
                  />
                </td>
                <td>{material.name}</td>
                <td className={valueMissing ? "is-missing" : undefined}>{valueLabel}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </aside>
  );
}
