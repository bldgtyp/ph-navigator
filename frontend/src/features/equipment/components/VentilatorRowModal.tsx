import { useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { customNumberValue, customTextValue } from "../lib/customValueReaders";
import {
  VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY,
  type VentilatorRow,
  type VentilatorsSlice,
} from "../types";

export function VentilatorRowModal({
  row,
  options,
  readOnly,
  onCancel,
  onSubmit,
}: {
  row: VentilatorRow;
  options: VentilatorsSlice["single_select_options"];
  readOnly: boolean;
  onCancel: () => void;
  onSubmit: (row: VentilatorRow) => Promise<void>;
}) {
  const [draft, setDraft] = useState(row);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const insideOutsideOptions = options[VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY] ?? [];
  const title = `Ventilator: ${customTextValue(row, "record_id") || "(unnamed)"}`;

  const save = async () => {
    setError(null);
    setIsSaving(true);
    try {
      await onSubmit(draft);
    } catch (err) {
      setError(errorMessage(err, "Could not save ventilator."));
      setIsSaving(false);
    }
  };

  return (
    <ModalDialog title={title} titleId="ventilator-row-title" onClose={onCancel}>
      <form
        className="project-form hp-modal-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <section className="hp-modal-section">
          <h3>Identity</h3>
          <div className="hp-form-grid">
            <TextField
              label="Tag"
              value={customTextValue(draft, "record_id")}
              disabled={readOnly}
              onChange={(value) => setCustomValue(setDraft, draft, "record_id", value)}
            />
            <TextField
              label="Name"
              value={customTextValue(draft, "name")}
              disabled={readOnly}
              onChange={(value) => setCustomValue(setDraft, draft, "name", value)}
            />
            <TextField
              label="Manufacturer"
              value={customTextValue(draft, "manufacturer")}
              disabled={readOnly}
              onChange={(value) => setCustomValue(setDraft, draft, "manufacturer", value)}
            />
            <TextField
              label="Model"
              value={customTextValue(draft, "model")}
              disabled={readOnly}
              onChange={(value) => setCustomValue(setDraft, draft, "model", value)}
            />
            <label>
              Inside / Outside
              <select
                value={draft.inside_outside ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, inside_outside: event.target.value || null })
                }
                disabled={readOnly}
              >
                <option value="">Unassigned</option>
                {insideOutsideOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label="URL"
              value={draft.url ?? ""}
              disabled={readOnly}
              className="hp-form-grid__wide"
              onChange={(value) => setDraft({ ...draft, url: value })}
            />
          </div>
        </section>
        <section className="hp-modal-section">
          <h3>Performance</h3>
          <div className="hp-form-grid">
            <NumberField
              label="Airflow Rate"
              value={customNumberValue(draft, "airflow_rate_m3h")}
              disabled={readOnly}
              onChange={(value) => setCustomValue(setDraft, draft, "airflow_rate_m3h", value)}
            />
            <NumberField
              label="Heat Recovery %"
              value={customNumberValue(draft, "heat_recovery_percent")}
              disabled={readOnly}
              onChange={(value) => setCustomValue(setDraft, draft, "heat_recovery_percent", value)}
            />
            <NumberField
              label="Moisture Recovery %"
              value={customNumberValue(draft, "moisture_recovery_percent")}
              disabled={readOnly}
              onChange={(value) =>
                setCustomValue(setDraft, draft, "moisture_recovery_percent", value)
              }
            />
            <NumberField
              label="Electrical Efficiency"
              value={customNumberValue(draft, "electrical_efficiency_wh_m3")}
              disabled={readOnly}
              onChange={(value) =>
                setCustomValue(setDraft, draft, "electrical_efficiency_wh_m3", value)
              }
            />
            <NumberField
              label="Filter MERV Rating"
              value={customNumberValue(draft, "filter_merv_rating")}
              disabled={readOnly}
              onChange={(value) => setCustomValue(setDraft, draft, "filter_merv_rating", value)}
            />
          </div>
        </section>
        <label>
          Notes
          <textarea
            rows={4}
            value={draft.notes ?? ""}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value || null })}
            disabled={readOnly}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            {readOnly ? "Close" : "Cancel"}
          </button>
          {!readOnly ? (
            <button type="submit" disabled={isSaving}>
              Save ventilator
            </button>
          ) : null}
        </div>
      </form>
    </ModalDialog>
  );
}

function TextField({
  label,
  value,
  disabled,
  className,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  className?: string;
  onChange: (value: string | null) => void;
}) {
  return (
    <label className={className}>
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value || null)}
        disabled={disabled}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number | null;
  disabled: boolean;
  onChange: (value: number | null) => void;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        value={value ?? ""}
        onChange={(event) => onChange(readNumberInput(event.target.value))}
        disabled={disabled}
      />
    </label>
  );
}

function setCustomValue(
  setDraft: (next: VentilatorRow) => void,
  draft: VentilatorRow,
  fieldKey: string,
  value: string | number | null,
) {
  setDraft({
    ...draft,
    custom_values: {
      ...draft.custom_values,
      [fieldKey]: value,
    },
  });
}

function readNumberInput(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
