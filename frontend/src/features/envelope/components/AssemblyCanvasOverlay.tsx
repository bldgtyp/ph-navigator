import { type KeyboardEvent, type MouseEvent, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { formatLengthFromMm, parseLengthToMm, type UnitSystem } from "../../../lib/units";
import {
  ASSEMBLY_CANVAS_ORIGIN_X_PX,
  DIMENSION_COLUMN_WIDTH_PX,
  pxFromMm,
} from "../canvas-constants";
import {
  segmentCanvasKey,
  type AssemblyCanvasPaintController,
  type AssemblyCanvasPaintMode,
} from "../canvas-paint";
import type {
  AssemblyCanvasGeometry,
  AssemblyCanvasLayerGeometry,
  AssemblyCanvasSegmentGeometry,
} from "../canvas-geometry";
import type { AssemblyLayer, AssemblySegment, ProjectMaterial } from "../types";

export type AssemblyCanvasOverlayActions = {
  onDeleteLayer: (layer: AssemblyLayer) => void;
  onUpdateLayerThickness: (layer: AssemblyLayer, thicknessMm: number) => void;
  onAddLayer: (layer: AssemblyLayer, position: "above" | "below") => void;
  onEditSegment: (layer: AssemblyLayer, segment: AssemblySegment) => void;
  onAddSegment: (
    layer: AssemblyLayer,
    segment: AssemblySegment,
    position: "left" | "right",
  ) => void;
};

export function AssemblyCanvasOverlay({
  geometry,
  materialsById,
  unitSystem,
  zoom,
  canEdit,
  paint,
  actions,
}: {
  geometry: AssemblyCanvasGeometry;
  materialsById: ReadonlyMap<string, ProjectMaterial>;
  unitSystem: UnitSystem;
  zoom: number;
  canEdit: boolean;
  paint: AssemblyCanvasPaintController;
  actions: AssemblyCanvasOverlayActions;
}) {
  return (
    <div
      id="assembly-canvas-overlay"
      className="assembly-canvas-overlay"
      data-mode={paint.mode}
      aria-hidden={!canEdit}
    >
      {canEdit
        ? geometry.layers.map((layerGeometry) => (
            <LayerDimensionControls
              key={layerGeometry.layer.id}
              layerGeometry={layerGeometry}
              unitSystem={unitSystem}
              zoom={zoom}
              actions={actions}
            />
          ))
        : null}
      {geometry.segments.map((segmentGeometry) => (
        <SegmentOverlay
          key={`${segmentGeometry.layer.id}-${segmentGeometry.segment.id}`}
          segmentGeometry={segmentGeometry}
          materialsById={materialsById}
          unitSystem={unitSystem}
          zoom={zoom}
          canEdit={canEdit}
          paint={paint}
          actions={actions}
        />
      ))}
    </div>
  );
}

function LayerDimensionControls({
  layerGeometry,
  unitSystem,
  zoom,
  actions,
}: {
  layerGeometry: AssemblyCanvasLayerGeometry;
  unitSystem: UnitSystem;
  zoom: number;
  actions: AssemblyCanvasOverlayActions;
}) {
  const { layer } = layerGeometry;
  const layerNumber = layer.order + 1;
  const heightPx = pxFromMm(layerGeometry.heightMm, zoom);
  return (
    <div
      id={`assembly-layer-dimension-${layer.id}`}
      className="assembly-layer-dimension dimension-chrome-cell dimension-chrome-cell--vertical"
      style={{
        top: `${pxFromMm(layerGeometry.yMm, zoom)}px`,
        width: `${DIMENSION_COLUMN_WIDTH_PX}px`,
        height: `${heightPx}px`,
      }}
      aria-label={`Layer ${layerNumber} thickness controls`}
    >
      <span
        className="dimension-tick dimension-chrome-tick dimension-chrome-tick--vertical dimension-tick-top"
        aria-hidden="true"
      />
      <span
        className="dimension-tick dimension-chrome-tick dimension-chrome-tick--vertical dimension-tick-bottom"
        aria-hidden="true"
      />
      <LayerThicknessEditor
        layer={layer}
        layerNumber={layerNumber}
        unitSystem={unitSystem}
        onDelete={() => actions.onDeleteLayer(layer)}
        onSubmit={(thicknessMm) => actions.onUpdateLayerThickness(layer, thicknessMm)}
      />
      <CanvasAddButton
        id={`assembly-layer-add-above-${layer.id}`}
        label={`Add layer above layer ${layerNumber}`}
        className="layer-add-button add-above"
        onClick={() => actions.onAddLayer(layer, "above")}
      />
      <CanvasAddButton
        id={`assembly-layer-add-below-${layer.id}`}
        label={`Add layer below layer ${layerNumber}`}
        className="layer-add-button add-below"
        onClick={() => actions.onAddLayer(layer, "below")}
      />
    </div>
  );
}

function LayerThicknessEditor({
  layer,
  layerNumber,
  unitSystem,
  onDelete,
  onSubmit,
}: {
  layer: AssemblyLayer;
  layerNumber: number;
  unitSystem: UnitSystem;
  onDelete: () => void;
  onSubmit: (thicknessMm: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editorUnitSystem, setEditorUnitSystem] = useState<UnitSystem>(unitSystem);
  const [draft, setDraft] = useState(() => formatLayerThickness(layer.thickness_mm, unitSystem));
  const [error, setError] = useState<string | null>(null);
  const committedRef = useRef(false);

  function startEditing(): void {
    setEditorUnitSystem(unitSystem);
    setDraft(formatLayerThickness(layer.thickness_mm, unitSystem));
    setError(null);
    committedRef.current = false;
    setIsEditing(true);
  }

  function cancelEditing(): void {
    setDraft(formatLayerThickness(layer.thickness_mm, editorUnitSystem));
    setError(null);
    setIsEditing(false);
  }

  function commit(): void {
    const parsed = parseLengthToMm(draft, { unitSystem: editorUnitSystem });
    if (committedRef.current) return;
    if (!parsed.ok || parsed.valueSi <= 0) {
      setError(parsed.ok ? "Thickness must be greater than zero." : parsed.message);
      return;
    }
    if (Math.abs(parsed.valueSi - layer.thickness_mm) < 0.001) {
      setError(null);
      committedRef.current = true;
      setIsEditing(false);
      return;
    }
    setError(null);
    committedRef.current = true;
    setIsEditing(false);
    onSubmit(parsed.valueSi);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
    }
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
  }

  if (isEditing) {
    return (
      <label className="dimension-input-wrap">
        <span className="sr-only">Layer {layerNumber} thickness</span>
        <input
          autoFocus
          aria-invalid={error ? "true" : "false"}
          aria-label={`Layer ${layerNumber} thickness`}
          className="dimension-input"
          value={draft}
          onBlur={commit}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
            setError(null);
          }}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={onKeyDown}
        />
        <button
          id={`assembly-layer-${layer.id}-delete`}
          type="button"
          className="dimension-chrome-delete-button"
          aria-label={`Delete layer ${layerNumber}`}
          title="Delete layer"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onDelete}
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
        {error ? (
          <span className="dimension-error" role="alert">
            {error}
          </span>
        ) : null}
      </label>
    );
  }

  return (
    <button
      id={`assembly-layer-${layer.id}-thickness-editor`}
      type="button"
      className="dimension-label-button dimension-chrome-label-button"
      aria-label={`Edit layer ${layerNumber} thickness`}
      onClick={startEditing}
    >
      {formatLayerThickness(layer.thickness_mm, unitSystem)}
    </button>
  );
}

