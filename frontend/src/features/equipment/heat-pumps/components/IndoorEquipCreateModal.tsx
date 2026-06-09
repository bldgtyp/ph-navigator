import { useState } from "react";
import { errorMessage } from "../../../../shared/lib/errors";
import { ModalDialog } from "../../../../shared/ui/ModalDialog";
import {
  buildEmptyIndoorEquipRow,
  numericValue,
  optionIdFromLabel,
  optionLabelFromId,
} from "../lib";
import type { HeatPumpIndoorEquipRow } from "../types";

export function IndoorEquipCreateModal({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (row: HeatPumpIndoorEquipRow) => Promise<void>;
}) {
  const [draft, setDraft] = useState(buildEmptyIndoorEquipRow());
  const [manufacturer, setManufacturer] = useState(optionLabelFromId(draft.manufacturer));
  const [modelType, setModelType] = useState(optionLabelFromId(draft.model_type));
  const [installType, setInstallType] = useState(optionLabelFromId(draft.install_type));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
        model_type: optionIdFromLabel(modelType),
        install_type: optionIdFromLabel(installType),
      });
    } catch (err) {
      setError(errorMessage(err, "Could not create indoor equipment."));
      setIsSaving(false);
    }
  };

  return (
    <ModalDialog title="New indoor equipment" titleId="hp-indoor-create-title" onClose={onCancel}>
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
        <div className="hp-form-grid">
          <label>
            Manufacturer
            <input value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} />
          </label>
          <label>
            Model type
            <input value={modelType} onChange={(event) => setModelType(event.target.value)} />
          </label>
          <label>
            Model number
            <input
              required
              value={draft.model_number}
              onChange={(event) => setDraft({ ...draft, model_number: event.target.value })}
            />
          </label>
          <label>
            Install type
            <input value={installType} onChange={(event) => setInstallType(event.target.value)} />
          </label>
          <label>
            Nominal tons
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.nominal_tons ?? ""}
              onChange={(event) =>
                setDraft({ ...draft, nominal_tons: numericValue(event.target.value) })
              }
            />
          </label>
          <label>
            Cooling Btu/h
            <input
              type="number"
              min="0"
              step="1"
              value={draft.cooling_btuh ?? ""}
              onChange={(event) =>
                setDraft({ ...draft, cooling_btuh: numericValue(event.target.value) })
              }
            />
          </label>
          <label>
            Heating Btu/h at 47F
            <input
              type="number"
              min="0"
              step="1"
              value={draft.heating_btuh_47f ?? ""}
              onChange={(event) =>
                setDraft({ ...draft, heating_btuh_47f: numericValue(event.target.value) })
              }
            />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={isSaving}>
            Create indoor equipment
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
