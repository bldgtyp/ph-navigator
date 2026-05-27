import type { ProjectMaterial } from "../types";
import { materialColor } from "../lib";

export function MaterialLegend({ materials }: { materials: ProjectMaterial[] }) {
  if (materials.length === 0) return null;
  return (
    <aside className="material-legend" aria-label="Material legend">
      <h2>Legend</h2>
      <div>
        {materials.map((material) => (
          <span key={material.id} className="material-chip">
            <i style={{ background: materialColor(material) }} aria-hidden="true" />
            {material.name}
          </span>
        ))}
      </div>
    </aside>
  );
}