function SegmentOverlay({
  segmentGeometry,
  materialsById,
  unitSystem,
  zoom,
  canEdit,
  paint,
  actions,
}: {
  segmentGeometry: AssemblyCanvasSegmentGeometry;
  materialsById: ReadonlyMap<string, ProjectMaterial>;
  unitSystem: UnitSystem;
  zoom: number;
  canEdit: boolean;
  paint: AssemblyCanvasPaintController;
  actions: AssemblyCanvasOverlayActions;
}) {
  const { layer, layerIndex, segment } = segmentGeometry;
  const material = segment.project_material_id
    ? (materialsById.get(segment.project_material_id) ?? null)
    : null;
  const materialName = material?.name ?? "No material";
  const segmentWidthLabel = formatLengthFromMm(segment.width_mm, { unitSystem });
  const studSpacingLabel = segment.steel_stud_spacing_mm
    ? formatLengthFromMm(segment.steel_stud_spacing_mm, { unitSystem })
    : null;
  const segmentLabel = `${materialName} segment in layer ${layerIndex + 1}`;
  const currentSegmentKey = segmentCanvasKey(layer.id, segment.id);
  const isPickedSource = paint.pickedSourceKey === currentSegmentKey;
  const isPulseTarget = paint.pastePulseKey === currentSegmentKey;
  const showAddControls = canEdit && paint.mode !== "picking" && paint.mode !== "pasting";
  const ariaLabel = canEdit ? segmentActionLabel(segmentLabel, paint.mode) : undefined;

  return (
    <div
      id={`assembly-segment-overlay-${layer.id}-${segment.id}`}
      className={material ? "assembly-segment-overlay" : "assembly-segment-overlay null-material"}
      data-mode={paint.mode}
      data-picked-source={isPickedSource ? "true" : undefined}
      data-paste-pulse={isPulseTarget ? "true" : undefined}
      style={{
        left: `${ASSEMBLY_CANVAS_ORIGIN_X_PX + pxFromMm(segmentGeometry.xMm, zoom)}px`,
        top: `${pxFromMm(segmentGeometry.yMm, zoom)}px`,
        width: `${pxFromMm(segmentGeometry.widthMm, zoom)}px`,
        height: `${pxFromMm(segmentGeometry.heightMm, zoom)}px`,
      }}
      title={`${materialName} - ${segmentWidthLabel}`}
    >
      <button
        id={`assembly-segment-hit-target-${layer.id}-${segment.id}`}
        type="button"
        className="assembly-segment-hit-target"
        disabled={!canEdit}
        aria-label={ariaLabel}
        onClick={() => {
          handleSegmentAction({ canEdit, paint, actions, layer, segment });
        }}
      >
        <span className="sr-only">
          {materialName}, {segmentWidthLabel}
          {studSpacingLabel ? `, studs ${studSpacingLabel}` : ""}
        </span>
      </button>
      {showAddControls ? (
        <SegmentAddControls
          layerId={layer.id}
          segmentId={segment.id}
          segmentLabel={segmentLabel}
          onAddLeft={(event) => {
            event.stopPropagation();
            actions.onAddSegment(layer, segment, "left");
          }}
          onAddRight={(event) => {
            event.stopPropagation();
            actions.onAddSegment(layer, segment, "right");
          }}
        />
      ) : null}
    </div>
  );
}

