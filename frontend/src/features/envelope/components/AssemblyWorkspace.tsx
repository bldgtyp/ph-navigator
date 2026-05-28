import { type ReactNode, useMemo, useState } from "react";
import { AssemblyCanvas, type CopiedAssignment } from "./AssemblyCanvas";
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
  copiedAssignment,
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
  onEditLayer,
  onAddLayer,
  onDeleteLayer,
  onEditSegment,
  onAddSegment,
  onDeleteSegment,
  onCopyAssignment,
  onPasteAssignment,
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
  copiedAssignment: CopiedAssignment | null;
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
  onEditLayer: (layer: AssemblyLayer) => void;
  onAddLayer: (layer: AssemblyLayer, position: "above" | "below") => void;
  onDeleteLayer: (layer: AssemblyLayer) => void;
  onEditSegment: (layer: AssemblyLayer, segment: AssemblySegment) => void;
  onAddSegment: (
    layer: AssemblyLayer,
    segment: AssemblySegment,
    position: "left" | "right",
  ) => void;
  onDeleteSegment: (layer: AssemblyLayer, segment: AssemblySegment) => void;
  onCopyAssignment: (assignment: CopiedAssignment) => void;
  onPasteAssignment: (layer: AssemblyLayer, segment: AssemblySegment) => void;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const legendMaterials = useMemo(
    () => activeAssemblyMaterials(activeAssembly, materials),
    [activeAssembly, materials],
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
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onExportHbjson={onExportHbjson}
          onRename={onRename}
          onTypeChange={onTypeChange}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onFlipOrientation={onFlipOrientation}
          onFlipLayers={onFlipLayers}
        />
        {children}
        <AssemblyCanvas
          assembly={activeAssembly}
          materials={materials}
          driftByMaterialId={driftByMaterialId}
          zoom={zoom}
          canEdit={canEdit}
          copiedAssignment={copiedAssignment}
          onEditLayer={onEditLayer}
          onAddLayer={onAddLayer}
          onDeleteLayer={onDeleteLayer}
          onEditSegment={onEditSegment}
          onAddSegment={onAddSegment}
          onDeleteSegment={onDeleteSegment}
          onCopyAssignment={onCopyAssignment}
          onPasteAssignment={onPasteAssignment}
        />
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
