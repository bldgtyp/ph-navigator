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
      showHeaderClose={false}
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
        <fieldset id="envelope-segment-width-section" className="segment-dialog-section">
          <legend>Width ({width.unitLabel})</legend>
          <div className="segment-geometry-grid">
            <input
              id="envelope-segment-width-input"
              aria-label={`Width (${width.unitLabel})`}
              value={width.draft}
              onChange={(event) => width.setDraft(event.currentTarget.value)}
            />
          </div>
        </fieldset>
        <fieldset id="envelope-segment-steel-stud-section" className="segment-dialog-section">
          <legend>Steel Stud Parameters</legend>
          <div className="segment-geometry-grid">
            <label htmlFor="envelope-segment-stud-spacing-input">
              Stud spacing ({studSpacing.unitLabel})
              <input
                id="envelope-segment-stud-spacing-input"
                value={studSpacing.draft}
                onChange={(event) => studSpacing.setDraft(event.currentTarget.value)}
                placeholder="None"
              />
            </label>
          </div>
          <label className="checkbox-row" htmlFor="envelope-segment-continuous-insulation">
            <input
              id="envelope-segment-continuous-insulation"
              type="checkbox"
              checked={isContinuous}
              onChange={(event) => setIsContinuous(event.currentTarget.checked)}
            />
            Continuous insulation
          </label>
        </fieldset>
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
