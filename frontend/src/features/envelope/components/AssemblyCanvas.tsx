import { useLayoutEffect, useMemo, useRef } from "react";
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
import {
  ASSEMBLY_CANVAS_ORIGIN_X_PX,
  SVG_STROKE_PADDING_MM,
  fitZoomForCanvasWidth,
  pxFromMm,
} from "../canvas-constants";
import type { AssemblyCanvasPaintController } from "../canvas-paint";
import { materialById } from "../lib";
import type { Assembly, AssemblyLayer, AssemblySegment, ProjectMaterial } from "../types";

export function AssemblyCanvas({
  assembly,
  materials,
  zoom,
  autoFitOnMount,
  canEdit,
  paint,
  commandBusy,
  onZoomIn,
  onZoomOut,
  onFitZoom,
  onFlipOrientation,
  onFlipLayers,
  onFlipSegments,
  onDeleteLayer,
  onUpdateLayerThickness,
  onAddLayer,
  onSegmentActivate,
  onAddSegment,
}: {
  assembly: Assembly;
  materials: ProjectMaterial[];
  zoom: number;
  autoFitOnMount: boolean;
  canEdit: boolean;
  paint: AssemblyCanvasPaintController;
  commandBusy: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitZoom: (zoom: number) => void;
  onFlipOrientation: () => void;
  onFlipLayers: () => void;
  onFlipSegments: () => void;
  onDeleteLayer: (layer: AssemblyLayer) => void;
  onUpdateLayerThickness: (layer: AssemblyLayer, thicknessMm: number) => void;
  onAddLayer: (layer: AssemblyLayer, position: "above" | "below") => void;
  onSegmentActivate: (layer: AssemblyLayer, segment: AssemblySegment) => void;
  onAddSegment: (
    layer: AssemblyLayer,
    segment: AssemblySegment,
    position: "left" | "right",
  ) => void;
}) {
  const { unitSystem } = useUnitPreference();
  const materialsById = useMemo(() => materialById(materials), [materials]);
  const geometry = useMemo(() => buildAssemblyCanvasGeometry(assembly), [assembly]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const didInitialFitRef = useRef(!autoFitOnMount);
  const svgWidth = pxFromMm(geometry.widthMm, zoom);
  const svgHeight = pxFromMm(geometry.heightMm, zoom);
  const svgStrokePaddingPx = pxFromMm(SVG_STROKE_PADDING_MM, zoom);
  const stageWidth = ASSEMBLY_CANVAS_ORIGIN_X_PX + svgWidth;
  const canvasHeight = svgHeight + svgStrokePaddingPx;
  const actions: AssemblyCanvasOverlayActions = {
    onDeleteLayer,
    onUpdateLayerThickness,
    onAddLayer,
    onSegmentActivate,
    onAddSegment,
  };
  const [outsideLabel, insideLabel] =
    assembly.orientation === "first_layer_outside"
      ? ["Exterior", "Interior"]
      : ["Interior", "Exterior"];
  useLayoutEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    function fitActiveAssembly(): void {
      if (didInitialFitRef.current) return;
      const availableWidthPx = scrollRef.current?.clientWidth ?? 0;
      if (availableWidthPx <= 0) return;
      didInitialFitRef.current = true;
      onFitZoom(fitZoomForCanvasWidth(geometry.widthMm, availableWidthPx));
    }

    fitActiveAssembly();

    if (typeof ResizeObserver === "undefined") return;
    const resizeObserver = new ResizeObserver(fitActiveAssembly);
    resizeObserver.observe(scrollElement);
    return () => resizeObserver.disconnect();
  }, [geometry.widthMm, onFitZoom]);

  return (
    <div
      id="assembly-canvas-scroll"
      className="assembly-canvas-scroll"
      data-testid="assembly-canvas-scroll"
      ref={scrollRef}
    >
      <div
        id="assembly-canvas"
        className="assembly-canvas"
        data-paint-mode={paint.mode}
        data-testid="assembly-canvas"
      >
        <AssemblyCanvasToolbar
          canEdit={canEdit}
          commandBusy={commandBusy}
          paint={paint}
          zoom={zoom}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onFlipOrientation={onFlipOrientation}
          onFlipLayers={onFlipLayers}
          onFlipSegments={onFlipSegments}
        />
        <div
          id="assembly-canvas-stage"
          className="assembly-canvas-stage"
          data-testid="assembly-canvas-stage"
          style={{ width: `${stageWidth}px`, height: `${canvasHeight}px` }}
        >
          <div
            id="assembly-orientation-labels"
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
      id="assembly-canvas-toolbar"
      className="canvas-toolbar assembly-canvas-toolbar"
      aria-label="Assembly canvas tools"
    >
      <CanvasToolbarButton
        id="assembly-canvas-zoom-out"
        label="Zoom out"
        tooltip="Zoom out"
        icon={ZoomOut}
        onClick={onZoomOut}
      />
      <span className="sr-only" data-testid="canvas-zoom">
        {Math.round(zoom * 100)}%
      </span>
      <CanvasToolbarButton
        id="assembly-canvas-zoom-in"
        label="Zoom in"
        tooltip="Zoom in"
        icon={ZoomIn}
        onClick={onZoomIn}
      />
      <CanvasToolbarDivider />
      <CanvasToolbarButton
        id="assembly-canvas-flip-outside"
        label="Flip outside"
        tooltip="Flip exterior/interior"
        icon={ArrowUpDown}
        disabled={flipDisabled}
        onClick={onFlipOrientation}
      />
      <CanvasToolbarButton
        id="assembly-canvas-flip-layers"
        label="Flip layers"
        tooltip="Flip layer order"
        icon={FlipVertical2}
        disabled={flipDisabled}
        onClick={onFlipLayers}
      />
      <CanvasToolbarButton
        id="assembly-canvas-flip-segments"
        label="Flip segments"
        tooltip="Flip segments"
        icon={ArrowLeftRight}
        disabled={flipDisabled}
        onClick={onFlipSegments}
      />
      <CanvasToolbarDivider />
      <CanvasToolbarButton
        id="assembly-canvas-pick-segment-assignment"
        label="Pick segment assignment"
        tooltip="Copy segment material"
        icon={Pipette}
        disabled={!canEdit}
        pressed={paint.mode === "picking"}
        onClick={paint.mode === "picking" ? paint.clear : paint.startPicking}
      />
      <CanvasToolbarButton
        id="assembly-canvas-paint-picked-assignment"
        label="Paint picked assignment"
        tooltip="Paste segment material"
        icon={PaintBucket}
        disabled={!canEdit || !paint.canStartPasting}
        pressed={paint.mode === "pasting"}
        onClick={paint.mode === "pasting" ? paint.clear : paint.startPasting}
      />
      <CanvasToolbarButton
        id="assembly-canvas-undo-last-paint"
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
  id,
  label,
  tooltip,
  icon: Icon,
  disabled = false,
  pressed,
  onClick,
}: {
  id?: string;
  label: string;
  tooltip: string;
  icon: LucideIcon;
  disabled?: boolean;
  pressed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      className="canvas-toolbar__button"
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
  return <span className="canvas-toolbar__divider" aria-hidden="true" />;
}
