import { useState } from "react";
import type { CatalogMaterial } from "../../../catalogs/types";
import type { ProjectMaterial } from "../../types";

type PickerMode = "project" | "catalog" | "custom";

export function SegmentMaterialPicker({
  selectedProjectMaterialId,
  materials,
  catalogMaterials,
  catalogMaterialsLoading,
  busy,
  onPickProjectMaterial,
  onPickCatalogMaterial,
  onOpenCatalogPicker,
  onHandEnterMaterial,
  onDetachSegmentMaterial,
}: {
  selectedProjectMaterialId: string | null;
  materials: ProjectMaterial[];
  catalogMaterials: CatalogMaterial[];
  catalogMaterialsLoading: boolean;
  busy: boolean;
  onPickProjectMaterial: (projectMaterialId: string | null) => void;
  onPickCatalogMaterial: (catalogMaterialId: string) => void;
  onOpenCatalogPicker: () => void;
  onHandEnterMaterial: (name: string) => void;
  onDetachSegmentMaterial: () => void;
}) {
  const [mode, setMode] = useState<PickerMode>("project");
  const [newMaterialName, setNewMaterialName] = useState("");
  function switchMode(nextMode: PickerMode): void {
    if (nextMode === mode) return;
    setMode(nextMode);
    if (nextMode === "catalog") onOpenCatalogPicker();
  }

  return (
    <fieldset className="material-picker">
      <legend>Material</legend>
      <div className="material-picker-tabs" role="tablist" aria-label="Material source">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "project"}
          className={mode === "project" ? "active" : undefined}
          onClick={() => switchMode("project")}
        >
          In this project
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "catalog"}
          className={mode === "catalog" ? "active" : undefined}
          onClick={() => switchMode("catalog")}
        >
          From catalog
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "custom"}
          className={mode === "custom" ? "active" : undefined}
          onClick={() => switchMode("custom")}
        >
          Hand-enter
        </button>
      </div>
      {mode === "project" ? (
        <div className="material-picker-panel" role="tabpanel">
          <label>
            Project material
            <select
              value={selectedProjectMaterialId ?? ""}
              disabled={busy}
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
        </div>
      ) : null}
      {mode === "catalog" ? (
        <div className="material-picker-panel" role="tabpanel">
          <label>
            Catalog material
            <select
              value=""
              disabled={busy || catalogMaterialsLoading}
              onChange={(event) => {
                const catalogMaterialId = event.currentTarget.value;
                if (catalogMaterialId) onPickCatalogMaterial(catalogMaterialId);
              }}
            >
              <option value="">
                {catalogMaterialsLoading
                  ? "Loading catalog materials..."
                  : "Choose catalog material"}
              </option>
              {catalogMaterials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.category} / {material.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      {mode === "custom" ? (
        <div className="material-picker-panel inline-form-row" role="tabpanel">
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
            Add material
          </button>
        </div>
      ) : null}
      {selectedProjectMaterialId ? (
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={onDetachSegmentMaterial}
        >
          Detach to custom material
        </button>
      ) : null}
    </fieldset>
  );
}