function segmentActionLabel(segmentLabel: string, mode: AssemblyCanvasPaintMode): string {
  if (mode === "picking") return `Pick assignment from ${segmentLabel}`;
  if (mode === "pasting") return `Paint assignment to ${segmentLabel}`;
  return `Edit ${segmentLabel}`;
}

function handleSegmentAction({
  canEdit,
  paint,
  actions,
  layer,
  segment,
}: {
  canEdit: boolean;
  paint: AssemblyCanvasPaintController;
  actions: AssemblyCanvasOverlayActions;
  layer: AssemblyLayer;
  segment: AssemblySegment;
}): void {
  if (!canEdit) return;
  if (paint.mode === "picking") {
    paint.pickSegment(layer, segment);
    return;
  }
  if (paint.mode === "pasting") {
    paint.paintSegment(layer, segment);
    return;
  }
  actions.onEditSegment(layer, segment);
}

function SegmentAddControls({
  layerId,
  segmentId,
  segmentLabel,
  onAddLeft,
  onAddRight,
}: {
  layerId: string;
  segmentId: string;
  segmentLabel: string;
  onAddLeft: (event: MouseEvent<HTMLButtonElement>) => void;
  onAddRight: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div
      id={`assembly-segment-add-controls-${layerId}-${segmentId}`}
      className="segment-add-controls"
    >
      <CanvasAddButton
        id={`assembly-segment-add-before-${layerId}-${segmentId}`}
        label={`Add segment before ${segmentLabel}`}
        tooltip="Add segment before"
        tooltipPlacement="start"
        className="segment-add-button add-left"
        onClick={onAddLeft}
      />
      <CanvasAddButton
        id={`assembly-segment-add-after-${layerId}-${segmentId}`}
        label={`Add segment after ${segmentLabel}`}
        tooltip="Add segment after"
        tooltipPlacement="end"
        className="segment-add-button add-right"
        onClick={onAddRight}
      />
    </div>
  );
}

function CanvasAddButton({
  id,
  label,
  tooltip,
  tooltipPlacement,
  className,
  onClick,
}: {
  id?: string;
  label: string;
  tooltip?: string;
  tooltipPlacement?: "start" | "end";
  className?: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const buttonClassName = className ? `canvas-add-button ${className}` : "canvas-add-button";
  return (
    <button
      id={id}
      type="button"
      className={buttonClassName}
      aria-label={label}
      data-toolbar-tooltip={tooltip || undefined}
      data-toolbar-tooltip-placement={tooltipPlacement}
      onClick={onClick}
    >
      <Plus size={15} aria-hidden="true" />
    </button>
  );
}

function formatLayerThickness(valueMm: number, unitSystem: UnitSystem): string {
  return formatLengthFromMm(valueMm, {
    unitSystem,
    showUnit: false,
    fractionDigits: unitSystem === "IP" ? 3 : 1,
  });
}
