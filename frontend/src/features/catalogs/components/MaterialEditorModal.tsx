import { type FormEvent, useEffect, useState } from "react";
import {
  formatConductivityFromWmK,
  formatDensityFromKgM3,
  formatSpecificHeatFromJKgK,
  parseConductivityToWmK,
  parseDensityToKgM3,
  parseSpecificHeatToJKgK,
  useUnitPreference,
  type UnitFormatOptions,
} from "../../../lib/units";
import { errorMessage } from "../../../shared/lib/errors";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { useCreateMaterialMutation, useUpdateMaterialMutation } from "../hooks";
import type { CatalogMaterial, CatalogMaterialCreatePayload } from "../types";
import { editorSubmitLabel, parseOptionalNumber, parseOptionalUnitNumber, todayIso } from "./form-helpers";
import { conductivityUnitLabel, densityUnitLabel, specificHeatUnitLabel } from "./unit-labels";

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

function formFromMaterial(material: CatalogMaterial, unitOptions: UnitFormatOptions): FormState {
  const numberOrEmpty = (value: number | null): string =>
    value === null || value === undefined ? "" : String(value);
  const stringOrEmpty = (value: string | null): string => value ?? "";
  return {
    name: material.name,
    category: material.category,
    version_label: material.version_label,
    version_date: material.version_date,
    conductivity_w_mk: formatConductivityFromWmK(material.conductivity_w_mk, unitOptions),
    density_kg_m3: formatDensityFromKgM3(material.density_kg_m3, unitOptions),
    specific_heat_j_kgk: formatSpecificHeatFromJKgK(material.specific_heat_j_kgk, unitOptions),
    emissivity: numberOrEmpty(material.emissivity),
    argb_color: stringOrEmpty(material.argb_color),
    notes: stringOrEmpty(material.notes),
    source_provenance: stringOrEmpty(material.source_provenance),
  };
}

function toCreatePayload(form: FormState, unitOptions: UnitFormatOptions): CatalogMaterialCreatePayload {
  const payload: CatalogMaterialCreatePayload = {
    name: form.name.trim(),
    category: form.category.trim(),
    version_label: form.version_label.trim() || "v1",
    conductivity_w_mk: parseOptionalUnitNumber(form.conductivity_w_mk, parseConductivityToWmK, unitOptions),
    density_kg_m3: parseOptionalUnitNumber(form.density_kg_m3, parseDensityToKgM3, unitOptions),
    specific_heat_j_kgk: parseOptionalUnitNumber(form.specific_heat_j_kgk, parseSpecificHeatToJKgK, unitOptions),
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

function hasInvalidNumber(form: FormState, unitOptions: UnitFormatOptions): boolean {
  return [
    parseOptionalUnitNumber(form.conductivity_w_mk, parseConductivityToWmK, unitOptions),
    parseOptionalUnitNumber(form.density_kg_m3, parseDensityToKgM3, unitOptions),
    parseOptionalUnitNumber(form.specific_heat_j_kgk, parseSpecificHeatToJKgK, unitOptions),
    parseOptionalNumber(form.emissivity),
  ].some((field) => Number.isNaN(field));
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
  const { unitSystem } = useUnitPreference();
  const [formUnitSystem] = useState(unitSystem);
  const unitOptions: UnitFormatOptions = {
    unitSystem: formUnitSystem,
    showUnit: false,
    empty: "",
  };
  const [form, setForm] = useState<FormState>(() =>
    material ? formFromMaterial(material, unitOptions) : emptyForm(),
  );
  const isEdit = material !== null;
  const createMutation = useCreateMaterialMutation();
  const updateMutation = useUpdateMaterialMutation();
  const activeMutation = isEdit ? updateMutation : createMutation;

  useEffect(() => {
    setForm(material ? formFromMaterial(material, unitOptions) : emptyForm());
    // Unit system is intentionally frozen while the modal is open so an
    // in-progress edit is not rewritten under the cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material]);

  const canSubmit =
    form.name.trim().length > 0 &&
    form.category.trim().length > 0 &&
    !hasInvalidNumber(form, unitOptions) &&
    !activeMutation.isPending;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    const payload = toCreatePayload(form, unitOptions);
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
          <span>Conductivity ({conductivityUnitLabel(formUnitSystem)})</span>
          <input
            inputMode="decimal"
            value={form.conductivity_w_mk}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, conductivity_w_mk: event.target.value }))
            }
          />
        </label>
        <label>
          <span>Density ({densityUnitLabel(formUnitSystem)})</span>
          <input
            inputMode="decimal"
            value={form.density_kg_m3}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, density_kg_m3: event.target.value }))
            }
          />
        </label>
        <label>
          <span>Specific heat ({specificHeatUnitLabel(formUnitSystem)})</span>
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
