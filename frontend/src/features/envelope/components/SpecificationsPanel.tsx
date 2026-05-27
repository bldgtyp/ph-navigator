import { useMemo } from "react";
import {
  formatConductivityFromWmK,
  formatDensityFromKgM3,
  formatSpecificHeatFromJKgK,
  useUnitPreference,
} from "../../../lib/units";
import { sortProjectMaterials, viewerVisibleMaterials } from "../lib";
import type { ProjectMaterial } from "../types";

export function SpecificationsPanel({
  materials,
  isViewer,
}: {
  materials: ProjectMaterial[];
  isViewer: boolean;
}) {
  const { unitSystem } = useUnitPreference();
  const visibleMaterials = useMemo(() => {
    const filtered = isViewer ? viewerVisibleMaterials(materials) : materials;
    return sortProjectMaterials(filtered);
  }, [isViewer, materials]);

  if (visibleMaterials.length === 0) {
    return (
      <div className="envelope-empty" role="status">
        <h2>No project materials</h2>
        <p>Project material specifications will appear here after assemblies reference them.</p>
      </div>
    );
  }

  return (
    <div className="specifications-grid">
      {visibleMaterials.map((material) => (
        <article key={material.id} className="spec-card">
          <header>
            <div>
              <h2>{material.name}</h2>
              <p>
                {material.category ?? "Uncategorized"} · {material.specification_status}
              </p>
            </div>
            <span>{material.use_sites.length} uses</span>
          </header>
          <dl className="spec-values">
            <div>
              <dt>Lambda</dt>
              <dd>{formatConductivityFromWmK(material.conductivity_w_mk, { unitSystem })}</dd>
            </div>
            <div>
              <dt>Density</dt>
              <dd>{formatDensityFromKgM3(material.density_kg_m3, { unitSystem })}</dd>
            </div>
            <div>
              <dt>Specific heat</dt>
              <dd>{formatSpecificHeatFromJKgK(material.specific_heat_j_kgk, { unitSystem })}</dd>
            </div>
          </dl>
          {material.notes ? <p className="spec-notes">{material.notes}</p> : null}
          <div className="use-sites">
            <h3>Use-sites</h3>
            {material.use_sites.length === 0 ? (
              <p>Not used by an assembly.</p>
            ) : (
              <ul>
                {material.use_sites.map((site) => (
                  <li key={`${site.assembly_id}:${site.layer_id}:${site.segment_id}`}>
                    <strong>{site.assembly_name}</strong>
                    <span>
                      Layer {site.layer_order + 1}, segment {site.segment_order + 1}
                    </span>
                    {site.use_site_notes ? <em>{site.use_site_notes}</em> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
