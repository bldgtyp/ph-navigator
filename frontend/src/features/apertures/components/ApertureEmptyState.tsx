export function ApertureEmptyState({ canEdit, onAdd }: { canEdit: boolean; onAdd: () => void }) {
  return (
    <div className="apertures-empty">
      <p>No aperture types yet.</p>
      {canEdit ? (
        <button type="button" className="apertures-empty__add" onClick={onAdd}>
          + Add aperture type
        </button>
      ) : null}
    </div>
  );
}
