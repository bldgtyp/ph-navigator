import { FormEvent, useRef, useState } from "react";
import { useUnitPreference } from "../../../../lib/units";
import { DialogActions } from "../../../../shared/ui/DialogActions";
import { ModalDialog } from "../../../../shared/ui/ModalDialog";
import { useOutsidePointerDown } from "../../../../shared/ui/useOutsidePointerDown";
import type { CatalogMaterial } from "../../../catalogs/types";
import { useLengthDraft } from "../../hooks/useLengthDraft";
import type { AssemblySegment, ProjectMaterial } from "../../types";
import { ModalUnitToggle } from "../ModalUnitToggle";
import { SegmentMaterialPicker } from "./SegmentMaterialPicker";
import { SegmentMaterialFacts } from "./SegmentMaterialFacts";

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
  onDelete,
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
  onDelete: () => void;
}) {
  const { unitSystem, setUnitSystem } = useUnitPreference();
  const lengthDraftOptions = { followUnitPreference: true, unitLabelStyle: "long" } as const;
  const width = useLengthDraft(segment.width_mm, lengthDraftOptions);
  const [isContinuous, setIsContinuous] = useState(segment.is_continuous_insulation);
  const studSpacing = useLengthDraft(segment.steel_stud_spacing_mm, lengthDraftOptions);
  const material = segment.project_material_id
    ? (materials.find((candidate) => candidate.id === segment.project_material_id) ?? null)
    : null;
  const [steelStudOpen] = useState(
    segment.steel_stud_spacing_mm !== null || segment.is_continuous_insulation,
  );
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
    <ModalDialog
      id="envelope-segment-dialog"
      title={title}
      titleId="envelope-segment-dialog-title"
      onClose={onClose}
      headerAccessory={
        <>
          <ModalUnitToggle
            id="envelope-segment-dialog-unit-toggle"
            unitSystem={unitSystem}
            setUnitSystem={setUnitSystem}
          />
          <SegmentActionsMenu onDelete={onDelete} />
        </>
      }
    >
      <form
        id="envelope-segment-dialog-form"
        className="modal-form segment-properties-form"
        onSubmit={submit}
      >
        <SegmentMaterialPicker
          selectedProjectMaterialId={segment.project_material_id}
          materials={materials}
          catalogMaterials={catalogMaterials}
          catalogMaterialsLoading={catalogMaterialsLoading}
          busy={busy}
          onPickProjectMaterial={onPickProjectMaterial}
          onPickCatalogMaterial={onPickCatalogMaterial}
          onOpenCatalogPicker={onOpenCatalogPicker}
        />
        <SegmentMaterialFacts material={material} unitSystem={unitSystem} />
        <section
          id="envelope-segment-width-section"
          className="segment-dialog-section"
          role="group"
          aria-labelledby="envelope-segment-width-heading"
        >
          <h3 id="envelope-segment-width-heading" className="segment-dialog-section-heading">
            Width ({width.unitLabel})
          </h3>
          <div className="segment-geometry-grid">
            <input
              id="envelope-segment-width-input"
              aria-label={`Width (${width.unitLabel})`}
              value={width.draft}
              onChange={(event) => width.setDraft(event.currentTarget.value)}
            />
          </div>
        </section>
        <SteelStudParameters
          defaultOpen={steelStudOpen}
          unitLabel={studSpacing.unitLabel}
          draft={studSpacing.draft}
          isContinuous={isContinuous}
          onDraftChange={studSpacing.setDraft}
          onContinuousChange={setIsContinuous}
        />
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

function SteelStudParameters({
  defaultOpen,
  unitLabel,
  draft,
  isContinuous,
  onDraftChange,
  onContinuousChange,
}: {
  defaultOpen: boolean;
  unitLabel: string;
  draft: string;
  isContinuous: boolean;
  onDraftChange: (value: string) => void;
  onContinuousChange: (value: boolean) => void;
}) {
  const controls = (
    <div className="segment-steel-stud-controls">
      <div className="segment-steel-stud-row">
        <label htmlFor="envelope-segment-stud-spacing-input">Stud spacing ({unitLabel})</label>
        <input
          id="envelope-segment-stud-spacing-input"
          value={draft}
          onChange={(event) => onDraftChange(event.currentTarget.value)}
          placeholder="None"
        />
      </div>
      <label
        className="checkbox-row segment-steel-stud-checkbox"
        htmlFor="envelope-segment-continuous-insulation"
      >
        <input
          id="envelope-segment-continuous-insulation"
          type="checkbox"
          checked={isContinuous}
          onChange={(event) => onContinuousChange(event.currentTarget.checked)}
        />
        Continuous insulation
      </label>
    </div>
  );

  if (defaultOpen) {
    return (
      <section
        id="envelope-segment-steel-stud-section"
        className="segment-dialog-section"
        role="group"
        aria-labelledby="envelope-segment-steel-stud-heading"
      >
        <h3 id="envelope-segment-steel-stud-heading" className="segment-dialog-section-heading">
          Steel stud parameters
        </h3>
        {controls}
      </section>
    );
  }

  return (
    <details
      id="envelope-segment-steel-stud-section"
      className="segment-dialog-section segment-dialog-disclosure"
    >
      <summary>Steel stud parameters</summary>
      {controls}
    </details>
  );
}

function SegmentActionsMenu({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useOutsidePointerDown(menuRef, open, () => setOpen(false));

  function deleteSegment(): void {
    setOpen(false);
    onDelete();
  }

  return (
    <div id="envelope-segment-dialog-actions" className="segment-actions" ref={menuRef}>
      <button
        id="envelope-segment-dialog-actions-trigger"
        type="button"
        className="segment-actions-trigger"
        aria-label="More segment actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      />
      {open ? (
        <div
          id="envelope-segment-dialog-actions-menu"
          className="segment-actions-menu"
          role="menu"
          aria-label="Segment actions"
        >
          <button
            id="envelope-segment-dialog-delete-segment"
            type="button"
            role="menuitem"
            className="segment-actions-menu-item is-danger"
            onClick={deleteSegment}
          >
            Delete segment
          </button>
        </div>
      ) : null}
    </div>
  );
}
