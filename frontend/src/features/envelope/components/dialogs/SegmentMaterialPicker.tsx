import { useState } from "react";
import { AutocompleteSelect } from "../../../../shared/ui/AutocompleteSelect";
import type { CatalogMaterial } from "../../../catalogs/types";
import type { ProjectMaterial } from "../../types";

type PickerMode = "project" | "catalog";

export function SegmentMaterialPicker({
  id = "envelope-segment-material-picker",
  selectedProjectMaterialId,
  materials,
  catalogMaterials,
  catalogMaterialsLoading,
  busy,
  onPickProjectMaterial,
  onPickCatalogMaterial,
  onOpenCatalogPicker,
}: {
  id?: string;
  selectedProjectMaterialId: string | null;
  materials: ProjectMaterial[];
  catalogMaterials: CatalogMaterial[];
  catalogMaterialsLoading: boolean;
  busy: boolean;
  onPickProjectMaterial: (projectMaterialId: string | null) => void;
  onPickCatalogMaterial: (catalogMaterialId: string) => void;
  onOpenCatalogPicker: () => void;
}) {
  const [mode, setMode] = useState<PickerMode>("project");
  function switchMode(nextMode: PickerMode): void {
    if (nextMode === mode) return;
    setMode(nextMode);
    if (nextMode === "catalog") onOpenCatalogPicker();
  }

  return (
    <section
      id={id}
      className="segment-dialog-section material-picker"
      role="group"
      aria-labelledby={`${id}-heading`}
    >
      <h3 id={`${id}-heading`} className="segment-dialog-section-heading">
        Material
      </h3>
      <div
        id={`${id}-tabs`}
        className="material-picker-tabs pill-tab-list"
        role="tablist"
        aria-label="Material source"
      >
        <button
          id={`${id}-project-tab`}
          type="button"
          role="tab"
          aria-selected={mode === "project"}
          className={`pill-tab${mode === "project" ? " active" : ""}`}
          onClick={() => switchMode("project")}
        >
          In this project
        </button>
        <button
          id={`${id}-catalog-tab`}
          type="button"
          role="tab"
          aria-selected={mode === "catalog"}
          className={`pill-tab${mode === "catalog" ? " active" : ""}`}
          onClick={() => switchMode("catalog")}
        >
          From catalog
        </button>
      </div>
      {mode === "project" ? (
        <div id={`${id}-project-panel`} className="material-picker-panel" role="tabpanel">
          <AutocompleteSelect
            id={`${id}-project-select`}
            aria-label="Project material"
            value={selectedProjectMaterialId ?? ""}
            disabled={busy}
            options={[
              { value: "", label: "No material" },
              ...materials.map((material) => ({
                value: material.id,
                label: material.name,
                description: `${material.use_sites.length} uses`,
              })),
            ]}
            onChange={(nextProjectMaterialId) =>
              onPickProjectMaterial(nextProjectMaterialId || null)
            }
          />
        </div>
      ) : null}
      {mode === "catalog" ? (
        <div id={`${id}-catalog-panel`} className="material-picker-panel" role="tabpanel">
          <AutocompleteSelect
            id={`${id}-catalog-select`}
            aria-label="Catalog material"
            value=""
            disabled={busy || catalogMaterialsLoading}
            placeholder={
              catalogMaterialsLoading ? "Loading catalog materials..." : "Choose catalog material"
            }
            options={catalogMaterials.map((material) => ({
              value: material.id,
              label: material.name,
              description: material.category,
            }))}
            onChange={(catalogMaterialId) => {
              if (catalogMaterialId) onPickCatalogMaterial(catalogMaterialId);
            }}
          />
        </div>
      ) : null}
    </section>
  );
}
