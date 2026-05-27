import { useState } from "react";
import type { CatalogMaterial } from "../../../catalogs/types";
import type { ProjectMaterial } from "../../types";

export function SegmentMaterialPicker({
  selectedProjectMaterialId,
  materials,
  catalogMaterials,
  busy,
  onPickProjectMaterial,
  onPickCatalogMaterial,
  onHandEnterMaterial,
  onDetachSegmentMaterial,
}: {
  selectedProjectMaterialId: string | null;
  materials: ProjectMaterial[];
  catalogMaterials: CatalogMaterial[];
  busy: boolean;
  onPickProjectMaterial: (projectMaterialId: string | null) => void;
  onPickCatalogMaterial: (catalogMaterialId: string) => void;
  onHandEnterMaterial: (name: string) => void;
  onDetachSegmentMaterial: () => void;
}) {
  const [newMaterialName, setNewMaterialName] = useState("");
  return (
    <fieldset className="material-picker">
      <legend>Material</legend>
      <label>
        In this project
        <select
          value={selectedProjectMaterialId ?? ""}
          onChange={(event) => onPickProjectMaterial(event.currentTarget.value || null)}
        >
          <option value="">No material</option>
          {materials.map((material) => (
            <option key={material.id} value={material.id}>
              {material.name} ({material.use_sites.length} uses)
            </option>
          ))}
        </select>
      </label>
      <label>
        From catalog
        <select
          value=""
          onChange={(event) => {
            const catalogMaterialId = event.currentTarget.value;
            if (catalogMaterialId) onPickCatalogMaterial(catalogMaterialId);
          }}
        >
          <option value="">Choose catalog material</option>
          {catalogMaterials.map((material) => (
            <option key={material.id} value={material.id}>
              {material.category} / {material.name}
            </option>
          ))}
        </select>
      </label>
      <div className="inline-form-row">
        <input
          value={newMaterialName}
          onChange={(event) => setNewMaterialName(event.currentTarget.value)}
          placeholder="Hand-enter material"
        />
        <button
          type="button"
          className="secondary-button"
          disabled={!newMaterialName.trim() || busy}
          onClick={() => {
            onHandEnterMaterial(newMaterialName.trim());
            setNewMaterialName("");
          }}
        >
          Add
        </button>
      </div>
      {selectedProjectMaterialId ? (
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={onDetachSegmentMaterial}
        >
          Detach to custom material
        </button>
      ) : null}
    </fieldset>
  );
}
