import {
  formatConductivityFromWmK,
  formatDensityFromKgM3,
  formatRPerInFromConductivityWmK,
  formatSpecificHeatFromJKgK,
  useUnitPreference,
} from "../../../lib/units";
import type { ProjectMaterial } from "../types";
import { materialColor } from "../lib";

function formatEmissivity(value: number | null): string {
  return value === null ? "-" : value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export function MaterialLegend({ materials }: { materials: ProjectMaterial[] }) {
  const { unitSystem } = useUnitPreference();
  if (materials.length === 0) return null;
  const valueHeader = unitSystem === "IP" ? "Resistivity [R/inch]" : "Conductivity [W/(m-K)]";
  const densityHeader = unitSystem === "IP" ? "Density [lb/ft3]" : "Density [kg/m3]";
  const specificHeatHeader =
    unitSystem === "IP" ? "Specific heat [Btu/(lb-F)]" : "Specific heat [J/(kg-K)]";
  return (
    <aside className="material-legend" aria-label="Material legend">
      <table className="material-legend-table">
        <thead>
          <tr>
            <th scope="col">Color</th>
            <th scope="col">Material</th>
            <th scope="col">{valueHeader}</th>
            <th scope="col">{densityHeader}</th>
            <th scope="col">{specificHeatHeader}</th>
            <th scope="col">Emissivity</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((material) => {
            const valueMissing = material.conductivity_w_mk === null;
            const valueLabel =
              unitSystem === "IP"
                ? formatRPerInFromConductivityWmK(material.conductivity_w_mk, {
                    unitSystem,
                    empty: "-",
                    fractionDigits: 3,
                    showUnit: false,
                  })
                : formatConductivityFromWmK(material.conductivity_w_mk, {
                    unitSystem,
                    empty: "-",
                    fractionDigits: 3,
                    showUnit: false,
                  });
            const densityLabel = formatDensityFromKgM3(material.density_kg_m3, {
              unitSystem,
              empty: "-",
              fractionDigits: 1,
              showUnit: false,
            });
            const specificHeatLabel = formatSpecificHeatFromJKgK(material.specific_heat_j_kgk, {
              unitSystem,
              empty: "-",
              fractionDigits: unitSystem === "IP" ? 3 : 0,
              showUnit: false,
            });
            const emissivityLabel = formatEmissivity(material.emissivity);
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
                <td className={material.density_kg_m3 === null ? "is-missing" : undefined}>
                  {densityLabel}
                </td>
                <td className={material.specific_heat_j_kgk === null ? "is-missing" : undefined}>
                  {specificHeatLabel}
                </td>
                <td className={material.emissivity === null ? "is-missing" : undefined}>
                  {emissivityLabel}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </aside>
  );
}
