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
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, type LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { NavLink } from "react-router-dom";
import { InlineHeaderNameEditor } from "../InlineHeaderNameEditor";
import type { ElementSidebarItem, ElementSidebarNavigation, RowContext } from "./types";

/**
 * A drag-reorderable section of rows for the flat manual list (no groups). It
 * owns its own single-container `DndContext`; the grouped tree instead shares
 * one `DndContext` across containers (see `GroupedList`) and renders
 * {@link SortableRow} directly.
 */
export function SortableRows({
  items,
  ctx,
  onReorder,
}: {
  items: ElementSidebarItem[];
  ctx: RowContext;
  onReorder: (orderedIds: string[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = items.map((item) => item.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(ids, from, to));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        {items.map((item) => (
          <SortableRow key={item.id} item={item} ctx={ctx} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

export function StaticRow({ item, ctx }: { item: ElementSidebarItem; ctx: RowContext }) {
  const isActive = item.id === ctx.activeId;
  return (
    <div
      id={`${ctx.idPrefix}-row-${item.id}`}
      className={isActive ? "element-sidebar__row is-active" : "element-sidebar__row"}
    >
      <ElementSidebarRowBody item={item} ctx={ctx} />
    </div>
  );
}

/**
 * One sortable row. Used by the flat list (its own DndContext) and by each
 * grouped container's `SortableContext`. In the grouped tree a `DragOverlay`
 * renders the floating copy, so the in-place row is dimmed while dragging (a CSS
 * descendant rule under `.element-sidebar__group-body`); in the flat list the
 * row itself lifts as it drags.
 */
export function SortableRow({ item, ctx }: { item: ElementSidebarItem; ctx: RowContext }) {
  const isActive = item.id === ctx.activeId;
  const sortable = useSortable({ id: item.id, disabled: ctx.editingId === item.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };
  const className = [
    "element-sidebar__row",
    "element-sidebar__row--draggable",
    isActive ? "is-active" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      id={`${ctx.idPrefix}-row-${item.id}`}
      className={className}
      data-dragging={sortable.isDragging ? "true" : undefined}
    >
      <button
        type="button"
        className="element-sidebar__row-handle"
        aria-label={`Reorder ${item.name}`}
        ref={sortable.setActivatorNodeRef}
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <GripVertical size={14} aria-hidden="true" />
      </button>
      <ElementSidebarRowBody item={item} ctx={ctx} />
    </div>
  );
}

/** The leading icon + name shown inside a row link and its drag-overlay copy. */
function RowLabel({ item }: { item: ElementSidebarItem }) {
  const LeadingIcon = item.leadingIcon;
  return (
    <>
      {LeadingIcon ? (
        <LeadingIcon
          className="element-sidebar__row-icon"
          size={14}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      ) : null}
      <span className="element-sidebar__row-name">{item.name}</span>
    </>
  );
}

/** The floating row rendered inside the grouped tree's `DragOverlay`. */
export function RowOverlay({ item }: { item: ElementSidebarItem }) {
  return (
    <div className="element-sidebar__row element-sidebar__row--draggable is-overlay">
      <span className="element-sidebar__row-handle" aria-hidden="true">
        <GripVertical size={14} />
      </span>
      <span className="element-sidebar__row-link">
        <RowLabel item={item} />
      </span>
    </div>
  );
}

/** The editor-or-link plus the row-action buttons — shared by static and sortable rows. */
function ElementSidebarRowBody({ item, ctx }: { item: ElementSidebarItem; ctx: RowContext }) {
  const isEditing = ctx.editingId === item.id;
  return (
    <>
      {isEditing ? (
        <InlineHeaderNameEditor
          value={item.name}
          variant="inline"
          canEdit={ctx.canEdit}
          busy={ctx.actionDisabled}
          editLabel={ctx.rename.editLabel}
          inputLabel={ctx.rename.inputLabel}
          showEditButton={false}
          editing={isEditing}
          onEditingChange={(editing) => ctx.setEditingId(editing ? item.id : null)}
          getValidationMessage={item.getRenameValidationMessage}
          onSubmit={(name) => item.onRename(name)}
        />
      ) : (
        <ElementSidebarRowLink item={item} navigation={ctx.navigation} />
      )}
      {ctx.canEdit && !isEditing ? (
        <span
          id={`${ctx.idPrefix}-row-actions-${item.id}`}
          className="element-sidebar__row-actions"
          aria-label={`${ctx.title} actions`}
        >
          <SidebarActionButton
            id={`${ctx.idPrefix}-rename-${item.id}`}
            label={ctx.rename.actionLabel}
            icon={Pencil}
            disabled={ctx.actionDisabled}
            onClick={() => ctx.setEditingId(item.id)}
          />
          {item.actions.map((action) => (
            <SidebarActionButton
              key={action.key}
              id={`${ctx.idPrefix}-${action.key}-${item.id}`}
              label={action.label}
              icon={action.icon}
              disabled={ctx.actionDisabled}
              danger={action.danger}
              onClick={action.onClick}
            />
          ))}
        </span>
      ) : null}
    </>
  );
}

function ElementSidebarRowLink({
  item,
  navigation,
}: {
  item: ElementSidebarItem;
  navigation: ElementSidebarNavigation;
}) {
  // Native title (no dark tooltip bubble) surfaces the full name when the label
  // truncates; the visible text is the accessible name.
  return navigation.mode === "link" ? (
    <NavLink
      className="element-sidebar__row-link"
      to={navigation.buildTo(item)}
      title={item.name}
      {...item.linkData}
    >
      <RowLabel item={item} />
    </NavLink>
  ) : (
    <button
      type="button"
      className="element-sidebar__row-link"
      title={item.name}
      onClick={() => navigation.onSelect(item.id)}
      {...item.linkData}
    >
      <RowLabel item={item} />
    </button>
  );
}

export function SidebarActionButton({
  id,
  label,
  icon: Icon,
  disabled = false,
  danger = false,
  onClick,
}: {
  id: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      className={danger ? "element-sidebar__row-action is-danger" : "element-sidebar__row-action"}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
    >
      <Icon size={13} aria-hidden="true" />
    </button>
  );
}
