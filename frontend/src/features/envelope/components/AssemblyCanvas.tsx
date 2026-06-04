import { useMemo } from "react";
import { useUnitPreference } from "../../../lib/units";
import { AssemblyCanvasOverlay, type AssemblyCanvasOverlayActions } from "./AssemblyCanvasOverlay";
import { AssemblySvgCanvas } from "./AssemblySvgCanvas";
import { buildAssemblyCanvasGeometry } from "../canvas-geometry";
import { ASSEMBLY_CANVAS_ORIGIN_X_PX, MIN_CANVAS_WIDTH_PX, pxFromMm } from "../canvas-constants";
import type { AssemblyCanvasPaintController } from "../canvas-paint";
import { materialById } from "../lib";
import type {
  Assembly,
  AssemblyLayer,
  AssemblySegment,
  ProjectMaterial,
  ProjectMaterialDriftItem,
} from "../types";

export function AssemblyCanvas({
  assembly,
  materials,
  driftByMaterialId,
  zoom,
  canEdit,
  paint,
  onEditLayer,
  onUpdateLayerThickness,
  onAddLayer,
  onEditSegment,
  onAddSegment,
}: {
  assembly: Assembly;
  materials: ProjectMaterial[];
  driftByMaterialId: ReadonlyMap<string, ProjectMaterialDriftItem>;
  zoom: number;
  canEdit: boolean;
  paint: AssemblyCanvasPaintController;
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
  const { unitSystem } = useUnitPreference();
  const materialsById = useMemo(() => materialById(materials), [materials]);
  const geometry = useMemo(() => buildAssemblyCanvasGeometry(assembly), [assembly]);
  const svgWidth = pxFromMm(geometry.widthMm, zoom);
  const svgHeight = pxFromMm(geometry.heightMm, zoom);
  const stageWidth = ASSEMBLY_CANVAS_ORIGIN_X_PX + svgWidth;
  const canvasWidth = Math.max(MIN_CANVAS_WIDTH_PX, stageWidth);
  const canvasHeight = svgHeight;
  const actions: AssemblyCanvasOverlayActions = {
    onEditLayer,
    onUpdateLayerThickness,
    onAddLayer,
    onEditSegment,
    onAddSegment,
  };
  const [outsideLabel, insideLabel] =
    assembly.orientation === "first_layer_outside" ? ["Outside", "Inside"] : ["Inside", "Outside"];

  return (
    <div className="assembly-canvas-scroll" data-testid="assembly-canvas-scroll">
      <div
        className="assembly-canvas"
        data-paint-mode={paint.mode}
        data-testid="assembly-canvas"
        style={{ width: `${canvasWidth}px` }}
      >
        <div className="assembly-orientation-labels" aria-hidden="true">
          <span>{outsideLabel}</span>
          <span>{insideLabel}</span>
        </div>
        <div
          className="assembly-canvas-stage"
          style={{ width: `${stageWidth}px`, height: `${canvasHeight}px` }}
        >
          <AssemblySvgCanvas
            assembly={assembly}
            materialsById={materialsById}
            geometry={geometry}
            widthPx={svgWidth}
            heightPx={svgHeight}
            paintMode={paint.mode}
            pickedSourceKey={paint.pickedSourceKey}
          />
          <AssemblyCanvasOverlay
            geometry={geometry}
            materialsById={materialsById}
            driftByMaterialId={driftByMaterialId}
            unitSystem={unitSystem}
            zoom={zoom}
            canEdit={canEdit}
            paint={paint}
            actions={actions}
          />
        </div>
      </div>
    </div>
  );
}
