// @size-exception: docs/code-reviews/2026-05-25/frontend-code-review.md#21-srp--file-length-violations
import { FormEvent, useEffect, useState } from "react";
import { formatLengthFromMm, parseLengthToMm, useUnitPreference } from "../../../lib/units";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import type { CatalogMaterial } from "../../catalogs/types";
import { ModalUnitToggle } from "./ModalUnitToggle";
import { ProjectMaterialEditor } from "./ProjectMaterialEditor";
import type {
  Assembly,
  AssemblyLayer,
  AssemblySegment,
  AssemblyType,
  EnvelopeCommand,
  ProjectMaterial,
} from "../types";

type DialogState =
  | { kind: "create-assembly" }
  | { kind: "rename-assembly"; assembly: Assembly }
  | { kind: "type-assembly"; assembly: Assembly }
  | { kind: "duplicate-assembly"; assembly: Assembly }
  | { kind: "delete-assembly"; assembly: Assembly }
  | { kind: "layer"; assembly: Assembly; layer: AssemblyLayer }
  | { kind: "add-layer"; assembly: Assembly; layer: AssemblyLayer; position: "above" | "below" }
  | { kind: "delete-layer"; assembly: Assembly; layer: AssemblyLayer }
  | { kind: "segment"; assembly: Assembly; layer: AssemblyLayer; segment: AssemblySegment }
  | {
      kind: "add-segment";
      assembly: Assembly;
      layer: AssemblyLayer;
      segment: AssemblySegment;
      position: "left" | "right";
    }
  | { kind: "delete-segment"; assembly: Assembly; layer: AssemblyLayer; segment: AssemblySegment };

export type EnvelopeEditorDialogState = DialogState;

const ASSEMBLY_TYPES: AssemblyType[] = ["wall", "floor", "roof", "other"];

