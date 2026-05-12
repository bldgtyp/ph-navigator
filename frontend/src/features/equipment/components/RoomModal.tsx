import { useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { duplicateRoomNumber, optionLabel } from "../lib";
import {
  ROOM_BUILDING_ZONE_KEY,
  ROOM_FLOOR_LEVEL_KEY,
  type RoomRow,
  type RoomsSlice,
} from "../types";

export function RoomModal({
  title,
  room,
  roomsSlice,
  onCancel,
  onSubmit,
}: {
  title: string;
  room: RoomRow;
  roomsSlice: RoomsSlice;
  onCancel: () => void;
  onSubmit: (room: RoomRow, labels: { floorLevel: string; buildingZone: string }) => Promise<void>;
}) {
  const [draft, setDraft] = useState(room);
  const [floorLevel, setFloorLevel] = useState(
    optionLabel(roomsSlice.single_select_options[ROOM_FLOOR_LEVEL_KEY], room.floor_level),
  );
  const [buildingZone, setBuildingZone] = useState(
    optionLabel(roomsSlice.single_select_options[ROOM_BUILDING_ZONE_KEY], room.building_zone),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    setError(null);
    if (!draft.number.trim()) {
      setError("Room number is required.");
      return;
    }
    if (!draft.name.trim()) {
      setError("Room name is required.");
      return;
    }
    if (!floorLevel.trim()) {
      setError("Floor level is required.");
      return;
    }
    if (duplicateRoomNumber(roomsSlice.rooms, draft)) {
      setError("Room number already exists in this project.");
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
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="room-form-grid">
          <label>
            Number
            <input
              value={draft.number}
              onChange={(event) => setDraft({ ...draft, number: event.target.value })}
              required
            />
          </label>
          <label>
            Name
            <input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              required
            />
          </label>
          <label>
            Floor level
            <input
              list="rooms-floor-level-options"
              value={floorLevel}
              onChange={(event) => setFloorLevel(event.target.value)}
              required
            />
          </label>
          <label>
            Building zone
            <input
              list="rooms-building-zone-options"
              value={buildingZone}
              onChange={(event) => setBuildingZone(event.target.value)}
            />
          </label>
          <label>
            People
            <input
              type="number"
              min="0"
              step="1"
              value={draft.num_people}
              onChange={(event) =>
                setDraft({ ...draft, num_people: Number(event.target.value) || 0 })
              }
            />
          </label>
          <label>
            Bedrooms
            <input
              type="number"
              min="0"
              step="1"
              value={draft.num_bedrooms}
              onChange={(event) =>
                setDraft({ ...draft, num_bedrooms: Number(event.target.value) || 0 })
              }
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
            />
          </label>
        </div>
        <label>
          Notes
          <textarea
            rows={4}
            value={draft.notes ?? ""}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
          />
        </label>
        <datalist id="rooms-floor-level-options">
          {roomsSlice.single_select_options[ROOM_FLOOR_LEVEL_KEY].map((option) => (
            <option key={option.id} value={option.label} />
          ))}
        </datalist>
        <datalist id="rooms-building-zone-options">
          {roomsSlice.single_select_options[ROOM_BUILDING_ZONE_KEY].map((option) => (
            <option key={option.id} value={option.label} />
          ))}
        </datalist>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={isSaving}>
            Save room
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
