import { useState } from "react";
import { errorMessage } from "../../../../shared/lib/errors";
import { ModalDialog } from "../../../../shared/ui/ModalDialog";
import {
  indoorEquipLabel,
  optionIdFromLabel,
  optionLabelFromId,
  outdoorUnitLabel,
  tagCollides,
} from "../lib";
import type {
  HeatPumpIndoorEquipRow,
  HeatPumpIndoorUnitRow,
  HeatPumpOutdoorUnitRow,
} from "../types";

export function IndoorUnitRowModal({
  mode,
  row,
  indoorEquip,
  outdoorUnits,
  existingUnits,
  onCancel,
  onSubmit,
  onDelete,
  onCreateIndoorEquip,
  readOnly,
}: {
  mode: "add" | "edit";
  row: HeatPumpIndoorUnitRow;
  indoorEquip: HeatPumpIndoorEquipRow[];
  outdoorUnits: HeatPumpOutdoorUnitRow[];
  existingUnits: HeatPumpIndoorUnitRow[];
  onCancel: () => void;
  onSubmit: (row: HeatPumpIndoorUnitRow) => Promise<void>;
  onDelete?: () => void;
  onCreateIndoorEquip: () => void;
  readOnly: boolean;
}) {
  const [draft, setDraft] = useState(row);
  const [floorLevel, setFloorLevel] = useState(optionLabelFromId(row.floor_level));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const title = mode === "add" ? "New indoor unit" : `Indoor unit: ${row.tag || "(unnamed)"}`;
  const submitLabel = mode === "add" ? "Create indoor unit" : "Save indoor unit";
  const noOutdoorUnits = outdoorUnits.length === 0;

  const save = async () => {
    setError(null);
    const trimmedTag = draft.tag.trim();
    if (!trimmedTag) {
      setError("Tag is required.");
      return;
    }
    if (!draft.indoor_equip_id) {
      setError("Select an equipment row.");
      return;
    }
    if (mode === "edit" && tagCollides(trimmedTag, existingUnits, row.id)) {
      setError(`Tag "${trimmedTag}" is already in use by another indoor unit.`);
      return;
    }
    setIsSaving(true);
    try {
      await onSubmit({
        ...draft,
        tag: trimmedTag,
        area_served: draft.area_served?.trim() || null,
        floor_level: optionIdFromLabel(floorLevel),
      });
    } catch (err) {
      setError(errorMessage(err, "Could not save indoor unit."));
      setIsSaving(false);
    }
  };

  return (
    <ModalDialog title={title} titleId="hp-indoor-unit-title" onClose={onCancel}>
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
            <label>
              Floor
              <input
                value={floorLevel}
                onChange={(event) => setFloorLevel(event.target.value)}
                disabled={readOnly}
              />
            </label>
            <label className="hp-form-grid__wide">
              Indoor equipment
              <select
                value={draft.indoor_equip_id}
                onChange={(event) => setDraft({ ...draft, indoor_equip_id: event.target.value })}
                disabled={readOnly}
              >
                <option value="">Select an indoor equipment row…</option>
                {indoorEquip.map((equip) => (
                  <option key={equip.id} value={equip.id}>
                    {indoorEquipLabel(equip)}
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
            <label className="hp-form-grid__wide">
              Outdoor unit
              <select
                value={draft.outdoor_unit_id ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, outdoor_unit_id: event.target.value || null })
                }
                disabled={readOnly || noOutdoorUnits}
              >
                <option value="">{noOutdoorUnits ? "No outdoor units yet" : "None"}</option>
                {outdoorUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {outdoorUnitLabel(unit)}
                  </option>
                ))}
              </select>
              {noOutdoorUnits ? (
                <small className="hp-helper-text">
                  Add an outdoor unit first in Units — Outdoor.
                </small>
              ) : null}
            </label>
            <label className="hp-form-grid__wide">
              Area served
              <input
                value={draft.area_served ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, area_served: event.target.value || null })
                }
                disabled={readOnly}
              />
            </label>
            <label className="hp-form-grid__wide">
              Linked ERV unit <span className="hp-future-badge">Configured in Phase 4</span>
              <select value={draft.linked_erv_unit_id ?? ""} disabled>
                <option value="">{draft.linked_erv_unit_id ?? "None"}</option>
              </select>
            </label>
            <label className="hp-form-grid__wide">
              Served rooms <span className="hp-future-badge">Configured in Phase 4</span>
              <input value={draft.served_room_ids.join(", ")} disabled />
            </label>
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
              Delete indoor unit
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