export function EnvelopeEditorDialogs({
  dialog,
  materials,
  catalogMaterials,
  busy,
  error,
  onClose,
  onCommand,
}: {
  dialog: DialogState | null;
  materials: ProjectMaterial[];
  catalogMaterials: CatalogMaterial[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onCommand: (command: EnvelopeCommand) => void;
}) {
  if (!dialog) return null;
  if (dialog.kind === "create-assembly") {
    return (
      <AssemblyNameDialog
        title="New assembly"
        initialName="New Assembly"
        initialType="wall"
        busy={busy}
        error={error}
        onClose={onClose}
        onSubmit={(name, type) => onCommand({ kind: "create_assembly", name, type })}
      />
    );
  }
  if (dialog.kind === "rename-assembly") {
    return (
      <AssemblyNameDialog
        title="Rename assembly"
        initialName={dialog.assembly.name}
        initialType={dialog.assembly.type}
        hideType
        busy={busy}
        error={error}
        onClose={onClose}
        onSubmit={(name) =>
          onCommand({ kind: "rename_assembly", assembly_id: dialog.assembly.id, name })
        }
      />
    );
  }
  if (dialog.kind === "type-assembly") {
    return (
      <AssemblyNameDialog
        title="Assembly type"
        initialName={dialog.assembly.name}
        initialType={dialog.assembly.type}
        hideName
        busy={busy}
        error={error}
        onClose={onClose}
        onSubmit={(_name, type) =>
          onCommand({ kind: "update_assembly_type", assembly_id: dialog.assembly.id, type })
        }
      />
    );
  }
  if (dialog.kind === "duplicate-assembly") {
    return (
      <AssemblyNameDialog
        title="Duplicate assembly"
        initialName={`${dialog.assembly.name} Copy`}
        initialType={dialog.assembly.type}
        hideType
        busy={busy}
        error={error}
        onClose={onClose}
        onSubmit={(name) =>
          onCommand({ kind: "duplicate_assembly", assembly_id: dialog.assembly.id, name })
        }
      />
    );
  }
  if (dialog.kind === "delete-assembly") {
    return (
      <ConfirmDialog
        title="Delete assembly"
        message={`Delete ${dialog.assembly.name}? Segment photo references stay in the draft history but are removed from this assembly.`}
        busy={busy}
        error={error}
        onClose={onClose}
        onConfirm={() => onCommand({ kind: "delete_assembly", assembly_id: dialog.assembly.id })}
      />
    );
  }
  if (dialog.kind === "layer") {
    return (
      <LengthDialog
        title="Layer thickness"
        label="Thickness"
        initialValueMm={dialog.layer.thickness_mm}
        busy={busy}
        error={error}
        onClose={onClose}
        onSubmit={(thickness_mm) =>
          onCommand({
            kind: "update_layer_thickness",
            assembly_id: dialog.assembly.id,
            layer_id: dialog.layer.id,
            thickness_mm,
          })
        }
      />
    );
  }
  if (dialog.kind === "add-layer") {
    return (
      <LengthDialog
        title="Add layer"
        label="Thickness"
        initialValueMm={100}
        busy={busy}
        error={error}
        onClose={onClose}
        onSubmit={(thickness_mm) =>
          onCommand({
            kind: "add_layer",
            assembly_id: dialog.assembly.id,
            target_layer_id: dialog.layer.id,
            position: dialog.position,
            thickness_mm,
          })
        }
      />
    );
  }
  if (dialog.kind === "delete-layer") {
    return (
      <ConfirmDialog
        title="Delete layer"
        message={`Delete layer ${dialog.layer.order + 1}?`}
        busy={busy}
        error={error}
        onClose={onClose}
        onConfirm={() =>
          onCommand({
            kind: "delete_layer",
            assembly_id: dialog.assembly.id,
            layer_id: dialog.layer.id,
          })
        }
      />
    );
  }
  if (dialog.kind === "segment") {
    return (
      <SegmentDialog
        title="Segment properties"
        segment={dialog.segment}
        materials={materials}
        catalogMaterials={catalogMaterials}
        busy={busy}
        error={error}
        onClose={onClose}
        onSubmit={(values) =>
          onCommand({
            kind: "update_segment",
            assembly_id: dialog.assembly.id,
            layer_id: dialog.layer.id,
            segment_id: dialog.segment.id,
            ...values,
          })
        }
        onPickProjectMaterial={(project_material_id) =>
          onCommand({
            kind: "pick_project_material",
            assembly_id: dialog.assembly.id,
            layer_id: dialog.layer.id,
            segment_id: dialog.segment.id,
            project_material_id,
          })
        }
        onPickCatalogMaterial={(catalog_material_id) =>
          onCommand({
            kind: "pick_catalog_material",
            assembly_id: dialog.assembly.id,
            layer_id: dialog.layer.id,
            segment_id: dialog.segment.id,
            catalog_material_id,
          })
        }
        onHandEnterMaterial={(name) =>
          onCommand({
            kind: "hand_enter_material",
            assembly_id: dialog.assembly.id,
            layer_id: dialog.layer.id,
            segment_id: dialog.segment.id,
            name,
          })
        }
        onDetachSegmentMaterial={() =>
          onCommand({
            kind: "detach_segment_material",
            assembly_id: dialog.assembly.id,
            layer_id: dialog.layer.id,
            segment_id: dialog.segment.id,
          })
        }
        onUpdateProjectMaterial={(command) => onCommand(command)}
      />
    );
  }
  if (dialog.kind === "add-segment") {
    return (
      <LengthDialog
        title="Add segment"
        label="Width"
        initialValueMm={dialog.segment.width_mm}
        busy={busy}
        error={error}
        onClose={onClose}
        onSubmit={(width_mm) =>
          onCommand({
            kind: "add_segment",
            assembly_id: dialog.assembly.id,
            layer_id: dialog.layer.id,
            target_segment_id: dialog.segment.id,
            position: dialog.position,
            width_mm,
          })
        }
      />
    );
  }
  return (
    <ConfirmDialog
      title="Delete segment"
      message={`Delete segment ${dialog.segment.order + 1}?`}
      busy={busy}
      error={error}
      onClose={onClose}
      onConfirm={() =>
        onCommand({
          kind: "delete_segment",
          assembly_id: dialog.assembly.id,
          layer_id: dialog.layer.id,
          segment_id: dialog.segment.id,
        })
      }
    />
  );
}

function AssemblyNameDialog({
  title,
  initialName,
  initialType,
  hideName,
  hideType,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  title: string;
  initialName: string;
  initialType: AssemblyType;
  hideName?: boolean;
  hideType?: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (name: string, type: AssemblyType) => void;
}) {
  const [name, setName] = useState(initialName);
  const [type, setType] = useState<AssemblyType>(initialType);
  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(name.trim(), type);
  }
  return (
    <ModalDialog title={title} titleId="envelope-assembly-dialog-title" onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        {hideName ? null : (
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.currentTarget.value)} />
          </label>
        )}
        {hideType ? null : (
          <label>
            Type
            <select
              value={type}
              onChange={(event) => setType(event.currentTarget.value as AssemblyType)}
            >
              {ASSEMBLY_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        )}
        <DialogActions busy={busy} error={error} submitLabel="Apply" onClose={onClose} />
      </form>
    </ModalDialog>
  );
}

