import { useMemo, useState } from "react";
import { errorMessage } from "../../../../shared/lib/errors";
import { ModalDialog } from "../../../../shared/ui/ModalDialog";
import type { RoomRow, VentilatorRow } from "../../types";
import {
  indoorEquipLabel,
  optionIdFromLabel,
  optionLabelFromId,
  outdoorUnitLabel,
  roomLabel,
  tagCollides,
  ventilatorLabel,
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
  ventilators,
  rooms,
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
  ventilators: VentilatorRow[];
  rooms: RoomRow[];
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
  const noVentilators = ventilators.length === 0;
  const sortedVentilators = useMemo(
    () => [...ventilators].sort((a, b) => ventilatorLabel(a).localeCompare(ventilatorLabel(b))),
    [ventilators],
  );
  const sortedRooms = useMemo(
    () => [...rooms].sort((a, b) => roomLabel(a).localeCompare(roomLabel(b))),
    [rooms],
  );
  const selectedRoomIds = new Set(draft.served_room_ids);

  // Functional updater — rapid concurrent toggles each compute against the
  // freshest draft instead of the closure's captured value, so two
  // checkbox clicks in the same animation frame both land.
  const toggleRoom = (roomId: string) => {
    setDraft((prev) => {
      const next = new Set(prev.served_room_ids);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return { ...prev, served_room_ids: Array.from(next) };
    });
  };

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
              Linked ERV unit
              <select
                value={draft.linked_erv_unit_id ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, linked_erv_unit_id: event.target.value || null })
                }
                disabled={readOnly || noVentilators}
              >
                <option value="">{noVentilators ? "No ERVs yet" : "None"}</option>
                {sortedVentilators.map((vent) => (
                  <option key={vent.id} value={vent.id}>
                    {ventilatorLabel(vent)}
                  </option>
                ))}
              </select>
              {noVentilators ? (
                <small className="hp-helper-text">Add an ERV first under Equipment → ERVs.</small>
              ) : null}
            </label>
            <fieldset className="hp-form-grid__wide hp-rooms-picker">
              <legend>Served rooms</legend>
              {sortedRooms.length === 0 ? (
                <small className="hp-helper-text">Add a room first under Rooms.</small>
              ) : (
                <ul className="hp-rooms-picker__list">
                  {sortedRooms.map((room) => (
                    <li key={room.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={selectedRoomIds.has(room.id)}
                          disabled={readOnly}
                          onChange={() => toggleRoom(room.id)}
                        />
                        {roomLabel(room)}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
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
