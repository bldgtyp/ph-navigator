import type { ApertureTypeEntry } from "../types";

export function ApertureSidebar({
  apertures,
  activeApertureId,
  canEdit,
  onSelect,
  onAdd,
  onRename,
  onDuplicate,
  onDelete,
}: {
  apertures: ApertureTypeEntry[];
  activeApertureId: string | null;
  canEdit: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (aperture: ApertureTypeEntry) => void;
  onDuplicate: (aperture: ApertureTypeEntry) => void;
  onDelete: (aperture: ApertureTypeEntry) => void;
}) {
  return (
    <aside className="aperture-sidebar" aria-label="Aperture types">
      {canEdit ? (
        <button type="button" className="aperture-sidebar__add" onClick={onAdd}>
          + Add aperture type
        </button>
      ) : null}
      <ul className="aperture-sidebar__list">
        {apertures.map((aperture) => {
          const isActive = aperture.id === activeApertureId;
          return (
            <li
              key={aperture.id}
              className={`aperture-sidebar__item${isActive ? " is-active" : ""}`}
              onClick={() => onSelect(aperture.id)}
            >
              <span className="aperture-sidebar__item-name">{aperture.name}</span>
              {canEdit ? (
                <span className="aperture-sidebar__row-actions">
                  <button
                    type="button"
                    className="aperture-sidebar__row-action"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRename(aperture);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="aperture-sidebar__row-action"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDuplicate(aperture);
                    }}
                  >
                    Dup
                  </button>
                  <button
                    type="button"
                    className="aperture-sidebar__row-action"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(aperture);
                    }}
                  >
                    Del
                  </button>
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
