import {
  ModalSingleSelectField,
  NumberField,
  RowEditGrid,
  RowEditModal,
  setCustomValue,
  TextField,
  useRowEditForm,
} from "../../../shared/ui/data-table";
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
  const floorLevelOptions = roomsSlice.single_select_options[ROOM_FLOOR_LEVEL_OPTION_KEY];
  const buildingZoneOptions = roomsSlice.single_select_options[ROOM_BUILDING_ZONE_OPTION_KEY];
  const form = useRowEditForm({
    initialRow: room,
    frozenReason,
    failureMessage: "Could not save room.",
    onSubmit: (nextRoom) =>
      onSubmit(nextRoom, {
        floorLevel: optionLabel(floorLevelOptions, nextRoom.floor_level),
        buildingZone: optionLabel(buildingZoneOptions, nextRoom.building_zone),
      }),
  });
  const { draft, setDraft, isFrozen } = form;
  const updateCustomValue = (fieldKey: string, value: string | number | null) => {
    setDraft((current) => setCustomValue(current, fieldKey, value));
  };

  return (
    <RowEditModal
      title={title}
      titleId="room-modal-title"
      onCancel={onCancel}
      onSubmit={() => void form.save()}
      error={form.error}
      isSaving={form.isSaving}
      frozenReason={frozenReason}
      onFrozenReload={onFrozenReload}
      submitLabel="Save room"
      deleteLabel="Delete room"
      onDelete={onDelete}
      deleteDisabled={deleteDisabled}
    >
      <RowEditGrid>
        <TextField
          label="Number"
          value={customTextValue(draft, "number")}
          disabled={isFrozen}
          onChange={(value) => updateCustomValue("number", value)}
        />
        <TextField
          label="Name"
          value={customTextValue(draft, "name")}
          disabled={isFrozen}
          onChange={(value) => updateCustomValue("name", value)}
        />
        <ModalSingleSelectField
          label="Floor level"
          value={draft.floor_level}
          options={floorLevelOptions}
          disabled={isFrozen}
          placeholder="Unassigned"
          onChange={(floor_level) => setDraft((current) => ({ ...current, floor_level }))}
        />
        <ModalSingleSelectField
          label="Building zone"
          value={draft.building_zone}
          options={buildingZoneOptions}
          disabled={isFrozen}
          placeholder="Unassigned"
          onChange={(building_zone) => setDraft((current) => ({ ...current, building_zone }))}
        />
        <NumberField
          label="People"
          value={customNumberValue(draft, "num_people") ?? 0}
          min={0}
          step={1}
          disabled={isFrozen}
          onChange={(value) => updateCustomValue("num_people", value ?? 0)}
        />
        <NumberField
          label="Bedrooms"
          value={customNumberValue(draft, "num_bedrooms") ?? 0}
          min={0}
          step={1}
          disabled={isFrozen}
          onChange={(value) => updateCustomValue("num_bedrooms", value ?? 0)}
        />
        <NumberField
          label="iCFA factor"
          value={draft.icfa_factor}
          min={0}
          max={1}
          step={0.01}
          disabled={isFrozen}
          onChange={(icfa_factor) =>
            setDraft((current) => ({ ...current, icfa_factor: icfa_factor ?? 0 }))
          }
        />
      </RowEditGrid>
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
    </RowEditModal>
  );
}
