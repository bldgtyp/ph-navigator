import { type FormEvent, useEffect, useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { useCreateGlazingTypeMutation, useUpdateGlazingTypeMutation } from "../hooks";
import type { CatalogGlazingType, CatalogGlazingTypeCreatePayload } from "../types";
import {
  editorSubmitLabel,
  hasInvalidNumber,
  numberOrEmpty,
  parseOptionalNumber,
  stringOrEmpty,
  todayIso,
  trimToNull,
} from "./form-helpers";

type FormState = {
  name: string;
  manufacturer: string;
  brand: string;
  version_label: string;
  version_date: string;
  u_value_w_m2k: string;
  g_value: string;
  argb_color: string;
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
    u_value_w_m2k: "",
    g_value: "",
    argb_color: "",
    notes: "",
    source_provenance: "",
  };
}

function formFromRecord(record: CatalogGlazingType): FormState {
  return {
    name: record.name,
    manufacturer: stringOrEmpty(record.manufacturer),
    brand: stringOrEmpty(record.brand),
    version_label: record.version_label,
    version_date: record.version_date,
    u_value_w_m2k: numberOrEmpty(record.u_value_w_m2k),
    g_value: numberOrEmpty(record.g_value),
    argb_color: stringOrEmpty(record.argb_color),
    notes: stringOrEmpty(record.notes),
    source_provenance: stringOrEmpty(record.source_provenance),
  };
}

function toCreatePayload(form: FormState): CatalogGlazingTypeCreatePayload {
  const payload: CatalogGlazingTypeCreatePayload = {
    name: form.name.trim(),
    manufacturer: trimToNull(form.manufacturer),
    brand: trimToNull(form.brand),
    version_label: form.version_label.trim() || "v1",
    u_value_w_m2k: parseOptionalNumber(form.u_value_w_m2k),
    g_value: parseOptionalNumber(form.g_value),
    argb_color: trimToNull(form.argb_color),
    notes: trimToNull(form.notes),
    source_provenance: trimToNull(form.source_provenance),
  };
  if (form.version_date) payload.version_date = form.version_date;
  return payload;
}

export function GlazingTypeEditorModal({
  record,
  onClose,
  onSaved,
}: {
  record: CatalogGlazingType | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(() =>
    record ? formFromRecord(record) : emptyForm(),
  );
  const isEdit = record !== null;
  const createMutation = useCreateGlazingTypeMutation();
  const updateMutation = useUpdateGlazingTypeMutation();
  const activeMutation = isEdit ? updateMutation : createMutation;

  useEffect(() => {
    setForm(record ? formFromRecord(record) : emptyForm());
  }, [record]);

  const canSubmit =
    form.name.trim().length > 0 &&
    !hasInvalidNumber([form.u_value_w_m2k, form.g_value]) &&
    !activeMutation.isPending;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    const payload = toCreatePayload(form);
    if (isEdit && record) {
      updateMutation.mutate({ id: record.id, payload }, { onSuccess: onSaved });
    } else {
      createMutation.mutate(payload, { onSuccess: onSaved });
    }
  };

  const errorText = activeMutation.isError
    ? errorMessage(
        activeMutation.error,
        isEdit ? "Could not save glazing type." : "Could not create glazing type.",
      )
    : null;

  return (
    <ModalDialog
      title={isEdit ? "Edit glazing type" : "Add glazing type"}
      titleId="glazing-type-editor-title"
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
            placeholder="Cardinal, Saint-Gobain, …"
          />
        </label>
        <label>
          <span>Brand</span>
          <input
            value={form.brand}
            onChange={(event) => setForm((prev) => ({ ...prev, brand: event.target.value }))}
            placeholder="LoE-366, Climaguard, …"
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
          <span>U-value (W/m²·K)</span>
          <input
            inputMode="decimal"
            value={form.u_value_w_m2k}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, u_value_w_m2k: event.target.value }))
            }
          />
        </label>
        <label>
          <span>g-value / SHGC (0–1)</span>
          <input
            inputMode="decimal"
            value={form.g_value}
            onChange={(event) => setForm((prev) => ({ ...prev, g_value: event.target.value }))}
          />
        </label>
        <label>
          <span>ARGB color</span>
          <input
            value={form.argb_color}
            onChange={(event) => setForm((prev) => ({ ...prev, argb_color: event.target.value }))}
            placeholder="(180,180,220,235)"
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
            {editorSubmitLabel(isEdit, activeMutation.isPending, "Add glazing type")}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
