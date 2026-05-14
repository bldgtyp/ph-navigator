import { type FormEvent, useEffect, useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { useCreateMaterialMutation, useUpdateMaterialMutation } from "../hooks";
import type { CatalogMaterial, CatalogMaterialCreatePayload } from "../types";
import { editorSubmitLabel, todayIso } from "./form-helpers";

type FormState = {
  name: string;
  category: string;
  version_label: string;
  version_date: string;
  conductivity_w_mk: string;
  density_kg_m3: string;
  specific_heat_j_kgk: string;
  emissivity: string;
  argb_color: string;
  notes: string;
  source_provenance: string;
};

function emptyForm(): FormState {
  return {
    name: "",
    category: "",
    version_label: "v1",
    version_date: todayIso(),
    conductivity_w_mk: "",
    density_kg_m3: "",
    specific_heat_j_kgk: "",
    emissivity: "",
    argb_color: "",
    notes: "",
    source_provenance: "",
  };
}

function formFromMaterial(material: CatalogMaterial): FormState {
  const numberOrEmpty = (value: number | null): string =>
    value === null || value === undefined ? "" : String(value);
  const stringOrEmpty = (value: string | null): string => value ?? "";
  return {
    name: material.name,
    category: material.category,
    version_label: material.version_label,
    version_date: material.version_date,
    conductivity_w_mk: numberOrEmpty(material.conductivity_w_mk),
    density_kg_m3: numberOrEmpty(material.density_kg_m3),
    specific_heat_j_kgk: numberOrEmpty(material.specific_heat_j_kgk),
    emissivity: numberOrEmpty(material.emissivity),
    argb_color: stringOrEmpty(material.argb_color),
    notes: stringOrEmpty(material.notes),
    source_provenance: stringOrEmpty(material.source_provenance),
  };
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function toCreatePayload(form: FormState): CatalogMaterialCreatePayload {
  const payload: CatalogMaterialCreatePayload = {
    name: form.name.trim(),
    category: form.category.trim(),
    version_label: form.version_label.trim() || "v1",
    conductivity_w_mk: parseOptionalNumber(form.conductivity_w_mk),
    density_kg_m3: parseOptionalNumber(form.density_kg_m3),
    specific_heat_j_kgk: parseOptionalNumber(form.specific_heat_j_kgk),
    emissivity: parseOptionalNumber(form.emissivity),
    argb_color: form.argb_color.trim() || null,
    notes: form.notes.trim() || null,
    source_provenance: form.source_provenance.trim() || null,
  };
  // version_date is NOT NULL in storage. On create, the backend defaults to
  // today() when omitted; on update, the field is omitted entirely so the
  // existing value is preserved. Sending null would trip the DB constraint.
  if (form.version_date) {
    payload.version_date = form.version_date;
  }
  return payload;
}

function hasInvalidNumber(form: FormState): boolean {
  return [
    form.conductivity_w_mk,
    form.density_kg_m3,
    form.specific_heat_j_kgk,
    form.emissivity,
  ].some((field) => {
    const parsed = parseOptionalNumber(field);
    return Number.isNaN(parsed);
  });
}

export function MaterialEditorModal({
  material,
  onClose,
  onSaved,
}: {
  material: CatalogMaterial | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(() =>
    material ? formFromMaterial(material) : emptyForm(),
  );
  const isEdit = material !== null;
  const createMutation = useCreateMaterialMutation();
  const updateMutation = useUpdateMaterialMutation();
  const activeMutation = isEdit ? updateMutation : createMutation;

  useEffect(() => {
    setForm(material ? formFromMaterial(material) : emptyForm());
  }, [material]);

  const canSubmit =
    form.name.trim().length > 0 &&
    form.category.trim().length > 0 &&
    !hasInvalidNumber(form) &&
    !activeMutation.isPending;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    const payload = toCreatePayload(form);
    if (isEdit && material) {
      updateMutation.mutate({ id: material.id, payload }, { onSuccess: onSaved });
    } else {
      createMutation.mutate(payload, { onSuccess: onSaved });
    }
  };

  const errorText = activeMutation.isError
    ? errorMessage(
        activeMutation.error,
        isEdit ? "Could not save material." : "Could not create material.",
      )
    : null;

  return (
    <ModalDialog
      title={isEdit ? "Edit material" : "Add material"}
      titleId="material-editor-title"
      onClose={onClose}
    >
      <form className="project-form" onSubmit={handleSubmit}>
        <label>
          <span>Name</span>
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            required
            autoFocus
          />
        </label>
        <label>
          <span>Category</span>
          <input
            value={form.category}
            onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
            placeholder="Insulation, Sheathing, Mass, …"
            required
          />
        </label>
        <label>
          <span>Version label</span>
          <input
            value={form.version_label}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, version_label: event.target.value }))
            }
          />
        </label>
        <label>
          <span>Version date</span>
          <input
            type="date"
            value={form.version_date}
            onChange={(event) => setForm((prev) => ({ ...prev, version_date: event.target.value }))}
          />
        </label>
        <label>
          <span>Conductivity (W/m·K)</span>
          <input
            inputMode="decimal"
            value={form.conductivity_w_mk}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, conductivity_w_mk: event.target.value }))
            }
          />
        </label>
        <label>
          <span>Density (kg/m³)</span>
          <input
            inputMode="decimal"
            value={form.density_kg_m3}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, density_kg_m3: event.target.value }))
            }
          />
        </label>
        <label>
          <span>Specific heat (J/kg·K)</span>
          <input
            inputMode="decimal"
            value={form.specific_heat_j_kgk}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, specific_heat_j_kgk: event.target.value }))
            }
          />
        </label>
        <label>
          <span>Emissivity (0–1)</span>
          <input
            inputMode="decimal"
            value={form.emissivity}
            onChange={(event) => setForm((prev) => ({ ...prev, emissivity: event.target.value }))}
          />
        </label>
        <label>
          <span>ARGB color</span>
          <input
            value={form.argb_color}
            onChange={(event) => setForm((prev) => ({ ...prev, argb_color: event.target.value }))}
            placeholder="(255,220,230,240)"
          />
        </label>
        <label>
          <span>Source / provenance</span>
          <input
            value={form.source_provenance}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, source_provenance: event.target.value }))
            }
          />
        </label>
        <label>
          <span>Notes</span>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
          />
        </label>
        {errorText ? (
          <p className="form-error" role="alert">
            {errorText}
          </p>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={!canSubmit}>
            {editorSubmitLabel(isEdit, activeMutation.isPending, "Add material")}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
