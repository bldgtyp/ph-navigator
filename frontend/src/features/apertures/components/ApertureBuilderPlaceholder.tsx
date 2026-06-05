import type { ApertureTypeEntry } from "../types";

export function ApertureBuilderPlaceholder({ aperture }: { aperture: ApertureTypeEntry }) {
  return (
    <div>
      <p>
        Aperture Builder canvas lands in Phase 03. Selected: <strong>{aperture.name}</strong> (
        {aperture.elements.length} element{aperture.elements.length === 1 ? "" : "s"}).
      </p>
    </div>
  );
}

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
