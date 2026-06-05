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
} from "../types";
import type { AssemblyCanvasPaintController } from "../canvas-paint";

export function AssemblyWorkspace({
  projectId,
  assemblies,
  activeAssembly,
  materials,
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
  onDeleteLayer,
  onUpdateLayerThickness,
  onAddLayer,
  onEditSegment,
  onAddSegment,
}: {
  projectId: string;
  assemblies: Assembly[];
  activeAssembly: Assembly;
  materials: ProjectMaterial[];
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
  onRename: (assembly: Assembly) => void;
  onTypeChange: (assembly: Assembly) => void;
  onDuplicate: (assembly: Assembly) => void;
  onDelete: (assembly: Assembly) => void;
  onFlipOrientation: () => void;
  onFlipLayers: () => void;
  onFlipSegments: () => void;
  onDeleteLayer: (layer: AssemblyLayer) => void;
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
      id="assembly-builder-workbench"
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
        actionDisabled={!canEdit || commandBusy}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
        onAddAssembly={onAddAssembly}
        exportBusy={exportBusy}
        onExportHbjson={onExportHbjson}
        onRename={onRename}
        onTypeChange={onTypeChange}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
      <div id="assembly-builder-workspace" className="assembly-workspace">
        <div
          id="assembly-builder-interaction-region"
          ref={interactionRef}
          className="assembly-interaction-region"
        >
          <AssemblyHeader
            projectId={projectId}
            assemblies={assemblies}
            activeAssembly={activeAssembly}
            search={search}
            thermal={thermal}
            thermalLoading={thermalLoading}
          />
          {children}
          <AssemblyCanvas
            assembly={activeAssembly}
            materials={materials}
            zoom={zoom}
            canEdit={canEdit}
            paint={paint}
            commandBusy={commandBusy}
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
            onFlipOrientation={onFlipOrientation}
            onFlipLayers={onFlipLayers}
            onFlipSegments={onFlipSegments}
            onDeleteLayer={onDeleteLayer}
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
