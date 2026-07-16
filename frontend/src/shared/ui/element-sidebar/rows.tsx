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
import { Tooltip, TOOLTIP_HOVER_DELAY } from "../tooltip";
import type { ElementSidebarItem, ElementSidebarNavigation, RowContext } from "./types";

/**
 * A drag-reorderable section of rows (a group's members, the ungrouped
 * remainder, or the whole flat manual list). `currentGroupId` labels which
 * section these rows live in for the per-row "move to group" control.
 */
export function SortableRows({
  items,
  ctx,
  currentGroupId,
  onReorder,
}: {
  items: ElementSidebarItem[];
  ctx: RowContext;
  currentGroupId: string | null;
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
          <SortableRow key={item.id} item={item} ctx={ctx} currentGroupId={currentGroupId} />
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
      <ElementSidebarRowBody item={item} ctx={ctx} currentGroupId={null} />
    </div>
  );
}

function SortableRow({
  item,
  ctx,
  currentGroupId,
}: {
  item: ElementSidebarItem;
  ctx: RowContext;
  currentGroupId: string | null;
}) {
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
      <ElementSidebarRowBody item={item} ctx={ctx} currentGroupId={currentGroupId} />
    </div>
  );
}

/** The editor-or-link plus the row-action buttons — shared by static and sortable rows. */
function ElementSidebarRowBody({
  item,
  ctx,
  currentGroupId,
}: {
  item: ElementSidebarItem;
  ctx: RowContext;
  currentGroupId: string | null;
}) {
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
          {ctx.groupTargets.length > 0 ? (
            <MoveToGroupSelect item={item} ctx={ctx} currentGroupId={currentGroupId} />
          ) : null}
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

/**
 * Assigns a row to a group. A native `<select>` (not a popover) so its dropdown
 * escapes the sidebar list's `overflow: auto` clipping and stays keyboard- and
 * screen-reader-accessible.
 */
function MoveToGroupSelect({
  item,
  ctx,
  currentGroupId,
}: {
  item: ElementSidebarItem;
  ctx: RowContext;
  currentGroupId: string | null;
}) {
  return (
    <select
      id={`${ctx.idPrefix}-move-${item.id}`}
      className="element-sidebar__row-move"
      aria-label={`Move ${item.name} to group`}
      value={currentGroupId ?? ""}
      disabled={ctx.actionDisabled}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => ctx.onMoveItem(item.id, event.target.value || null)}
    >
      <option value="">Ungrouped</option>
      {ctx.groupTargets.map((group) => (
        <option key={group.id} value={group.id}>
          {group.label}
        </option>
      ))}
    </select>
  );
}

function ElementSidebarRowLink({
  item,
  navigation,
}: {
  item: ElementSidebarItem;
  navigation: ElementSidebarNavigation;
}) {
  const LeadingIcon = item.leadingIcon;
  const inner = (
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

  return (
    <Tooltip content={item.name} placement="top" hoverDelay={TOOLTIP_HOVER_DELAY.medium}>
      {navigation.mode === "link" ? (
        <NavLink
          className="element-sidebar__row-link"
          to={navigation.buildTo(item)}
          {...item.linkData}
        >
          {inner}
        </NavLink>
      ) : (
        <button
          type="button"
          className="element-sidebar__row-link"
          onClick={() => navigation.onSelect(item.id)}
          {...item.linkData}
        >
          {inner}
        </button>
      )}
    </Tooltip>
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
    <Tooltip content={label} placement="top" hoverDelay={TOOLTIP_HOVER_DELAY.long}>
      <button
        id={id}
        type="button"
        className={danger ? "element-sidebar__row-action is-danger" : "element-sidebar__row-action"}
        aria-label={label}
        disabled={disabled}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClick();
        }}
      >
        <Icon size={13} aria-hidden="true" />
      </button>
    </Tooltip>
  );
}
