import { RECORD_ID_FIELD_KEY } from "../../../shared/ui/data-table";
import type { RoomRow } from "../types";
import { customTextValue, customTextValueOrNull } from "./customValueReaders";

export function roomDisplayLabel(
  room: RoomRow,
  computed: Record<string, unknown> | undefined = undefined,
): string {
  const computedRecordId = computed?.[RECORD_ID_FIELD_KEY];
  if (typeof computedRecordId === "string" && computedRecordId.trim().length > 0) {
    return computedRecordId;
  }
  return roomLabelFromParts(
    customTextValueOrNull(room, "number"),
    customTextValueOrNull(room, "name"),
    room.id,
  );
}

export function roomDialogTitleLabel(room: RoomRow): string {
  return roomLabelFromParts(
    customTextValue(room, "number"),
    customTextValue(room, "name"),
    room.id,
  );
}

function roomLabelFromParts(number: string | null, name: string | null, fallback: string): string {
  if (number && name) return `${number} - ${name}`;
  return number ?? name ?? fallback;
}
