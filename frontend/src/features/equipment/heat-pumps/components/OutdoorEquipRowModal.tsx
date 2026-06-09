import { useState } from "react";
import { errorMessage } from "../../../../shared/lib/errors";
import { ModalDialog } from "../../../../shared/ui/ModalDialog";
import { indoorEquipLabel, numericValue, optionIdFromLabel, optionLabelFromId } from "../lib";
import type {
  CoolingDataType,
  HeatingDataType,
  HeatPumpIndoorEquipRow,
  HeatPumpOutdoorEquipRow,
} from "../types";

export function OutdoorEquipRowModal({
  mode,
  row,
  indoorEquip,
  onCancel,
  onSubmit,
  onDelete,
  onCreateIndoorEquip,
  readOnly,
}: {
  mode: "add" | "edit";
  row: HeatPumpOutdoorEquipRow;
  indoorEquip: HeatPumpIndoorEquipRow[];
  onCancel: () => void;
  onSubmit: (row: HeatPumpOutdoorEquipRow) => Promise<void>;
  onDelete?: () => void;
  onCreateIndoorEquip: () => void;
  readOnly: boolean;
}) {
  const [draft, setDraft] = useState(row);
  const [manufacturer, setManufacturer] = useState(optionLabelFromId(row.manufacturer));
  const [systemFamily, setSystemFamily] = useState(optionLabelFromId(row.system_family));
  const [refrigerant, setRefrigerant] = useState(optionLabelFromId(row.refrigerant));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const title = mode === "add" ? "New outdoor equipment" : `Outdoor equipment: ${row.model_number}`;

  const save = async () => {
    setError(null);
    if (!draft.model_number.trim()) {
      setError("Model number is required.");
      return;
    }
    setIsSaving(true);
    try {
      await onSubmit({
        ...draft,
        model_number: draft.model_number.trim(),
        manufacturer: optionIdFromLabel(manufacturer),
        system_family: optionIdFromLabel(systemFamily),
        refrigerant: optionIdFromLabel(refrigerant),
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
              Manufacturer
              <input
                value={manufacturer}
                onChange={(event) => setManufacturer(event.target.value)}
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
              System family
              <input
                value={systemFamily}
                onChange={(event) => setSystemFamily(event.target.value)}
                disabled={readOnly}
              />
            </label>
            <label>
              Refrigerant
              <input
                value={refrigerant}
                onChange={(event) => setRefrigerant(event.target.value)}
                disabled={readOnly}
              />
            </label>
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
                    {indoorEquipLabel(indoor)}
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
          <div className="hp-form-grid">
            <label>
              Data type
              <select
                value={draft.heating_data_type ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    heating_data_type: (event.target.value || null) as HeatingDataType | null,
                  })
                }
                disabled={readOnly}
              >
                <option value="">Not set</option>
                <option value="cops">COPs</option>
                <option value="hspf2">HSPF2</option>
              </select>
            </label>
            {draft.heating_data_type === "hspf2" ? (
              <NumberInput
                label="HSPF2"
                value={draft.hspf2}
                onChange={(hspf2) => setDraft({ ...draft, hspf2 })}
                readOnly={readOnly}
              />
            ) : (
              <>
                <NumberInput
                  label="Capacity at 17F kBtu/h"
                  value={draft.heating_cap_kbtuh_17f}
                  onChange={(heating_cap_kbtuh_17f) =>
                    setDraft({ ...draft, heating_cap_kbtuh_17f })
                  }
                  readOnly={readOnly}
                />
                <NumberInput
                  label="Capacity at 47F kBtu/h"
                  value={draft.heating_cap_kbtuh_47f}
                  onChange={(heating_cap_kbtuh_47f) =>
                    setDraft({ ...draft, heating_cap_kbtuh_47f })
                  }
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
              </>
            )}
          </div>
        </section>
        <section className="hp-modal-section">
          <h3>Cooling performance</h3>
          <div className="hp-form-grid">
            <label>
              Data type
              <select
                value={draft.cooling_data_type ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    cooling_data_type: (event.target.value || null) as CoolingDataType | null,
                  })
                }
                disabled={readOnly}
              >
                <option value="">Not set</option>
                <option value="eer2_seer2">EER2 / SEER2</option>
                <option value="ieer">IEER</option>
              </select>
            </label>
            <NumberInput
              label="Capacity at 95F kBtu/h"
              value={draft.cooling_cap_kbtuh_95f}
              onChange={(cooling_cap_kbtuh_95f) => setDraft({ ...draft, cooling_cap_kbtuh_95f })}
              readOnly={readOnly}
            />
            {draft.cooling_data_type === "ieer" ? (
              <NumberInput
                label="IEER"
                value={draft.ieer}
                onChange={(ieer) => setDraft({ ...draft, ieer })}
                readOnly={readOnly}
              />
            ) : (
              <>
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
              </>
            )}
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
