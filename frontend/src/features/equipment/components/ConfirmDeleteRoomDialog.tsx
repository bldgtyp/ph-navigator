import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { customTextValue } from "../lib/customValueReaders";
import type { RoomRow } from "../types";

// Confirmation dialog launched from `RoomModal`'s delete button.
// Renders a destructive-action modal; the parent owns the pending
// deletion state and the actual delete handler.
export function ConfirmDeleteRoomDialog(props: {
  room: RoomRow;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalDialog
      title={`Delete room ${roomNumber(props.room)}?`}
      titleId="delete-room-title"
      onClose={props.onCancel}
    >
      <p>This removes the room from the active draft.</p>
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={props.onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="danger-button"
          onClick={props.onConfirm}
          disabled={props.pending}
        >
          Delete room
        </button>
      </div>
    </ModalDialog>
  );
}

function roomNumber(room: RoomRow): string {
  return customTextValue(room, "number") || room.id;
}
