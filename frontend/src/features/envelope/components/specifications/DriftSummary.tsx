import { MaterialDriftBadge } from "../MaterialDrift";
import { MATERIAL_DRIFT_STATE_LABELS, materialNeedsCatalogReview } from "../../drift";
import type { ProjectMaterial, ProjectMaterialDriftItem } from "../../types";

export function DriftSummary({
  materials,
  driftByMaterialId,
  canEdit,
  onRefreshMaterial,
}: {
  materials: ProjectMaterial[];
  driftByMaterialId: ReadonlyMap<string, ProjectMaterialDriftItem>;
  canEdit: boolean;
  onRefreshMaterial: (projectMaterialId: string) => void;
}) {
  const driftItems: { material: ProjectMaterial; item: ProjectMaterialDriftItem }[] = [];
  for (const material of materials) {
    const item = driftByMaterialId.get(material.id) ?? null;
    if (materialNeedsCatalogReview(item)) driftItems.push({ material, item });
  }
  if (driftItems.length === 0) return null;
  return (
    <section className="material-drift-summary" aria-label="Catalog drift review">
      <header>
        <h2>Catalog review</h2>
        <span>{driftItems.length} materials</span>
      </header>
      <ul>
        {driftItems.map(({ material, item }) => (
          <li key={material.id}>
            <span>
              {material.name} · {MATERIAL_DRIFT_STATE_LABELS[item.state]}
            </span>
            <MaterialDriftBadge item={item} />
            {canEdit ? (
              <button
                type="button"
                className="text-button"
                onClick={() => onRefreshMaterial(material.id)}
              >
                Review
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
