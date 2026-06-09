import { useState } from "react";
import { errorMessage } from "../../../../shared/lib/errors";
import { ModalDialog } from "../../../../shared/ui/ModalDialog";
import { INSTALL_TYPE_SEED_OPTIONS } from "../install-type-options";
import { numericValue, optionIdFromLabel, optionLabelFromId } from "../lib";
import type { HeatPumpIndoorEquipRow } from "../types";

const INSTALL_TYPE_DATALIST_ID = "hp-indoor-install-type-options";

export function IndoorEquipRowModal({
  mode,
  row,
  onCancel,
  onSubmit,
  onDelete,
  readOnly,
}: {
  mode: "add" | "edit";
  row: HeatPumpIndoorEquipRow;
  onCancel: () => void;
  onSubmit: (row: HeatPumpIndoorEquipRow) => Promise<void>;
  onDelete?: () => void;
  readOnly: boolean;
}) {
  const [draft, setDraft] = useState(row);
  const [manufacturer, setManufacturer] = useState(optionLabelFromId(row.manufacturer));
  const [modelType, setModelType] = useState(optionLabelFromId(row.model_type));
  const [installType, setInstallType] = useState(optionLabelFromId(row.install_type));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const title =
    mode === "add"
      ? "New indoor equipment"
      : `Indoor equipment: ${row.model_number || "(unnamed)"}`;
  const submitLabel = mode === "add" ? "Create indoor equipment" : "Save indoor equipment";

  const save = async () => {
    setError(null);
    if (!draft.model_number.trim()) {
      setError("Model number is required.");
      return;
    }
    if (negativeNumber(draft.nominal_tons, { strictlyPositive: true })) {
      setError("Nominal tons must be greater than 0 when set.");
      return;
    }
    if (
      negativeNumber(draft.fan_speed_cfm) ||
      negativeNumber(draft.cooling_btuh) ||
      negativeNumber(draft.heating_btuh_47f) ||
      negativeNumber(draft.heating_btuh_17f) ||
      negativeNumber(draft.heating_cop) ||
      negativeNumber(draft.seer) ||
      negativeNumber(draft.eer) ||
      negativeNumber(draft.hspf)
    ) {
      setError("Numeric fields must be 0 or greater when set.");
      return;
    }
    setIsSaving(true);
    try {
      await onSubmit({
        ...draft,
        model_number: draft.model_number.trim(),
        manufacturer: optionIdFromLabel(manufacturer),
        model_type: optionIdFromLabel(modelType),
        install_type: optionIdFromLabel(installType),
      });
    } catch (err) {
      setError(errorMessage(err, "Could not save indoor equipment."));
      setIsSaving(false);
    }
  };

  return (
    <ModalDialog title={title} titleId="hp-indoor-equip-title" onClose={onCancel}>
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
        <datalist id={INSTALL_TYPE_DATALIST_ID}>
          {INSTALL_TYPE_SEED_OPTIONS.map((option) => (
            <option key={option.id} value={option.label} />
          ))}
        </datalist>
        <section className="hp-modal-section">
          <h3>Identity</h3>
          <div className="hp-form-grid">
            <label>
              Manufacturer
              <input
                value={manufacturer}
                onChange={(event) => setManufacturer(event.target.value)}
                disabled={readOnly}
              />
            </label>
            <label>
              Model type
              <input
                value={modelType}
                onChange={(event) => setModelType(event.target.value)}
                disabled={readOnly}
              />
            </label>
            <label>
              Model number
              <input
                required
                value={draft.model_number}
                onChange={(event) => setDraft({ ...draft, model_number: event.target.value })}
                disabled={readOnly}
              />
            </label>
            <label>
              Install type
              <input
                list={INSTALL_TYPE_DATALIST_ID}
                value={installType}
                onChange={(event) => setInstallType(event.target.value)}
                disabled={readOnly}
              />
            </label>
          </div>
        </section>
        <section className="hp-modal-section">
          <h3>Performance</h3>
          <div className="hp-form-grid">
            <NumberInput
              label="Nominal tons"
              value={draft.nominal_tons}
              step={0.01}
              onChange={(nominal_tons) => setDraft({ ...draft, nominal_tons })}
              readOnly={readOnly}
            />
            <NumberInput
              label="Fan speed (CFM)"
              value={draft.fan_speed_cfm}
              onChange={(fan_speed_cfm) => setDraft({ ...draft, fan_speed_cfm })}
              readOnly={readOnly}
            />
            <NumberInput
              label="Cooling Btu/h"
              value={draft.cooling_btuh}
              onChange={(cooling_btuh) => setDraft({ ...draft, cooling_btuh })}
              readOnly={readOnly}
            />
            <NumberInput
              label="Heating Btu/h at 47F"
              value={draft.heating_btuh_47f}
              onChange={(heating_btuh_47f) => setDraft({ ...draft, heating_btuh_47f })}
              readOnly={readOnly}
            />
            <NumberInput
              label="Heating Btu/h at 17F"
              value={draft.heating_btuh_17f}
              onChange={(heating_btuh_17f) => setDraft({ ...draft, heating_btuh_17f })}
              readOnly={readOnly}
            />
            <NumberInput
              label="Heating COP"
              value={draft.heating_cop}
              step={0.01}
              onChange={(heating_cop) => setDraft({ ...draft, heating_cop })}
              readOnly={readOnly}
            />
            <NumberInput
              label="SEER"
              value={draft.seer}
              step={0.01}
              onChange={(seer) => setDraft({ ...draft, seer })}
              readOnly={readOnly}
            />
            <NumberInput
              label="EER"
              value={draft.eer}
              step={0.01}
              onChange={(eer) => setDraft({ ...draft, eer })}
              readOnly={readOnly}
            />
            <NumberInput
              label="HSPF"
              value={draft.hspf}
              step={0.01}
              onChange={(hspf) => setDraft({ ...draft, hspf })}
              readOnly={readOnly}
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
          {onDelete && !readOnly ? (
            <button type="button" className="danger-button" onClick={onDelete}>
              Delete indoor equipment
            </button>
          ) : null}
          <button type="button" className="secondary-button" onClick={onCancel}>
            {readOnly ? "Close" : "Cancel"}
          </button>
          {!readOnly ? (
            <button type="submit" disabled={isSaving}>
              {submitLabel}
            </button>
          ) : null}
        </div>
      </form>
    </ModalDialog>
  );
}

function negativeNumber(
  value: number | null,
  { strictlyPositive = false }: { strictlyPositive?: boolean } = {},
): boolean {
  if (value === null) return false;
  return strictlyPositive ? value <= 0 : value < 0;
}

function NumberInput({
  label,
  value,
  onChange,
  readOnly,
  step = 1,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  readOnly: boolean;
  step?: number;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        min="0"
        step={step}
        value={value ?? ""}
        onChange={(event) => onChange(numericValue(event.target.value))}
        disabled={readOnly}
      />
    </label>
  );
}
