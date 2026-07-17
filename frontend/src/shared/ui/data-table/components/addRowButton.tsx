// The footer "+" affordance in the DataTable's own styling. Pages that
// override `footerAction` (or render a table without the built-in
// default) use this so the add-row button stays visually uniform.
export function addRowButton(label: string, canEdit: boolean, onAdd: () => void) {
  if (!canEdit) return null;
  return (
    <button
      type="button"
      className="data-table-add-row-button"
      aria-label={label}
      title={label}
      onClick={onAdd}
    >
      +
    </button>
  );
}
