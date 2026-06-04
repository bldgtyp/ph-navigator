import { type ReactNode, useMemo, useRef, useState } from "react";
import { useOutsidePointerDown } from "../../../shared/ui/useOutsidePointerDown";
import { AssemblyCanvas } from "./AssemblyCanvas";
import { AssemblyHeader } from "./AssemblyHeader";
import { EnvelopeSidebar } from "./EnvelopeSidebar";
import { MaterialLegend } from "./MaterialLegend";
import type {
  Assembly,
  AssemblyLayer,
  AssemblySegment,
  AssemblyThermalResponse,
  ProjectMaterial,
  ProjectMaterialDriftItem,
} from "../types";
import type { AssemblyCanvasPaintController } from "../canvas-paint";

export function AssemblyWorkspace({
  projectId,
  assemblies,
  activeAssembly,
  materials,
  driftByMaterialId,
  search,
  zoom,
  canEdit,
  thermal,
  thermalLoading,
  exportBusy,
  commandBusy,
  paint,
  children,
  onAddAssembly,
  onZoomIn,
  onZoomOut,
  onExportHbjson,
  onRename,
  onTypeChange,
  onDuplicate,
  onDelete,
  onFlipOrientation,
  onFlipLayers,
  onFlipSegments,
  onEditLayer,
  onUpdateLayerThickness,
  onAddLayer,
  onEditSegment,
  onAddSegment,
}: {
  projectId: string;
  assemblies: Assembly[];
  activeAssembly: Assembly;
  materials: ProjectMaterial[];
  driftByMaterialId: ReadonlyMap<string, ProjectMaterialDriftItem>;
  search: URLSearchParams;
  zoom: number;
  canEdit: boolean;
  thermal: AssemblyThermalResponse | null;
  thermalLoading: boolean;
  exportBusy: boolean;
  commandBusy: boolean;
  paint: AssemblyCanvasPaintController;
  children?: ReactNode;
  onAddAssembly: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onExportHbjson: () => void;
  onRename: () => void;
  onTypeChange: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onFlipOrientation: () => void;
  onFlipLayers: () => void;
  onFlipSegments: () => void;
  onEditLayer: (layer: AssemblyLayer) => void;
  onUpdateLayerThickness: (layer: AssemblyLayer, thicknessMm: number) => void;
  onAddLayer: (layer: AssemblyLayer, position: "above" | "below") => void;
  onEditSegment: (layer: AssemblyLayer, segment: AssemblySegment) => void;
  onAddSegment: (
    layer: AssemblyLayer,
    segment: AssemblySegment,
    position: "left" | "right",
  ) => void;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const interactionRef = useRef<HTMLDivElement>(null);
  const legendMaterials = useMemo(
    () => activeAssemblyMaterials(activeAssembly, materials),
    [activeAssembly, materials],
  );
  useOutsidePointerDown(
    interactionRef,
    paint.mode === "picking" || paint.mode === "pasting",
    paint.clear,
  );

  return (
    <div
      className={
        sidebarCollapsed ? "envelope-workbench is-sidebar-collapsed" : "envelope-workbench"
      }
    >
      <EnvelopeSidebar
        projectId={projectId}
        assemblies={assemblies}
        activeId={activeAssembly.id}
        search={search}
        canEdit={canEdit}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
        onAddAssembly={onAddAssembly}
      />
      <div className="assembly-workspace">
        <div ref={interactionRef} className="assembly-interaction-region">
          <AssemblyHeader
            projectId={projectId}
            assemblies={assemblies}
            activeAssembly={activeAssembly}
            search={search}
            zoom={zoom}
            canEdit={canEdit}
            thermal={thermal}
            thermalLoading={thermalLoading}
            exportBusy={exportBusy}
            commandBusy={commandBusy}
            paint={paint}
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
            onExportHbjson={onExportHbjson}
            onRename={onRename}
            onTypeChange={onTypeChange}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onFlipOrientation={onFlipOrientation}
            onFlipLayers={onFlipLayers}
            onFlipSegments={onFlipSegments}
          />
          {children}
          <AssemblyCanvas
            assembly={activeAssembly}
            materials={materials}
            driftByMaterialId={driftByMaterialId}
            zoom={zoom}
            canEdit={canEdit}
            paint={paint}
            onEditLayer={onEditLayer}
            onUpdateLayerThickness={onUpdateLayerThickness}
            onAddLayer={onAddLayer}
            onEditSegment={onEditSegment}
            onAddSegment={onAddSegment}
          />
        </div>
        <MaterialLegend materials={legendMaterials} />
      </div>
    </div>
  );
}

function activeAssemblyMaterials(
  assembly: Assembly,
  materials: ProjectMaterial[],
): ProjectMaterial[] {
  const materialsById = new Map(materials.map((material) => [material.id, material]));
  const activeMaterials: ProjectMaterial[] = [];
  const seen = new Set<string>();

  for (const layer of assembly.layers) {
    for (const segment of layer.segments) {
      const materialId = segment.project_material_id;
      if (!materialId || seen.has(materialId)) continue;
      const material = materialsById.get(materialId);
      if (!material) continue;
      seen.add(materialId);
      activeMaterials.push(material);
    }
  }

  return activeMaterials;
}
