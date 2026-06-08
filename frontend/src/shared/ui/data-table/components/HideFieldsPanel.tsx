import { useMemo, useState, type CSSProperties, type ComponentType } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowRightLeft,
  Calculator,
  CircleDot,
  GripVertical,
  Hash,
  type LucideProps,
  Palette,
  Paperclip,
  Type,
} from "lucide-react";
import { reorderColumnIds } from "../hooks/useGridColumns";
import type { FieldDef, FieldType } from "../types";

// Narrow column shape this panel needs. Avoids dragging the `DataTable`
// row generic through every consumer (`GridToolbar`, tests, etc.) just
// to read three string fields.
export type HideFieldsColumn = {
  id: string;
  fieldKey: string;
  header: string;
};

// Plan 07 — Hide / Show fields panel. Renders the full column list
// with a per-row visibility toggle and drag handle, a search input at
// the top, and Hide-all / Show-all bulk actions at the bottom. The
// panel writes to two `ViewState` fields:
//   - hiddenColumns:  string[]      (column ids that are hidden)
//   - columnOrder:    string[]      (column ids in display order)
// The first column after ordering is the frozen primary column; its
// toggle is disabled and the source-of-truth guard in
// `useGridColumns` ignores attempts to hide it.

export type HideFieldsPanelChange = {
  hiddenColumns?: string[];
  columnOrder?: string[];
};

export type HideFieldsPanelProps = {
  // Already in display order (output of useGridColumns(... [],[])) so
  // the panel doesn't reapply the order logic. Hidden columns are
  // included here — they appear in the list with their toggle off.
  orderedColumns: HideFieldsColumn[];
  fieldDefByKey: Map<string, FieldDef>;
  hiddenColumns: string[];
  onChange: (next: HideFieldsPanelChange) => void;
};

export function HideFieldsPanel({
  orderedColumns,
  fieldDefByKey,
  hiddenColumns,
  onChange,
}: HideFieldsPanelProps) {
  const [search, setSearch] = useState("");

  const hiddenSet = useMemo(() => new Set(hiddenColumns), [hiddenColumns]);
  const primaryColumnId = orderedColumns[0]?.id ?? null;

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return orderedColumns;
    return orderedColumns.filter((column) => {
      const displayName = fieldDefByKey.get(column.fieldKey)?.display_name ?? column.header;
      return displayName.toLowerCase().includes(needle);
    });
  }, [fieldDefByKey, orderedColumns, search]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleToggle = (columnId: string, nextVisible: boolean) => {
    if (columnId === primaryColumnId) return;
    if (nextVisible) {
      onChange({ hiddenColumns: hiddenColumns.filter((id) => id !== columnId) });
    } else {
      onChange({ hiddenColumns: [...hiddenColumns, columnId] });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const fullOrder = orderedColumns.map((c) => c.id);
    const next = reorderColumnIds(fullOrder, String(active.id), String(over.id));
    if (next === fullOrder) return;
    onChange({ columnOrder: next });
  };

  const handleHideAll = () => {
    const idsToHide = orderedColumns.slice(1).map((c) => c.id);
    if (idsToHide.length === 0) return;
    if (idsToHide.every((id) => hiddenSet.has(id))) return;
    onChange({ hiddenColumns: idsToHide });
  };

  const handleShowAll = () => {
    if (hiddenColumns.length === 0) return;
    onChange({ hiddenColumns: [] });
  };

  // Drag is only useful when no search filter is active — reordering a
  // filtered subset would be ambiguous (where does the dragged row land
  // relative to columns hidden by the filter?). Match AirTable: disable
  // drag while searching.
  const dragEnabled = search.trim() === "";

  return (
    <div className="data-table-hide-fields-panel" role="dialog" aria-label="Hide or show fields">
      <input
        type="text"
        className="data-table-hide-fields-search"
        placeholder="Find a field"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        aria-label="Find a field"
      />
      {filtered.length === 0 ? (
        <div className="data-table-hide-fields-empty">No fields match &lsquo;{search}&rsquo;</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filtered.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <ul className="data-table-hide-fields-list" role="list">
              {filtered.map((column) => {
                const fieldDef = fieldDefByKey.get(column.fieldKey);
                const displayName = fieldDef?.display_name ?? column.header;
                const isPrimary = column.id === primaryColumnId;
                const visible = !hiddenSet.has(column.id);
                return (
                  <SortableFieldRow
                    key={column.id}
                    id={column.id}
                    fieldType={fieldDef?.field_type}
                    displayName={displayName}
                    visible={visible}
                    isPrimary={isPrimary}
                    dragEnabled={dragEnabled && !isPrimary}
                    onToggle={(next) => handleToggle(column.id, next)}
                  />
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      <div className="data-table-hide-fields-actions">
        <button
          type="button"
          className="data-table-hide-fields-action"
          onClick={handleHideAll}
          disabled={orderedColumns.length <= 1}
        >
          Hide all
        </button>
        <button
          type="button"
          className="data-table-hide-fields-action"
          onClick={handleShowAll}
          disabled={hiddenColumns.length === 0}
        >
          Show all
        </button>
      </div>
    </div>
  );
}

type SortableFieldRowProps = {
  id: string;
  fieldType: FieldType | undefined;
  displayName: string;
  visible: boolean;
  isPrimary: boolean;
  dragEnabled: boolean;
  onToggle: (visible: boolean) => void;
};

function SortableFieldRow({
  id,
  fieldType,
  displayName,
  visible,
  isPrimary,
  dragEnabled,
  onToggle,
}: SortableFieldRowProps) {
  const sortable = useSortable({ id, disabled: !dragEnabled });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };
  const FieldIcon = ICON_FOR_FIELD_TYPE[fieldType ?? "text"];
  const toggleLabel = visible ? `Hide ${displayName}` : `Show ${displayName}`;
  const dragLabel = `Reorder ${displayName}`;
  return (
    <li
      ref={sortable.setNodeRef}
      style={style}
      className="data-table-hide-fields-row"
      data-dragging={sortable.isDragging ? "true" : undefined}
    >
      <button
        type="button"
        className="data-table-hide-fields-drag"
        aria-label={dragLabel}
        ref={sortable.setActivatorNodeRef}
        disabled={!dragEnabled}
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <GripVertical aria-hidden />
      </button>
      <span className="data-table-hide-fields-icon" aria-hidden>
        <FieldIcon />
      </span>
      <span className="data-table-hide-fields-name">{displayName}</span>
      <label
        className="data-table-hide-fields-toggle"
        title={isPrimary ? "This column cannot be hidden." : undefined}
      >
        <input
          type="checkbox"
          checked={visible}
          disabled={isPrimary}
          aria-label={toggleLabel}
          onChange={(event) => onToggle(event.target.checked)}
        />
      </label>
    </li>
  );
}

const ICON_FOR_FIELD_TYPE: Record<FieldType, ComponentType<LucideProps>> = {
  text: Type,
  number: Hash,
  single_select: CircleDot,
  computed: Calculator,
  attachment: Paperclip,
  color: Palette,
  linked_record: ArrowRightLeft,
};
