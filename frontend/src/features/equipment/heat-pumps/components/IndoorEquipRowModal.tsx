import { useState } from "react";
import { errorMessage } from "../../../../shared/lib/errors";
import { ModalDialog } from "../../../../shared/ui/ModalDialog";
import { numericValue, tagCollides } from "../lib";
import { HEAT_PUMP_OPTION_KEYS, type HeatPumpIndoorEquipRow, type HeatPumpsSlice } from "../types";
import { OptionPicker } from "./OptionPicker";

export function IndoorEquipRowModal({
  mode,
  row,
  existingEquip = [],
  options,
  onCancel,
  onSubmit,
  onDelete,
  onCreateOption,
  readOnly,
}: {
  mode: "add" | "edit";
  row: HeatPumpIndoorEquipRow;
  existingEquip?: HeatPumpIndoorEquipRow[];
  options: HeatPumpsSlice["single_select_options"];
  onCancel: () => void;
  onSubmit: (row: HeatPumpIndoorEquipRow) => Promise<void>;
  onDelete?: () => void;
  onCreateOption?: (
    optionKey:
      | typeof HEAT_PUMP_OPTION_KEYS.manufacturer
      | typeof HEAT_PUMP_OPTION_KEYS.modelType
      | typeof HEAT_PUMP_OPTION_KEYS.installType,
    label: string,
  ) => Promise<string>;
  readOnly: boolean;
}) {
  const [draft, setDraft] = useState(row);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const manufacturerOptions = options[HEAT_PUMP_OPTION_KEYS.manufacturer] ?? [];
  const modelTypeOptions = options[HEAT_PUMP_OPTION_KEYS.modelType] ?? [];
  const installTypeOptions = options[HEAT_PUMP_OPTION_KEYS.installType] ?? [];
  const title =
    mode === "add" ? "New indoor equipment" : `Indoor equipment: ${row.tag || "(unnamed)"}`;
  const submitLabel = mode === "add" ? "Create indoor equipment" : "Save indoor equipment";

  const save = async () => {
    setError(null);
    const trimmedTag = draft.tag.trim();
    if (!trimmedTag) {
      setError("Tag is required.");
      return;
    }
    if (mode === "edit" && tagCollides(trimmedTag, existingEquip, row.id)) {
      setError(`Tag "${trimmedTag}" is already in use by another indoor equipment row.`);
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
        tag: trimmedTag,
        model_number: draft.model_number?.trim() || null,
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
        <section className="hp-modal-section">
          <h3>Identity</h3>
          <div className="hp-form-grid">
            <label>
              Tag
              <input
                required
                value={draft.tag}
                onChange={(event) => setDraft({ ...draft, tag: event.target.value })}
                disabled={readOnly}
              />
            </label>
            <OptionPicker
              label="Manufacturer"
              value={draft.manufacturer}
              options={manufacturerOptions}
              onChange={(manufacturer) => setDraft({ ...draft, manufacturer })}
              onCreate={
                onCreateOption
                  ? (label) => onCreateOption(HEAT_PUMP_OPTION_KEYS.manufacturer, label)
                  : undefined
              }
              disabled={readOnly}
            />
            <OptionPicker
              label="Model type"
              value={draft.model_type}
              options={modelTypeOptions}
              onChange={(model_type) => setDraft({ ...draft, model_type })}
              onCreate={
                onCreateOption
                  ? (label) => onCreateOption(HEAT_PUMP_OPTION_KEYS.modelType, label)
                  : undefined
              }
              disabled={readOnly}
            />
            <label>
              Model number
              <input
                value={draft.model_number ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, model_number: event.target.value || null })
                }
                disabled={readOnly}
              />
            </label>
            <OptionPicker
              label="Install type"
              value={draft.install_type}
              options={installTypeOptions}
              onChange={(install_type) => setDraft({ ...draft, install_type })}
              onCreate={
                onCreateOption
                  ? (label) => onCreateOption(HEAT_PUMP_OPTION_KEYS.installType, label)
                  : undefined
              }
              disabled={readOnly}
            />
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
              label="Cooling capacity (kW)"
              value={draft.cooling_btuh}
              onChange={(cooling_btuh) => setDraft({ ...draft, cooling_btuh })}
              readOnly={readOnly}
            />
            <NumberInput
              label="Heating capacity (kW)"
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
