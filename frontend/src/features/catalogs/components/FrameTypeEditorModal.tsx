import { type FormEvent, useEffect, useState } from "react";
import {
  formatLengthFromMm,
  formatLinearPsiFromWmK,
  formatUValueFromWm2K,
  parseLengthToMm,
  parseLinearPsiToWmK,
  parseUValueToWm2K,
  useUnitPreference,
  type UnitFormatOptions,
} from "../../../lib/units";
import { errorMessage } from "../../../shared/lib/errors";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { useCreateFrameTypeMutation, useUpdateFrameTypeMutation } from "../hooks";
import type { CatalogFrameType, CatalogFrameTypeCreatePayload } from "../types";
import {
  colorToNull,
  editorSubmitLabel,
  parseOptionalUnitNumber,
  stringOrEmpty,
  trimToNull,
} from "./form-helpers";
import { lengthUnitLabel, psiUnitLabel, uValueUnitLabel } from "./unit-labels";

type FormState = {
  name: string;
  manufacturer: string;
  brand: string;
  width_mm: string;
  u_value_w_m2k: string;
  psi_g_w_mk: string;
  psi_install_w_mk: string;
  color: string;
  comments: string;
  source: string;
};

function emptyForm(): FormState {
  return {
    name: "",
    manufacturer: "",
    brand: "",
    width_mm: "",
    u_value_w_m2k: "",
    psi_g_w_mk: "",
    psi_install_w_mk: "",
    color: "",
    comments: "",
    source: "",
  };
}

function formFromRecord(record: CatalogFrameType, unitOptions: UnitFormatOptions): FormState {
  return {
    name: record.name,
    manufacturer: stringOrEmpty(record.manufacturer),
    brand: stringOrEmpty(record.brand),
    width_mm: formatLengthFromMm(record.width_mm, unitOptions),
    u_value_w_m2k: formatUValueFromWm2K(record.u_value_w_m2k, unitOptions),
    psi_g_w_mk: formatLinearPsiFromWmK(record.psi_g_w_mk, unitOptions),
    psi_install_w_mk: formatLinearPsiFromWmK(record.psi_install_w_mk, unitOptions),
    color: stringOrEmpty(record.color),
    comments: stringOrEmpty(record.comments),
    source: stringOrEmpty(record.source),
  };
}

function toCreatePayload(
  form: FormState,
  unitOptions: UnitFormatOptions,
): CatalogFrameTypeCreatePayload {
  return {
    name: form.name.trim(),
    manufacturer: trimToNull(form.manufacturer),
    brand: trimToNull(form.brand),
    width_mm: parseOptionalUnitNumber(form.width_mm, parseLengthToMm, unitOptions),
    u_value_w_m2k: parseOptionalUnitNumber(form.u_value_w_m2k, parseUValueToWm2K, unitOptions),
    psi_g_w_mk: parseOptionalUnitNumber(form.psi_g_w_mk, parseLinearPsiToWmK, unitOptions),
    psi_install_w_mk: parseOptionalUnitNumber(
      form.psi_install_w_mk,
      parseLinearPsiToWmK,
      unitOptions,
    ),
    color: colorToNull(form.color),
    comments: trimToNull(form.comments),
    source: trimToNull(form.source),
  };
}

export function FrameTypeEditorModal({
  record,
  onClose,
  onSaved,
}: {
  record: CatalogFrameType | null;
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
    record ? formFromRecord(record, unitOptions) : emptyForm(),
  );
  const isEdit = record !== null;
  const createMutation = useCreateFrameTypeMutation();
  const updateMutation = useUpdateFrameTypeMutation();
  const activeMutation = isEdit ? updateMutation : createMutation;

  useEffect(() => {
    setForm(record ? formFromRecord(record, unitOptions) : emptyForm());
    // Unit system is intentionally frozen while the modal is open so an
    // in-progress edit is not rewritten under the cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record]);

  const canSubmit =
    form.name.trim().length > 0 &&
    ![
      parseOptionalUnitNumber(form.width_mm, parseLengthToMm, unitOptions),
      parseOptionalUnitNumber(form.u_value_w_m2k, parseUValueToWm2K, unitOptions),
      parseOptionalUnitNumber(form.psi_g_w_mk, parseLinearPsiToWmK, unitOptions),
      parseOptionalUnitNumber(form.psi_install_w_mk, parseLinearPsiToWmK, unitOptions),
    ].some((field) => Number.isNaN(field)) &&
    !activeMutation.isPending;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    const payload = toCreatePayload(form, unitOptions);
    if (isEdit && record) {
      updateMutation.mutate({ id: record.id, payload }, { onSuccess: onSaved });
    } else {
      createMutation.mutate(payload, { onSuccess: onSaved });
    }
  };

  const errorText = activeMutation.isError
    ? errorMessage(
        activeMutation.error,
        isEdit ? "Could not save frame type." : "Could not create frame type.",
      )
    : null;

  return (
    <ModalDialog
      title={isEdit ? "Edit frame type" : "Add frame type"}
      titleId="frame-type-editor-title"
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
          <span>Manufacturer</span>
          <input
            value={form.manufacturer}
            onChange={(event) => setForm((prev) => ({ ...prev, manufacturer: event.target.value }))}
            placeholder="Skyline, Schüco, Zola, …"
          />
        </label>
        <label>
          <span>Brand</span>
          <input
            value={form.brand}
            onChange={(event) => setForm((prev) => ({ ...prev, brand: event.target.value }))}
            placeholder="Ridge, AWS-90, ThermoPlus, …"
          />
        </label>
        <label>
          <span>Width ({lengthUnitLabel(formUnitSystem)})</span>
          <input
            inputMode="decimal"
            value={form.width_mm}
            onChange={(event) => setForm((prev) => ({ ...prev, width_mm: event.target.value }))}
          />
        </label>
        <label>
          <span>U-value ({uValueUnitLabel(formUnitSystem)})</span>
          <input
            inputMode="decimal"
            value={form.u_value_w_m2k}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, u_value_w_m2k: event.target.value }))
            }
          />
        </label>
        <label>
          <span>Ψ-glazing ({psiUnitLabel(formUnitSystem)})</span>
          <input
            inputMode="decimal"
            value={form.psi_g_w_mk}
            onChange={(event) => setForm((prev) => ({ ...prev, psi_g_w_mk: event.target.value }))}
          />
        </label>
        <label>
          <span>Ψ-install ({psiUnitLabel(formUnitSystem)})</span>
          <input
            inputMode="decimal"
            value={form.psi_install_w_mk}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, psi_install_w_mk: event.target.value }))
            }
          />
        </label>
        <label>
          <span>Color</span>
          <input
            value={form.color}
            onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))}
            placeholder="#rrggbb"
          />
        </label>
        <label>
          <span>Source</span>
          <input
            value={form.source}
            onChange={(event) => setForm((prev) => ({ ...prev, source: event.target.value }))}
          />
        </label>
        <label>
          <span>Comments</span>
          <textarea
            rows={3}
            value={form.comments}
            onChange={(event) => setForm((prev) => ({ ...prev, comments: event.target.value }))}
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
            {editorSubmitLabel(isEdit, activeMutation.isPending, "Add frame type")}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
