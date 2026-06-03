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
  todayIso,
  trimToNull,
} from "./form-helpers";
import { lengthUnitLabel, psiUnitLabel, uValueUnitLabel } from "./unit-labels";

type FormState = {
  name: string;
  manufacturer: string;
  brand: string;
  version_label: string;
  version_date: string;
  width_mm: string;
  u_value_w_m2k: string;
  psi_g_w_mk: string;
  psi_install_w_mk: string;
  color: string;
  notes: string;
  source_provenance: string;
};

function emptyForm(): FormState {
  return {
    name: "",
    manufacturer: "",
    brand: "",
    version_label: "v1",
    version_date: todayIso(),
    width_mm: "",
    u_value_w_m2k: "",
    psi_g_w_mk: "",
    psi_install_w_mk: "",
    color: "",
    notes: "",
    source_provenance: "",
  };
}

function formFromRecord(record: CatalogFrameType, unitOptions: UnitFormatOptions): FormState {
  return {
    name: record.name,
    manufacturer: stringOrEmpty(record.manufacturer),
    brand: stringOrEmpty(record.brand),
    version_label: record.version_label,
    version_date: record.version_date,
    width_mm: formatLengthFromMm(record.width_mm, unitOptions),
    u_value_w_m2k: formatUValueFromWm2K(record.u_value_w_m2k, unitOptions),
    psi_g_w_mk: formatLinearPsiFromWmK(record.psi_g_w_mk, unitOptions),
    psi_install_w_mk: formatLinearPsiFromWmK(record.psi_install_w_mk, unitOptions),
    color: stringOrEmpty(record.color),
    notes: stringOrEmpty(record.notes),
    source_provenance: stringOrEmpty(record.source_provenance),
  };
}

function toCreatePayload(
  form: FormState,
  unitOptions: UnitFormatOptions,
): CatalogFrameTypeCreatePayload {
  const payload: CatalogFrameTypeCreatePayload = {
    name: form.name.trim(),
    manufacturer: trimToNull(form.manufacturer),
    brand: trimToNull(form.brand),
    version_label: form.version_label.trim() || "v1",
    width_mm: parseOptionalUnitNumber(form.width_mm, parseLengthToMm, unitOptions),
    u_value_w_m2k: parseOptionalUnitNumber(form.u_value_w_m2k, parseUValueToWm2K, unitOptions),
    psi_g_w_mk: parseOptionalUnitNumber(form.psi_g_w_mk, parseLinearPsiToWmK, unitOptions),
    psi_install_w_mk: parseOptionalUnitNumber(
      form.psi_install_w_mk,
      parseLinearPsiToWmK,
      unitOptions,
    ),
    color: colorToNull(form.color),
    notes: trimToNull(form.notes),
    source_provenance: trimToNull(form.source_provenance),
  };
  // version_date is NOT NULL in storage. On create, backend defaults to today
  // when omitted; on update, omit to preserve the existing value.
  if (form.version_date) payload.version_date = form.version_date;
  return payload;
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
            {editorSubmitLabel(isEdit, activeMutation.isPending, "Add frame type")}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
