import { useState } from "react";
import { errorMessage } from "../../../../shared/lib/errors";
import { ModalDialog } from "../../../../shared/ui/ModalDialog";
import { outdoorEquipLabel, tagCollides } from "../lib";
import {
  HEAT_PUMP_OPTION_KEYS,
  type HeatPumpOutdoorEquipRow,
  type HeatPumpOutdoorUnitRow,
  type HeatPumpsSlice,
} from "../types";

export function OutdoorUnitRowModal({
  mode,
  row,
  outdoorEquip,
  existingUnits,
  options,
  onCancel,
  onSubmit,
  onDelete,
  onCreateOutdoorEquip,
  readOnly,
}: {
  mode: "add" | "edit";
  row: HeatPumpOutdoorUnitRow;
  outdoorEquip: HeatPumpOutdoorEquipRow[];
  existingUnits: HeatPumpOutdoorUnitRow[];
  options: HeatPumpsSlice["single_select_options"];
  onCancel: () => void;
  onSubmit: (row: HeatPumpOutdoorUnitRow) => Promise<void>;
  onDelete?: () => void;
  onCreateOutdoorEquip: () => void;
  readOnly: boolean;
}) {
  const [draft, setDraft] = useState(row);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const manufacturerOptions = options[HEAT_PUMP_OPTION_KEYS.manufacturer] ?? [];
  const title = mode === "add" ? "New outdoor unit" : `Outdoor unit: ${row.tag || "(unnamed)"}`;
  const submitLabel = mode === "add" ? "Create outdoor unit" : "Save outdoor unit";

  const save = async () => {
    setError(null);
    const trimmedTag = draft.tag.trim();
    if (!trimmedTag) {
      setError("Tag is required.");
      return;
    }
    if (!draft.outdoor_equip_id) {
      setError("Select an equipment row.");
      return;
    }
    if (mode === "edit" && tagCollides(trimmedTag, existingUnits, row.id)) {
      setError(`Tag "${trimmedTag}" is already in use by another outdoor unit.`);
      return;
    }
    setIsSaving(true);
    try {
      await onSubmit({
        ...draft,
        tag: trimmedTag,
      });
    } catch (err) {
      setError(errorMessage(err, "Could not save outdoor unit."));
      setIsSaving(false);
    }
  };

  return (
    <ModalDialog title={title} titleId="hp-outdoor-unit-title" onClose={onCancel}>
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
            <label className="hp-form-grid__wide">
              Outdoor equipment
              <select
                value={draft.outdoor_equip_id}
                onChange={(event) => setDraft({ ...draft, outdoor_equip_id: event.target.value })}
                disabled={readOnly}
              >
                <option value="">Select an outdoor equipment row…</option>
                {outdoorEquip.map((equip) => (
                  <option key={equip.id} value={equip.id}>
                    {outdoorEquipLabel(equip, manufacturerOptions)}
                  </option>
                ))}
              </select>
            </label>
            {!readOnly ? (
              <button
                type="button"
                className="secondary-button hp-inline-action"
                onClick={onCreateOutdoorEquip}
              >
                Create new outdoor equipment
              </button>
            ) : null}
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
              Delete outdoor unit
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
