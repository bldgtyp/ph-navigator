import { useMemo } from "react";
import {
  ArrowLeftRight,
  ArrowUpDown,
  FlipVertical2,
  PaintBucket,
  Pipette,
  RotateCcw,
  type LucideIcon,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useUnitPreference } from "../../../lib/units";
import { AssemblyCanvasOverlay, type AssemblyCanvasOverlayActions } from "./AssemblyCanvasOverlay";
import { AssemblySvgCanvas } from "./AssemblySvgCanvas";
import { buildAssemblyCanvasGeometry } from "../canvas-geometry";
import { ASSEMBLY_CANVAS_ORIGIN_X_PX, MIN_CANVAS_WIDTH_PX, pxFromMm } from "../canvas-constants";
import type { AssemblyCanvasPaintController } from "../canvas-paint";
import { materialById } from "../lib";
import type { Assembly, AssemblyLayer, AssemblySegment, ProjectMaterial } from "../types";

export function AssemblyCanvas({
  assembly,
  materials,
  zoom,
  canEdit,
  paint,
  commandBusy,
  onZoomIn,
  onZoomOut,
  onFlipOrientation,
  onFlipLayers,
  onFlipSegments,
  onEditLayer,
  onUpdateLayerThickness,
  onAddLayer,
  onEditSegment,
  onAddSegment,
}: {
  assembly: Assembly;
  materials: ProjectMaterial[];
  zoom: number;
  canEdit: boolean;
  paint: AssemblyCanvasPaintController;
  commandBusy: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
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
    assembly.orientation === "first_layer_outside"
      ? ["Exterior", "Interior"]
      : ["Interior", "Exterior"];
  const assemblyCenterPx = ASSEMBLY_CANVAS_ORIGIN_X_PX + svgWidth / 2;

  return (
    <div className="assembly-canvas-scroll" data-testid="assembly-canvas-scroll">
      <div
        className="assembly-canvas"
        data-paint-mode={paint.mode}
        data-testid="assembly-canvas"
        style={{ width: `${canvasWidth}px` }}
      >
        <div
          className="assembly-canvas-stage"
          style={{ width: `${stageWidth}px`, height: `${canvasHeight}px` }}
        >
          <AssemblyCanvasToolbar
            canEdit={canEdit}
            commandBusy={commandBusy}
            paint={paint}
            zoom={zoom}
            leftPx={assemblyCenterPx}
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
            onFlipOrientation={onFlipOrientation}
            onFlipLayers={onFlipLayers}
            onFlipSegments={onFlipSegments}
          />
          <div
            className="assembly-orientation-labels"
            aria-hidden="true"
            style={{
              left: `${ASSEMBLY_CANVAS_ORIGIN_X_PX}px`,
              width: `${svgWidth}px`,
            }}
          >
            <span className="assembly-orientation-label is-top">{outsideLabel}</span>
            <span className="assembly-orientation-label is-bottom">{insideLabel}</span>
          </div>
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

function AssemblyCanvasToolbar({
  canEdit,
  commandBusy,
  paint,
  zoom,
  leftPx,
  onZoomIn,
  onZoomOut,
  onFlipOrientation,
  onFlipLayers,
  onFlipSegments,
}: {
  canEdit: boolean;
  commandBusy: boolean;
  paint: AssemblyCanvasPaintController;
  zoom: number;
  leftPx: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFlipOrientation: () => void;
  onFlipLayers: () => void;
  onFlipSegments: () => void;
}) {
  const commandDisabled = !canEdit || commandBusy;
  const flipDisabled = commandDisabled || paint.mode === "picking" || paint.mode === "pasting";

  return (
    <div
      className="assembly-canvas-toolbar"
      aria-label="Assembly canvas tools"
      style={{ left: `${leftPx}px` }}
    >
      <CanvasToolbarButton label="Zoom out" tooltip="Zoom out" icon={ZoomOut} onClick={onZoomOut} />
      <span className="sr-only" data-testid="canvas-zoom">
        {Math.round(zoom * 100)}%
      </span>
      <CanvasToolbarButton label="Zoom in" tooltip="Zoom in" icon={ZoomIn} onClick={onZoomIn} />
      <CanvasToolbarDivider />
      <CanvasToolbarButton
        label="Flip outside"
        tooltip="Flip exterior/interior"
        icon={ArrowUpDown}
        disabled={flipDisabled}
        onClick={onFlipOrientation}
      />
      <CanvasToolbarButton
        label="Flip layers"
        tooltip="Flip layer order"
        icon={FlipVertical2}
        disabled={flipDisabled}
        onClick={onFlipLayers}
      />
      <CanvasToolbarButton
        label="Flip segments"
        tooltip="Flip segments"
        icon={ArrowLeftRight}
        disabled={flipDisabled}
        onClick={onFlipSegments}
      />
      <CanvasToolbarDivider />
      <CanvasToolbarButton
        label="Pick segment assignment"
        tooltip="Copy segment material"
        icon={Pipette}
        disabled={!canEdit}
        pressed={paint.mode === "picking"}
        onClick={paint.mode === "picking" ? paint.clear : paint.startPicking}
      />
      <CanvasToolbarButton
        label="Paint picked assignment"
        tooltip="Paste segment material"
        icon={PaintBucket}
        disabled={!canEdit || !paint.canStartPasting}
        pressed={paint.mode === "pasting"}
        onClick={paint.mode === "pasting" ? paint.clear : paint.startPasting}
      />
      <CanvasToolbarButton
        label="Undo last paint"
        tooltip="Undo paste"
        icon={RotateCcw}
        disabled={commandDisabled || !paint.canUndoPaint}
        onClick={paint.undoLastPaint}
      />
    </div>
  );
}

function CanvasToolbarButton({
  label,
  tooltip,
  icon: Icon,
  disabled = false,
  pressed,
  onClick,
}: {
  label: string;
  tooltip: string;
  icon: LucideIcon;
  disabled?: boolean;
  pressed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="assembly-canvas-toolbar-button"
      aria-label={label}
      aria-pressed={pressed ?? undefined}
      data-toolbar-tooltip={tooltip}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon size={14} aria-hidden="true" />
    </button>
  );
}

function CanvasToolbarDivider() {
  return <span className="assembly-canvas-toolbar-divider" aria-hidden="true" />;
}
