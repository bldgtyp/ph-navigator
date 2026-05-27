import { FormEvent, useState } from "react";
import { useUnitPreference } from "../../../../lib/units";
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
  busy,
  error,
  onClose,
  onSubmit,
  onPickProjectMaterial,
  onPickCatalogMaterial,
  onHandEnterMaterial,
  onDetachSegmentMaterial,
  onUpdateProjectMaterial,
}: {
  title: string;
  segment: AssemblySegment;
  materials: ProjectMaterial[];
  catalogMaterials: CatalogMaterial[];
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
      <form className="modal-form" onSubmit={submit}>
        <ModalUnitToggle unitSystem={unitSystem} setUnitSystem={setUnitSystem} />
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
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={isContinuous}
            onChange={(event) => setIsContinuous(event.currentTarget.checked)}
          />
          Continuous insulation
        </label>
        <SegmentMaterialPicker
          selectedProjectMaterialId={segment.project_material_id}
          materials={materials}
          catalogMaterials={catalogMaterials}
          busy={busy}
          onPickProjectMaterial={onPickProjectMaterial}
          onPickCatalogMaterial={onPickCatalogMaterial}
          onHandEnterMaterial={onHandEnterMaterial}
          onDetachSegmentMaterial={onDetachSegmentMaterial}
        />
        {selectedMaterial ? (
          <ProjectMaterialEditor
            material={selectedMaterial}
            busy={busy}
            error={error}
            showNotes={false}
            onCommand={onUpdateProjectMaterial}
          />
        ) : null}
        <DialogActions
          busy={busy}
          error={width.error ?? studSpacing.error ?? error}
          submitLabel="Apply"
          onClose={onClose}
        />
      </form>
    </ModalDialog>
  );
}
