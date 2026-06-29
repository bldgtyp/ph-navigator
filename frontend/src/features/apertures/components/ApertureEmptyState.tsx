import { Plus } from "lucide-react";

export function ApertureEmptyState({ canEdit, onAdd }: { canEdit: boolean; onAdd: () => void }) {
  return (
    <div className="apertures-empty" aria-label="No aperture types">
      {canEdit ? (
        <button type="button" className="primary-button apertures-empty__add" onClick={onAdd}>
          <Plus size={18} aria-hidden="true" />
          <span>Add aperture type</span>
        </button>
      ) : null}
    </div>
  );
}
