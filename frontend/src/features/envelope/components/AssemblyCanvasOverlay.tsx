import type { MouseEvent } from "react";
import { formatLengthFromMm, type UnitSystem } from "../../../lib/units";
import { ASSEMBLY_CANVAS_ORIGIN_X_PX, pxFromMm } from "../canvas-constants";
import {
  segmentCanvasKey,
  type AssemblyCanvasPaintController,
  type AssemblyCanvasPaintMode,
} from "../canvas-paint";
import type { AssemblyCanvasGeometry, AssemblyCanvasSegmentGeometry } from "../canvas-geometry";
import type { AssemblyLayer, AssemblySegment, ProjectMaterial } from "../types";
import { AssemblyLayerDimensions } from "./AssemblyLayerDimensions";
import { CanvasAddButton } from "./CanvasAddButton";

export type AssemblyCanvasOverlayActions = {
  onDeleteLayer: (layer: AssemblyLayer) => void;
  onUpdateLayerThickness: (layer: AssemblyLayer, thicknessMm: number) => void;
  onAddLayer: (layer: AssemblyLayer, position: "above" | "below") => void;
  // A segment was activated (clicked / keyboard). The host decides what that
  // means from its own access state: the editing picker when it can edit, the
  // read-only detail (CP-5) for viewers and locked-version editors.
  onSegmentActivate: (layer: AssemblyLayer, segment: AssemblySegment) => void;
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
  topPx = 0,
  heightPx,
}: {
  geometry: AssemblyCanvasGeometry;
  materialsById: ReadonlyMap<string, ProjectMaterial>;
  unitSystem: UnitSystem;
  zoom: number;
  canEdit: boolean;
  paint: AssemblyCanvasPaintController;
  actions: AssemblyCanvasOverlayActions;
  topPx?: number;
  heightPx?: number;
}) {
  return (
    <div
      id="assembly-canvas-overlay"
      className="assembly-canvas-overlay"
      data-mode={paint.mode}
      style={{
        top: `${topPx}px`,
        height: heightPx === undefined ? undefined : `${heightPx}px`,
      }}
    >
      {canEdit
        ? geometry.layers.map((layerGeometry) => (
            <AssemblyLayerDimensions
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
  // Membranes are continuous, so they take exactly one segment — the backend
  // rejects `add_segment` on them. Do not offer an affordance that would 409.
  const showAddControls =
    canEdit && !segmentGeometry.isMembrane && paint.mode !== "picking" && paint.mode !== "pasting";
  // The hit target is always clickable: editors get the edit/paint action,
  // everyone else (viewers, locked-version editors) gets a read-only inspect
  // (CP-5), so the label reflects which.
  const ariaLabel = canEdit
    ? segmentActionLabel(segmentLabel, paint.mode)
    : `View details for ${segmentLabel}`;
  // The hit target is exactly the drawn band. A membrane's band is reserved
  // drawing space wide enough to click, so it never borrows from a neighbour.
  const topPx = pxFromMm(segmentGeometry.yMm, zoom);
  const heightPx = pxFromMm(segmentGeometry.heightMm, zoom);

  return (
    <div
      id={`assembly-segment-overlay-${layer.id}-${segment.id}`}
      className={["assembly-segment-overlay", material ? null : "null-material"]
        .filter(Boolean)
        .join(" ")}
      data-mode={paint.mode}
      data-picked-source={isPickedSource ? "true" : undefined}
      data-paste-pulse={isPulseTarget ? "true" : undefined}
      style={{
        left: `${ASSEMBLY_CANVAS_ORIGIN_X_PX + pxFromMm(segmentGeometry.xMm, zoom)}px`,
        top: `${topPx}px`,
        width: `${pxFromMm(segmentGeometry.widthMm, zoom)}px`,
        height: `${heightPx}px`,
      }}
      title={`${materialName} - ${segmentWidthLabel}`}
    >
      <button
        id={`assembly-segment-hit-target-${layer.id}-${segment.id}`}
        type="button"
        className="assembly-segment-hit-target"
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
  // No edit rights → activate straight away; the host opens the read-only
  // detail (CP-5). The paint machine is editor-only, so it is bypassed here.
  if (!canEdit) {
    actions.onSegmentActivate(layer, segment);
    return;
  }
  if (paint.mode === "picking") {
    paint.pickSegment(layer, segment);
    return;
  }
  if (paint.mode === "pasting") {
    paint.paintSegment(layer, segment);
    return;
  }
  actions.onSegmentActivate(layer, segment);
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
