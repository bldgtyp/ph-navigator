import { useMemo } from "react";
import { formatLengthFromMm, useUnitPreference } from "../../../lib/units";
import { layerWidthMm, materialById, materialColor, maxLayerWidthMm } from "../lib";
import type { Assembly, AssemblyLayer, AssemblySegment, ProjectMaterial } from "../types";

const BASE_PX_PER_MM = 0.18;
const MIN_LAYER_HEIGHT = 30;
const MIN_SEGMENT_WIDTH = 72;

export type CopiedAssignment = Pick<
  AssemblySegment,
  "project_material_id" | "is_continuous_insulation" | "steel_stud_spacing_mm"
>;

export function AssemblyCanvas({
  assembly,
  materials,
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
  const canvasWidth = Math.max(360, maxWidth * BASE_PX_PER_MM * zoom);

  return (
    <div className="assembly-canvas-scroll" data-testid="assembly-canvas-scroll">
      <div
        className="assembly-canvas"
        data-testid="assembly-canvas"
        style={{ width: `${canvasWidth}px` }}
      >
        {assembly.layers.map((layer) => {
          const layerHeight = Math.max(
            MIN_LAYER_HEIGHT,
            layer.thickness_mm * BASE_PX_PER_MM * zoom,
          );
          const width = layerWidthMm(layer);
          return (
            <section
              key={layer.id}
              className="assembly-layer"
              style={{
                minHeight: `${layerHeight}px`,
                width: `${Math.max(12, (width / maxWidth) * 100)}%`,
              }}
              aria-label={`Layer ${layer.order + 1}`}
            >
              <div className="assembly-layer-label">
                <strong>Layer {layer.order + 1}</strong>
                <span>{formatLengthFromMm(layer.thickness_mm, { unitSystem })}</span>
                {canEdit ? (
                  <div className="layer-actions">
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => onEditLayer(layer)}
                    >
                      Thickness
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => onAddLayer(layer, "above")}
                    >
                      Add above
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => onAddLayer(layer, "below")}
                    >
                      Add below
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => onDeleteLayer(layer)}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="assembly-segments">
                {layer.segments.map((segment) => {
                  const material = segment.project_material_id
                    ? (materialsById.get(segment.project_material_id) ?? null)
                    : null;
                  return (
                    <article
                      key={segment.id}
                      className={material ? "assembly-segment" : "assembly-segment null-material"}
                      style={{
                        flexBasis: `${Math.max(MIN_SEGMENT_WIDTH, segment.width_mm * BASE_PX_PER_MM * zoom)}px`,
                        background: materialColor(material),
                      }}
                      data-paste-target={copiedAssignment ? "true" : undefined}
                    >
                      <strong>{material?.name ?? "No material"}</strong>
                      <span>{formatLengthFromMm(segment.width_mm, { unitSystem })}</span>
                      {segment.steel_stud_spacing_mm ? (
                        <small>
                          Studs {formatLengthFromMm(segment.steel_stud_spacing_mm, { unitSystem })}
                        </small>
                      ) : null}
                      {canEdit ? (
                        <div className="segment-actions">
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => onEditSegment(layer, segment)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => onAddSegment(layer, segment, "left")}
                          >
                            Add left
                          </button>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => onAddSegment(layer, segment, "right")}
                          >
                            Add right
                          </button>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() =>
                              onCopyAssignment({
                                project_material_id: segment.project_material_id,
                                is_continuous_insulation: segment.is_continuous_insulation,
                                steel_stud_spacing_mm: segment.steel_stud_spacing_mm,
                              })
                            }
                          >
                            Copy
                          </button>
                          <button
                            type="button"
                            className="text-button"
                            disabled={!copiedAssignment}
                            onClick={() => onPasteAssignment(layer, segment)}
                          >
                            Paste
                          </button>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => onDeleteSegment(layer, segment)}
                          >
                            Delete
                          </button>
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
