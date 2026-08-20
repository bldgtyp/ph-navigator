import { useUnitPreference } from "../../../lib/units";
import type { ProjectMaterial } from "../types";
import { materialColor } from "../lib";
import {
  assemblyMaterialHeaders,
  formatAssemblyMaterialValues,
  type AssemblyMaterialHeader,
} from "../material-table-presentation";

export function MaterialLegend({ materials }: { materials: ProjectMaterial[] }) {
  const { unitSystem } = useUnitPreference();
  if (materials.length === 0) return null;
  const [
    colorHeader,
    materialHeader,
    valueHeader,
    densityHeader,
    specificHeatHeader,
    emissivityHeader,
  ] = assemblyMaterialHeaders(unitSystem);
  return (
    <aside className="material-legend" aria-label="Material legend">
      <table className="material-legend-table">
        <thead>
          <tr>
            <th scope="col">{colorHeader?.label}</th>
            <th scope="col">{materialHeader?.label}</th>
            <th scope="col" aria-label={materialLegendHeaderLabel(valueHeader)}>
              <MaterialLegendHeaderCell header={valueHeader} />
            </th>
            <th scope="col" aria-label={materialLegendHeaderLabel(densityHeader)}>
              <MaterialLegendHeaderCell header={densityHeader} />
            </th>
            <th scope="col" aria-label={materialLegendHeaderLabel(specificHeatHeader)}>
              <MaterialLegendHeaderCell header={specificHeatHeader} />
            </th>
            <th scope="col">{emissivityHeader?.label}</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((material) => {
            const valueMissing = material.conductivity_w_mk === null;
            const { valueLabel, densityLabel, specificHeatLabel, emissivityLabel } =
              formatAssemblyMaterialValues(material, unitSystem, "-");
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

function MaterialLegendHeaderCell({ header }: { header: AssemblyMaterialHeader }) {
  return (
    <span className="material-legend-heading">
      <span>{header.label}</span>
      {header.unit ? <span className="material-legend-unit">[{header.unit}]</span> : null}
    </span>
  );
}

function materialLegendHeaderLabel(header: AssemblyMaterialHeader): string {
  return header.unit ? `${header.label} [${header.unit}]` : header.label;
}
