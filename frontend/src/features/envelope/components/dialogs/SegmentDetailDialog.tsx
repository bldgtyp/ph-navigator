import { formatLengthFromMm, useUnitPreference } from "../../../../lib/units";
import { ModalDialog } from "../../../../shared/ui/ModalDialog";
import type { AssemblyLayer, AssemblySegment, ProjectMaterial } from "../../types";
import { SegmentMaterialFacts } from "./SegmentMaterialFacts";

// Read-only counterpart to SegmentDialog (CP-5): clicking a canvas segment as a
// viewer — or as an editor on a locked version — opens this inspect-only detail
// instead of the material-editing picker. It surfaces the same material + width
// facts the segment tooltip carries, with no mutation controls. Widths follow
// the global IP/SI preference (CP-9), which every principal can toggle.
export function SegmentDetailDialog({
  segment,
  layer,
  materials,
  onClose,
}: {
  segment: AssemblySegment;
  layer: AssemblyLayer;
  materials: ProjectMaterial[];
  onClose: () => void;
}) {
  const { unitSystem } = useUnitPreference();
  const material = segment.project_material_id
    ? (materials.find((candidate) => candidate.id === segment.project_material_id) ?? null)
    : null;
  const studSpacingLabel = segment.steel_stud_spacing_mm
    ? formatLengthFromMm(segment.steel_stud_spacing_mm, { unitSystem })
    : null;

  return (
    <ModalDialog
      title="Segment details"
      titleId="envelope-segment-detail-title"
      onClose={onClose}
      dismissOnBackdrop
    >
      <div className="modal-form">
        <SegmentMaterialFacts material={material} unitSystem={unitSystem} />
        <dl className="metadata-grid" aria-label="Segment details">
          <div>
            <dt>Width</dt>
            <dd>{formatLengthFromMm(segment.width_mm, { unitSystem })}</dd>
          </div>
          <div>
            <dt>Continuous insulation</dt>
            <dd>{segment.is_continuous_insulation ? "Yes" : "No"}</dd>
          </div>
          {studSpacingLabel ? (
            <div>
              <dt>Steel stud spacing</dt>
              <dd>{studSpacingLabel}</dd>
            </div>
          ) : null}
          <div>
            <dt>Layer</dt>
            <dd>{layer.order + 1}</dd>
          </div>
        </dl>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}
