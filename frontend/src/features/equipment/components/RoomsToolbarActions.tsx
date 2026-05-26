// The two action slots <DataTable> exposes for Rooms: the overflow
// menu download link and the footer "+" add-room button. Returned
// as fragments so RoomsPage can pass them through as-is.

import { tableDownloadUrl } from "../../project_document/api";
import { ROOMS_TABLE_NAME } from "../types";

export function buildRoomsDownloadAction(projectId: string, activeVersionId: string | null) {
  if (!activeVersionId) return null;
  return (
    <a
      className="data-table-overflow-menu-item"
      href={tableDownloadUrl(projectId, activeVersionId, ROOMS_TABLE_NAME)}
    >
      Rooms JSON
    </a>
  );
}

export function buildAddRoomFooterAction(canEdit: boolean, onAdd: () => void) {
  if (!canEdit) return null;
  return (
    <button
      type="button"
      className="data-table-add-row-button"
      aria-label="Add New Room"
      title="Add New Room"
      onClick={onAdd}
    >
      +
    </button>
  );
}
