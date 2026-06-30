import type { CSSProperties } from "react";
import {
  formatConductivityFromWmK,
  formatDensityFromKgM3,
  formatRPerInFromConductivityWmK,
  formatSpecificHeatFromJKgK,
  type UnitSystem,
} from "../../../../lib/units";
import { colorToCss } from "../../../../shared/lib/color";
import type { ProjectMaterial } from "../../types";

type MaterialFact = {
  label: string;
  value: string;
  missing?: boolean;
};

export function SegmentMaterialFacts({
  material,
  unitSystem,
}: {
  material: ProjectMaterial | null;
  unitSystem: UnitSystem;
}) {
  const color = colorToCss(material?.color, "transparent");
  const colorLabel = material?.color?.trim() || "Not set";
  const valueLabel = unitSystem === "IP" ? "Resistivity" : "Conductivity";
  const value = material
    ? unitSystem === "IP"
      ? formatRPerInFromConductivityWmK(material.conductivity_w_mk, {
          unitSystem,
          empty: "Not set",
          fractionDigits: 3,
        })
      : formatConductivityFromWmK(material.conductivity_w_mk, {
          unitSystem,
          empty: "Not set",
          fractionDigits: 3,
        })
    : "No material";
  const facts: MaterialFact[] = [
    { label: "Name", value: material?.name ?? "No material", missing: material === null },
    {
      label: valueLabel,
      value,
      missing: material?.conductivity_w_mk === null || material === null,
    },
    {
      label: "Density",
      value: material
        ? formatDensityFromKgM3(material.density_kg_m3, { unitSystem, empty: "Not set" })
        : "No material",
      missing: material?.density_kg_m3 === null || material === null,
    },
    {
      label: "Specific heat",
      value: material
        ? formatSpecificHeatFromJKgK(material.specific_heat_j_kgk, {
            unitSystem,
            empty: "Not set",
          })
        : "No material",
      missing: material?.specific_heat_j_kgk === null || material === null,
    },
    {
      label: "Emissivity",
      value:
        material?.emissivity === null || material === null
          ? "Not set"
          : material.emissivity.toLocaleString(undefined, { maximumFractionDigits: 3 }),
      missing: material?.emissivity === null || material === null,
    },
  ];

  return (
    <section
      className="segment-dialog-section segment-material-facts"
      aria-labelledby="envelope-segment-material-facts-heading"
    >
      <div className="segment-material-facts-header">
        <h3 id="envelope-segment-material-facts-heading" className="segment-dialog-section-heading">
          Material attributes
        </h3>
        <span
          className="segment-material-color"
          style={{ "--segment-material-color": color } as CSSProperties}
        >
          <span aria-hidden="true" />
          {colorLabel}
        </span>
      </div>
      <dl className="segment-material-facts-grid">
        {facts.map((fact) => (
          <div key={fact.label} className={fact.missing ? "is-missing" : undefined}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
