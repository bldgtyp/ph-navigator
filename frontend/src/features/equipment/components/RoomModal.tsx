import { useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { setCustomValue } from "../../../shared/ui/data-table";
import { optionLabel } from "../lib";
import { customNumberValue, customTextValue } from "../lib/customValueReaders";
import {
  ROOM_BUILDING_ZONE_OPTION_KEY,
  ROOM_FLOOR_LEVEL_OPTION_KEY,
  type RoomRow,
  type RoomsSlice,
} from "../types";

export function RoomModal({
  title,
  room,
  roomsSlice,
  onCancel,
  onSubmit,
  frozenReason,
  onFrozenReload,
  onDelete,
  deleteDisabled = false,
}: {
  title: string;
  room: RoomRow;
  roomsSlice: RoomsSlice;
  onCancel: () => void;
  onSubmit: (room: RoomRow, labels: { floorLevel: string; buildingZone: string }) => Promise<void>;
  frozenReason?: string | null;
  onFrozenReload?: () => void;
  onDelete?: () => void;
  deleteDisabled?: boolean;
}) {
  const [draft, setDraft] = useState(room);
  const [floorLevel, setFloorLevel] = useState(
    optionLabel(roomsSlice.single_select_options[ROOM_FLOOR_LEVEL_OPTION_KEY], room.floor_level),
  );
  const [buildingZone, setBuildingZone] = useState(
    optionLabel(
      roomsSlice.single_select_options[ROOM_BUILDING_ZONE_OPTION_KEY],
      room.building_zone,
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isFrozen = Boolean(frozenReason);

  const save = async () => {
    setError(null);
    if (frozenReason) {
      setError(frozenReason);
      return;
    }
    if (!customTextValue(draft, "number").trim()) {
      setError("Room number is required.");
      return;
    }
    if (!customTextValue(draft, "name").trim()) {
      setError("Room name is required.");
      return;
    }
    if (!floorLevel.trim()) {
      setError("Floor level is required.");
      return;
    }
    setIsSaving(true);
    try {
      await onSubmit(draft, { floorLevel, buildingZone });
    } catch (err) {
      setError(errorMessage(err, "Could not save room."));
      setIsSaving(false);
    }
  };

  return (
    <ModalDialog title={title} titleId="room-modal-title" onClose={onCancel}>
      <form
        className="project-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {frozenReason ? (
          <div className="draft-banner draft-conflict-banner" role="alert">
            <span>{frozenReason}</span>
            {onFrozenReload ? (
              <button type="button" className="secondary-button" onClick={onFrozenReload}>
                Reload draft
              </button>
            ) : null}
          </div>
        ) : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="room-form-grid">
          <label>
            Number
            <input
              value={customTextValue(draft, "number")}
              onChange={(event) => setDraft(setCustomValue(draft, "number", event.target.value))}
              disabled={isFrozen}
              required
            />
          </label>
          <label>
            Name
            <input
              value={customTextValue(draft, "name")}
              onChange={(event) => setDraft(setCustomValue(draft, "name", event.target.value))}
              disabled={isFrozen}
              required
            />
          </label>
          <label>
            Floor level
            <input
              list="rooms-floor-level-options"
              value={floorLevel}
              onChange={(event) => setFloorLevel(event.target.value)}
              disabled={isFrozen}
              required
            />
          </label>
          <label>
            Building zone
            <input
              list="rooms-building-zone-options"
              value={buildingZone}
              onChange={(event) => setBuildingZone(event.target.value)}
              disabled={isFrozen}
            />
          </label>
          <label>
            People
            <input
              type="number"
              min="0"
              step="1"
              value={customNumberValue(draft, "num_people") ?? 0}
              onChange={(event) =>
                setDraft(
                  setCustomValue(
                    draft,
                    { field_key: "num_people" },
                    Number(event.target.value) || 0,
                  ),
                )
              }
              disabled={isFrozen}
            />
          </label>
          <label>
            Bedrooms
            <input
              type="number"
              min="0"
              step="1"
              value={customNumberValue(draft, "num_bedrooms") ?? 0}
              onChange={(event) =>
                setDraft(
                  setCustomValue(
                    draft,
                    { field_key: "num_bedrooms" },
                    Number(event.target.value) || 0,
                  ),
                )
              }
              disabled={isFrozen}
            />
          </label>
          <label>
            iCFA factor
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={draft.icfa_factor}
              onChange={(event) =>
                setDraft({ ...draft, icfa_factor: Number(event.target.value) || 0 })
              }
              disabled={isFrozen}
            />
          </label>
        </div>
        <details className="room-notes-expander">
          <summary>Notes</summary>
          <label className="sr-only" htmlFor="room-notes">
            Notes
          </label>
          <textarea
            id="room-notes"
            rows={4}
            value={draft.notes ?? ""}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            disabled={isFrozen}
          />
        </details>
        <datalist id="rooms-floor-level-options">
          {roomsSlice.single_select_options[ROOM_FLOOR_LEVEL_OPTION_KEY].map((option) => (
            <option key={option.id} value={option.label} />
          ))}
        </datalist>
        <datalist id="rooms-building-zone-options">
          {roomsSlice.single_select_options[ROOM_BUILDING_ZONE_OPTION_KEY].map((option) => (
            <option key={option.id} value={option.label} />
          ))}
        </datalist>
        <div className="modal-actions">
          {onDelete ? (
            <button
              type="button"
              className="danger-button"
              onClick={onDelete}
              disabled={deleteDisabled}
            >
              Delete room
            </button>
          ) : null}
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={isSaving || isFrozen}>
            Save room
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
