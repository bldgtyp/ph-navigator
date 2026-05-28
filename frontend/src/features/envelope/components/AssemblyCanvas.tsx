import {
  Copy,
  type LucideIcon,
  Minus,
  PanelTopClose,
  PanelTopOpen,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo } from "react";
import { formatLengthFromMm, useUnitPreference } from "../../../lib/units";
import { MaterialDriftBadge } from "./MaterialDrift";
import {
  BASE_PX_PER_MM,
  MIN_CANVAS_WIDTH_PX,
  MIN_LAYER_HEIGHT_PX,
  MIN_LAYER_WIDTH_PERCENT,
  MIN_SEGMENT_WIDTH_PX,
  pxFromMm,
} from "../canvas-constants";
import { layerWidthMm, materialById, materialColor, maxLayerWidthMm } from "../lib";
import type {
  Assembly,
  AssemblyLayer,
  AssemblySegment,
  ProjectMaterial,
  ProjectMaterialDriftItem,
} from "../types";

export type CopiedAssignment = Pick<
  AssemblySegment,
  "project_material_id" | "is_continuous_insulation" | "steel_stud_spacing_mm"
>;

export function AssemblyCanvas({
  assembly,
  materials,
  driftByMaterialId,
  zoom,
  canEdit,
  onEditLayer,
  onAddLayer,
  onDeleteLayer,
  onEditSegment,
  onAddSegment,
  onDeleteSegment,
  onCopyAssignment,
  onPasteAssignment,
  copiedAssignment,
}: {
  assembly: Assembly;
  materials: ProjectMaterial[];
  driftByMaterialId: ReadonlyMap<string, ProjectMaterialDriftItem>;
  zoom: number;
  canEdit: boolean;
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
  copiedAssignment: CopiedAssignment | null;
}) {
  const { unitSystem } = useUnitPreference();
  const materialsById = useMemo(() => materialById(materials), [materials]);
  const maxWidth = useMemo(() => maxLayerWidthMm(assembly), [assembly]);
  const canvasWidth = Math.max(MIN_CANVAS_WIDTH_PX, maxWidth * BASE_PX_PER_MM * zoom);
  const [outsideLabel, insideLabel] =
    assembly.orientation === "first_layer_outside" ? ["Outside", "Inside"] : ["Inside", "Outside"];

  return (
    <div className="assembly-canvas-scroll" data-testid="assembly-canvas-scroll">
      <div
        className="assembly-canvas"
        data-testid="assembly-canvas"
        style={{ width: `${canvasWidth}px` }}
      >
        <div className="assembly-orientation-labels" aria-hidden="true">
          <span>{outsideLabel}</span>
          <span>{insideLabel}</span>
        </div>
        {assembly.layers.map((layer) => {
          const layerHeight = pxFromMm(layer.thickness_mm, zoom, MIN_LAYER_HEIGHT_PX);
          const width = layerWidthMm(layer);
          const layerNumber = layer.order + 1;
          return (
            <section
              key={layer.id}
              className="assembly-layer"
              style={{
                minHeight: `${layerHeight}px`,
                width: `${Math.max(MIN_LAYER_WIDTH_PERCENT, (width / maxWidth) * 100)}%`,
              }}
              aria-label={`Layer ${layerNumber}`}
            >
              <div className="assembly-layer-label">
                <div className="assembly-layer-meta">
                  <strong>Layer {layerNumber}</strong>
                  <span>{formatLengthFromMm(layer.thickness_mm, { unitSystem })}</span>
                </div>
                {canEdit ? (
                  <div className="layer-actions">
                    <CanvasActionButton
                      label={`Edit layer ${layerNumber} thickness`}
                      tooltip="Edit layer thickness"
                      icon={Pencil}
                      onClick={() => onEditLayer(layer)}
                    />
                    <CanvasActionButton
                      label={`Add layer above layer ${layerNumber}`}
                      tooltip="Add layer above"
                      icon={PanelTopOpen}
                      className="layer-edge-control add-above"
                      onClick={() => onAddLayer(layer, "above")}
                    />
                    <CanvasActionButton
                      label={`Add layer below layer ${layerNumber}`}
                      tooltip="Add layer below"
                      icon={PanelTopClose}
                      className="layer-edge-control add-below"
                      onClick={() => onAddLayer(layer, "below")}
                    />
                    <CanvasActionButton
                      label={`Delete layer ${layerNumber}`}
                      tooltip="Delete layer"
                      icon={Trash2}
                      onClick={() => onDeleteLayer(layer)}
                    />
                  </div>
                ) : null}
              </div>
              <div className="assembly-segments">
                {layer.segments.map((segment) => {
                  const material = segment.project_material_id
                    ? (materialsById.get(segment.project_material_id) ?? null)
                    : null;
                  const materialName = material?.name ?? "No material";
                  const segmentWidthLabel = formatLengthFromMm(segment.width_mm, { unitSystem });
                  const studSpacingLabel = segment.steel_stud_spacing_mm
                    ? formatLengthFromMm(segment.steel_stud_spacing_mm, { unitSystem })
                    : null;
                  const segmentLabel = `${materialName} segment in layer ${layerNumber}`;
                  return (
                    <article
                      key={segment.id}
                      className={material ? "assembly-segment" : "assembly-segment null-material"}
                      style={{
                        flexBasis: `${pxFromMm(segment.width_mm, zoom, MIN_SEGMENT_WIDTH_PX)}px`,
                        background: materialColor(material),
                      }}
                      data-paste-target={copiedAssignment ? "true" : undefined}
                      title={`${materialName} - ${segmentWidthLabel}`}
                    >
                      <div className="assembly-segment-body">
                        <strong>{materialName}</strong>
                        {material ? (
                          <MaterialDriftBadge item={driftByMaterialId.get(material.id) ?? null} />
                        ) : null}
                        <span>{segmentWidthLabel}</span>
                        {studSpacingLabel ? <small>Studs {studSpacingLabel}</small> : null}
                      </div>
                      {canEdit ? (
                        <div className="segment-actions">
                          <CanvasActionButton
                            label={`Edit ${segmentLabel}`}
                            tooltip="Edit segment"
                            icon={Pencil}
                            onClick={() => onEditSegment(layer, segment)}
                          />
                          <CanvasActionButton
                            label={`Add segment left of ${segmentLabel}`}
                            tooltip="Add segment left"
                            icon={Plus}
                            className="segment-edge-control add-left"
                            onClick={() => onAddSegment(layer, segment, "left")}
                          />
                          <CanvasActionButton
                            label={`Add segment right of ${segmentLabel}`}
                            tooltip="Add segment right"
                            icon={Plus}
                            className="segment-edge-control add-right"
                            onClick={() => onAddSegment(layer, segment, "right")}
                          />
                          <CanvasActionButton
                            label={`Copy ${segmentLabel} assignment`}
                            tooltip="Copy assignment"
                            icon={Copy}
                            onClick={() =>
                              onCopyAssignment({
                                project_material_id: segment.project_material_id,
                                is_continuous_insulation: segment.is_continuous_insulation,
                                steel_stud_spacing_mm: segment.steel_stud_spacing_mm,
                              })
                            }
                          />
                          <CanvasActionButton
                            label={`Paste assignment to ${segmentLabel}`}
                            tooltip="Paste assignment"
                            icon={Plus}
                            disabled={!copiedAssignment}
                            onClick={() => onPasteAssignment(layer, segment)}
                          />
                          <CanvasActionButton
                            label={`Delete ${segmentLabel}`}
                            tooltip="Delete segment"
                            icon={Minus}
                            onClick={() => onDeleteSegment(layer, segment)}
                          />
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function CanvasActionButton({
  label,
  tooltip,
  icon: Icon,
  className,
  disabled = false,
  onClick,
}: {
  label: string;
  tooltip: string;
  icon: LucideIcon;
  className?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const buttonClassName = className ? `icon-button ${className}` : "icon-button";
  return (
    <button
      type="button"
      className={buttonClassName}
      aria-label={label}
      data-tooltip={tooltip}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon size={14} aria-hidden="true" />
    </button>
  );
}
