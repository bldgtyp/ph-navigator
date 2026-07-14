// The Rooms footer "+" action. JSON download is now a built-in DataTable
// affordance, so Rooms no longer injects a one-off overflow-menu link.

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