function LengthDialog({
  title,
  label,
  initialValueMm,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  title: string;
  label: string;
  initialValueMm: number;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (valueMm: number) => void;
}) {
  const { unitSystem, setUnitSystem } = useUnitPreference();
  const length = useLengthDraft(initialValueMm);
  function submit(event: FormEvent) {
    event.preventDefault();
    const valueMm = length.parsePositive("Length");
    if (valueMm !== null) onSubmit(valueMm);
  }
  return (
    <ModalDialog title={title} titleId="envelope-length-dialog-title" onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <ModalUnitToggle unitSystem={unitSystem} setUnitSystem={setUnitSystem} />
        <label>
          {label} ({length.unitLabel})
          <input
            value={length.draft}
            onChange={(event) => length.setDraft(event.currentTarget.value)}
          />
        </label>
        <DialogActions
          busy={busy}
          error={length.error ?? error}
          submitLabel="Apply"
          onClose={onClose}
        />
      </form>
    </ModalDialog>
  );
}

function SegmentDialog({
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
  const [newMaterialName, setNewMaterialName] = useState("");
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
        <fieldset className="material-picker">
          <legend>Material</legend>
          <label>
            In this project
            <select
              value={segment.project_material_id ?? ""}
              onChange={(event) => onPickProjectMaterial(event.currentTarget.value || null)}
            >
              <option value="">No material</option>
              {materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name} ({material.use_sites.length} uses)
                </option>
              ))}
            </select>
          </label>
          <label>
            From catalog
            <select
              value=""
              onChange={(event) => {
                const catalog_material_id = event.currentTarget.value;
                if (catalog_material_id) onPickCatalogMaterial(catalog_material_id);
              }}
            >
              <option value="">Choose catalog material</option>
              {catalogMaterials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.category} / {material.name}
                </option>
              ))}
            </select>
          </label>
          <div className="inline-form-row">
            <input
              value={newMaterialName}
              onChange={(event) => setNewMaterialName(event.currentTarget.value)}
              placeholder="Hand-enter material"
            />
            <button
              type="button"
              className="secondary-button"
              disabled={!newMaterialName.trim() || busy}
              onClick={() => {
                onHandEnterMaterial(newMaterialName.trim());
                setNewMaterialName("");
              }}
            >
              Add
            </button>
          </div>
          {segment.project_material_id ? (
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={onDetachSegmentMaterial}
            >
              Detach to custom material
            </button>
          ) : null}
        </fieldset>
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

function useLengthDraft(initialValueMm: number | null) {
  const { unitSystem } = useUnitPreference();
  const [editorUnitSystem] = useState(unitSystem);
  const [draft, setDraft] = useState(() =>
    initialValueMm === null
      ? ""
      : formatLengthFromMm(initialValueMm, { unitSystem: editorUnitSystem, showUnit: false }),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setError(null), [draft]);

  function parsePositive(label: string): number | null {
    const parsed = parseLengthToMm(draft, { unitSystem: editorUnitSystem });
    if (!parsed.ok || parsed.valueSi <= 0) {
      setError(parsed.ok ? `${label} must be greater than zero.` : parsed.message);
      return null;
    }
    return parsed.valueSi;
  }

  function parseOptional(): number | null | undefined {
    if (draft.trim() === "") return null;
    const parsed = parseLengthToMm(draft, { unitSystem: editorUnitSystem });
    if (!parsed.ok) {
      setError(parsed.message);
      return undefined;
    }
    return parsed.valueSi;
  }

  return {
    draft,
    error,
    parseOptional,
    parsePositive,
    setDraft,
    unitLabel: editorUnitSystem === "IP" ? "in" : "mm",
  };
}

function ConfirmDialog({
  title,
  message,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  title: string;
  message: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalDialog title={title} titleId="envelope-confirm-dialog-title" onClose={onClose}>
      <div className="modal-form">
        <p>{message}</p>
        <DialogActions
          busy={busy}
          error={error}
          submitLabel="Confirm"
          onClose={onClose}
          onConfirm={onConfirm}
        />
      </div>
    </ModalDialog>
  );
}

function DialogActions({
  busy,
  error,
  submitLabel,
  onClose,
  onConfirm,
}: {
  busy: boolean;
  error: string | null;
  submitLabel: string;
  onClose: () => void;
  onConfirm?: () => void;
}) {
  return (
    <>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onClose}>
          Cancel
        </button>
        <button
          type={onConfirm ? "button" : "submit"}
          className="primary-button"
          disabled={busy}
          onClick={onConfirm}
        >
          {submitLabel}
        </button>
      </div>
    </>
  );
}
