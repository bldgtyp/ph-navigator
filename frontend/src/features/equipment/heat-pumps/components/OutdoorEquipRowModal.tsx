import { useState } from "react";
import { errorMessage } from "../../../../shared/lib/errors";
import { ModalDialog } from "../../../../shared/ui/ModalDialog";
import { indoorEquipLabel, numericValue, tagCollides } from "../lib";
import {
  HEAT_PUMP_OPTION_KEYS,
  type HeatPumpIndoorEquipRow,
  type HeatPumpOutdoorEquipRow,
  type HeatPumpsSlice,
} from "../types";
import { OptionPicker } from "./OptionPicker";

export function OutdoorEquipRowModal({
  mode,
  row,
  indoorEquip,
  existingEquip = [],
  options,
  onCancel,
  onSubmit,
  onDelete,
  onCreateIndoorEquip,
  onCreateOption,
  readOnly,
}: {
  mode: "add" | "edit";
  row: HeatPumpOutdoorEquipRow;
  indoorEquip: HeatPumpIndoorEquipRow[];
  existingEquip?: HeatPumpOutdoorEquipRow[];
  options: HeatPumpsSlice["single_select_options"];
  onCancel: () => void;
  onSubmit: (row: HeatPumpOutdoorEquipRow) => Promise<void>;
  onDelete?: () => void;
  onCreateIndoorEquip: () => void;
  onCreateOption?: (
    optionKey:
      | typeof HEAT_PUMP_OPTION_KEYS.manufacturer
      | typeof HEAT_PUMP_OPTION_KEYS.systemFamily
      | typeof HEAT_PUMP_OPTION_KEYS.refrigerant,
    label: string,
  ) => Promise<string>;
  readOnly: boolean;
}) {
  const [draft, setDraft] = useState(row);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const title =
    mode === "add" ? "New outdoor equipment" : `Outdoor equipment: ${row.tag || "(unnamed)"}`;
  const manufacturerOptions = options[HEAT_PUMP_OPTION_KEYS.manufacturer] ?? [];
  const systemFamilyOptions = options[HEAT_PUMP_OPTION_KEYS.systemFamily] ?? [];
  const refrigerantOptions = options[HEAT_PUMP_OPTION_KEYS.refrigerant] ?? [];

  const save = async () => {
    setError(null);
    const trimmedTag = draft.tag.trim();
    if (!trimmedTag) {
      setError("Tag is required.");
      return;
    }
    if (mode === "edit" && tagCollides(trimmedTag, existingEquip, row.id)) {
      setError(`Tag "${trimmedTag}" is already in use by another outdoor equipment row.`);
      return;
    }
    const trimmedModel = draft.model_number?.trim() || null;
    setIsSaving(true);
    try {
      await onSubmit({
        ...draft,
        tag: trimmedTag,
        model_number: trimmedModel,
      });
    } catch (err) {
      setError(errorMessage(err, "Could not save outdoor equipment."));
      setIsSaving(false);
    }
  };

  return (
    <ModalDialog title={title} titleId="hp-outdoor-equip-title" onClose={onCancel}>
      <form
        className="project-form hp-modal-form"
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
              label="System family"
              value={draft.system_family}
              options={systemFamilyOptions}
              onChange={(system_family) => setDraft({ ...draft, system_family })}
              onCreate={
                onCreateOption
                  ? (label) => onCreateOption(HEAT_PUMP_OPTION_KEYS.systemFamily, label)
                  : undefined
              }
              disabled={readOnly}
            />
            <OptionPicker
              label="Refrigerant"
              value={draft.refrigerant}
              options={refrigerantOptions}
              onChange={(refrigerant) => setDraft({ ...draft, refrigerant })}
              onCreate={
                onCreateOption
                  ? (label) => onCreateOption(HEAT_PUMP_OPTION_KEYS.refrigerant, label)
                  : undefined
              }
              disabled={readOnly}
            />
            <label className="hp-form-grid__wide">
              Paired indoor equipment
              <select
                value={draft.paired_indoor_equip_id ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, paired_indoor_equip_id: event.target.value || null })
                }
                disabled={readOnly}
              >
                <option value="">None / VRF or multi-indoor</option>
                {indoorEquip.map((indoor) => (
                  <option key={indoor.id} value={indoor.id}>
                    {indoorEquipLabel(indoor, manufacturerOptions)}
                  </option>
                ))}
              </select>
            </label>
            {!readOnly ? (
              <button
                type="button"
                className="secondary-button hp-inline-action"
                onClick={onCreateIndoorEquip}
              >
                Create new indoor equipment
              </button>
            ) : null}
          </div>
        </section>
        <section className="hp-modal-section">
          <h3>Heating performance</h3>
          {/* All fields shown unconditionally — users fill in only the
              ratings they care about. The Phius export warns when neither
              the COP-table nor the HSPF2 path is populated. */}
          <div className="hp-form-grid">
            <NumberInput
              label="Capacity at 17F (kW)"
              value={draft.heating_cap_kw_17f}
              onChange={(heating_cap_kw_17f) => setDraft({ ...draft, heating_cap_kw_17f })}
              readOnly={readOnly}
            />
            <NumberInput
              label="Capacity at 47F (kW)"
              value={draft.heating_cap_kw_47f}
              onChange={(heating_cap_kw_47f) => setDraft({ ...draft, heating_cap_kw_47f })}
              readOnly={readOnly}
            />
            <NumberInput
              label="COP at 17F"
              value={draft.heating_cop_17f}
              onChange={(heating_cop_17f) => setDraft({ ...draft, heating_cop_17f })}
              readOnly={readOnly}
            />
            <NumberInput
              label="COP at 47F"
              value={draft.heating_cop_47f}
              onChange={(heating_cop_47f) => setDraft({ ...draft, heating_cop_47f })}
              readOnly={readOnly}
            />
            <NumberInput
              label="HSPF2"
              value={draft.hspf2}
              onChange={(hspf2) => setDraft({ ...draft, hspf2 })}
              readOnly={readOnly}
            />
          </div>
        </section>
        <section className="hp-modal-section">
          <h3>Cooling performance</h3>
          <div className="hp-form-grid">
            <NumberInput
              label="Capacity at 95F (kW)"
              value={draft.cooling_cap_kw_95f}
              onChange={(cooling_cap_kw_95f) => setDraft({ ...draft, cooling_cap_kw_95f })}
              readOnly={readOnly}
            />
            <NumberInput
              label="EER2"
              value={draft.eer2}
              onChange={(eer2) => setDraft({ ...draft, eer2 })}
              readOnly={readOnly}
            />
            <NumberInput
              label="SEER2"
              value={draft.seer2}
              onChange={(seer2) => setDraft({ ...draft, seer2 })}
              readOnly={readOnly}
            />
            <NumberInput
              label="IEER"
              value={draft.ieer}
              onChange={(ieer) => setDraft({ ...draft, ieer })}
              readOnly={readOnly}
            />
          </div>
        </section>
        <details className="hp-modal-section">
          <summary>Legacy ratings</summary>
          <div className="hp-form-grid">
            <NumberInput
              label="HSPF"
              value={draft.hspf}
              onChange={(hspf) => setDraft({ ...draft, hspf })}
              readOnly={readOnly}
            />
            <NumberInput
              label="EER"
              value={draft.eer}
              onChange={(eer) => setDraft({ ...draft, eer })}
              readOnly={readOnly}
            />
            <NumberInput
              label="SEER"
              value={draft.seer}
              onChange={(seer) => setDraft({ ...draft, seer })}
              readOnly={readOnly}
            />
          </div>
        </details>
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
              Delete outdoor equipment
            </button>
          ) : null}
          <button type="button" className="secondary-button" onClick={onCancel}>
            {readOnly ? "Close" : "Cancel"}
          </button>
          {!readOnly ? (
            <button type="submit" disabled={isSaving}>
              Save outdoor equipment
            </button>
          ) : null}
        </div>
      </form>
    </ModalDialog>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  readOnly: boolean;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        min="0"
        step="0.01"
        value={value ?? ""}
        onChange={(event) => onChange(numericValue(event.target.value))}
        disabled={readOnly}
      />
    </label>
  );
}
