import { FormEvent, useState } from "react";
import {
  formatConductivityFromWmK,
  formatDensityFromKgM3,
  useUnitPreference,
} from "../../../../lib/units";
import { DialogActions } from "../../../../shared/ui/DialogActions";
import { ModalDialog } from "../../../../shared/ui/ModalDialog";
import type { CatalogMaterial } from "../../../catalogs/types";
import { useLengthDraft } from "../../hooks/useLengthDraft";
import type { AssemblySegment, EnvelopeCommand, ProjectMaterial } from "../../types";
import { ModalUnitToggle } from "../ModalUnitToggle";
import { ProjectMaterialEditor } from "../ProjectMaterialEditor";
import { SegmentMaterialPicker } from "./SegmentMaterialPicker";

export function SegmentDialog({
  title,
  segment,
  materials,
  catalogMaterials,
  catalogMaterialsLoading,
  busy,
  error,
  onClose,
  onSubmit,
  onPickProjectMaterial,
  onPickCatalogMaterial,
  onOpenCatalogPicker,
  onHandEnterMaterial,
  onDetachSegmentMaterial,
  onUpdateProjectMaterial,
}: {
  title: string;
  segment: AssemblySegment;
  materials: ProjectMaterial[];
  catalogMaterials: CatalogMaterial[];
  catalogMaterialsLoading: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: {
    width_mm: number;
    is_continuous_insulation: boolean;
    steel_stud_spacing_mm: number | null;
  }) => void;
  onPickProjectMaterial: (projectMaterialId: string | null) => void;
  onPickCatalogMaterial: (catalogMaterialId: string) => void;
  onOpenCatalogPicker: () => void;
  onHandEnterMaterial: (name: string) => void;
  onDetachSegmentMaterial: () => void;
  onUpdateProjectMaterial: (
    command: Extract<EnvelopeCommand, { kind: "update_project_material" }>,
  ) => void;
}) {
  const { unitSystem, setUnitSystem } = useUnitPreference();
  const width = useLengthDraft(segment.width_mm);
  const [isContinuous, setIsContinuous] = useState(segment.is_continuous_insulation);
  const studSpacing = useLengthDraft(segment.steel_stud_spacing_mm);
  const selectedMaterial =
    segment.project_material_id === null
      ? null
      : (materials.find((material) => material.id === segment.project_material_id) ?? null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const widthMm = width.parsePositive("Width");
    if (widthMm === null) return;
    const spacingMm = studSpacing.parseOptional();
    if (spacingMm === undefined) return;
    onSubmit({
      width_mm: widthMm,
      is_continuous_insulation: isContinuous,
      steel_stud_spacing_mm: spacingMm,
    });
  }

  return (
    <ModalDialog title={title} titleId="envelope-segment-dialog-title" onClose={onClose}>
      <div className="modal-form segment-properties-form">
        <section className="segment-dialog-section">
          <h3>Material</h3>
          <MaterialPreview material={selectedMaterial} unitSystem={unitSystem} />
        </section>
        <SegmentMaterialPicker
          selectedProjectMaterialId={segment.project_material_id}
          materials={materials}
          catalogMaterials={catalogMaterials}
          catalogMaterialsLoading={catalogMaterialsLoading}
          busy={busy}
          onPickProjectMaterial={onPickProjectMaterial}
          onPickCatalogMaterial={onPickCatalogMaterial}
          onOpenCatalogPicker={onOpenCatalogPicker}
          onHandEnterMaterial={onHandEnterMaterial}
          onDetachSegmentMaterial={onDetachSegmentMaterial}
        />
        <form className="segment-dialog-section segment-geometry-form" onSubmit={submit}>
          <section>
            <div className="segment-section-header">
              <h3>Geometry</h3>
              <ModalUnitToggle unitSystem={unitSystem} setUnitSystem={setUnitSystem} />
            </div>
            <div className="segment-geometry-grid">
              <label>
                Width ({width.unitLabel})
                <input
                  value={width.draft}
                  onChange={(event) => width.setDraft(event.currentTarget.value)}
                />
              </label>
              <label>
                Stud spacing ({studSpacing.unitLabel})
                <input
                  value={studSpacing.draft}
                  onChange={(event) => studSpacing.setDraft(event.currentTarget.value)}
                  placeholder="None"
                />
              </label>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={isContinuous}
                onChange={(event) => setIsContinuous(event.currentTarget.checked)}
              />
              Continuous insulation
            </label>
          </section>
          <DialogActions
            busy={busy}
            error={width.error ?? studSpacing.error ?? error}
            submitLabel="Apply"
            onClose={onClose}
          />
        </form>
        {selectedMaterial ? (
          <section className="segment-dialog-section">
            <h3>Shared material values</h3>
            <ProjectMaterialEditor
              material={selectedMaterial}
              busy={busy}
              error={error}
              showNotes={false}
              onCommand={onUpdateProjectMaterial}
            />
          </section>
        ) : null}
      </div>
    </ModalDialog>
  );
}

function MaterialPreview({
  material,
  unitSystem,
}: {
  material: ProjectMaterial | null;
  unitSystem: "IP" | "SI";
}) {
  if (!material) {
    return (
      <div className="segment-material-preview is-empty">
        <strong>No material assigned</strong>
        <span>
          Choose a project material, copy one from the catalog, or hand-enter a custom material.
        </span>
      </div>
    );
  }
  return (
    <div className="segment-material-preview">
      <strong>{material.name}</strong>
      <span>{material.category ?? "Uncategorized"}</span>
      <dl>
        <div>
          <dt>Lambda</dt>
          <dd>{formatConductivityFromWmK(material.conductivity_w_mk, { unitSystem })}</dd>
        </div>
        <div>
          <dt>Density</dt>
          <dd>{formatDensityFromKgM3(material.density_kg_m3, { unitSystem })}</dd>
        </div>
      </dl>
    </div>
  );
}
