import type { WindowTypeEntry } from "../types";

export function WindowTypeSidebar({
  items,
  selectedId,
  onSelect,
}: {
  items: WindowTypeEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <aside className="windows-sidebar" aria-label="Window types">
        <p className="empty-state">No window types</p>
      </aside>
    );
  }
  return (
    <aside className="windows-sidebar" aria-label="Window types">
      <ul>
        {items.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              className={entry.id === selectedId ? "active" : ""}
              onClick={() => onSelect(entry.id)}
            >
              {entry.name}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
