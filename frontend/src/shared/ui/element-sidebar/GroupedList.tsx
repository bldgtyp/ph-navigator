import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { InlineHeaderNameEditor } from "../InlineHeaderNameEditor";
import {
  UNGROUPED_CONTAINER,
  computeSidebarDrop,
  containerDroppableId,
  type DropContainer,
} from "./dnd";
import { RowOverlay, SidebarActionButton, SortableRow } from "./rows";
import type {
  ElementSidebarGroup,
  ElementSidebarItem,
  ElementSidebarOrganization,
  RowContext,
} from "./types";

/**
 * The manual-mode group tree. All groups plus the ungrouped remainder share ONE
 * `DndContext` so a row can be dragged from any container into any other; each
 * container is a droppable `SortableContext` (empty ones still accept drops).
 * A `DragOverlay` renders the floating row so it can leave its origin container.
 * Within-container drops reorder; cross-container drops reassign the row.
 *
 * Each group renders as a lightweight divider (uppercase label + hairline rule,
 * not a boxed card). Group order is up/down buttons; item→group assignment is
 * drag only (the old per-row "move to group" select was retired). Collapsible
 * groups stay out of scope for 1A, but `collapsed_group_ids` is preserved.
 */
export function GroupedList({
  ctx,
  organization,
}: {
  ctx: RowContext;
  organization: ElementSidebarOrganization;
}) {
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { groups, ungrouped } = organization;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const containers: DropContainer[] = [
    ...groups.map((group) => ({ id: group.id, itemIds: group.items.map((item) => item.id) })),
    { id: UNGROUPED_CONTAINER, itemIds: ungrouped.map((item) => item.id) },
  ];

  const activeItem =
    activeId === null
      ? null
      : ([...groups.flatMap((group) => group.items), ...ungrouped].find(
          (item) => item.id === activeId,
        ) ?? null);

  function handleDragEnd(event: DragEndEvent): void {
    setActiveId(null);
    const { active, over } = event;
    const drop = computeSidebarDrop(String(active.id), over ? String(over.id) : null, containers);
    if (drop.kind === "reorder") {
      if (drop.containerId === UNGROUPED_CONTAINER) organization.onReorder(drop.orderedIds);
      else organization.onReorderGroupMembers(drop.containerId, drop.orderedIds);
    } else if (drop.kind === "move") {
      const targetGroupId =
        drop.targetContainerId === UNGROUPED_CONTAINER ? null : drop.targetContainerId;
      organization.onMoveItemToContainer(drop.itemId, targetGroupId, drop.orderedIds);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(event: DragStartEvent) => setActiveId(String(event.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {groups.map((group, index) => (
        <GroupSection
          key={group.id}
          group={group}
          ctx={ctx}
          organization={organization}
          isFirst={index === 0}
          isLast={index === groups.length - 1}
          editing={editingGroupId === group.id}
          onEditingChange={(editing) => setEditingGroupId(editing ? group.id : null)}
        />
      ))}
      <UngroupedSection items={ungrouped} ctx={ctx} />
      <DragOverlay>{activeItem ? <RowOverlay item={activeItem} /> : null}</DragOverlay>
    </DndContext>
  );
}

/** A container's droppable body: its member rows, or an empty-state placeholder
 * that keeps the zone tall enough to accept a drop. */
function ContainerBody({
  containerId,
  items,
  ctx,
}: {
  containerId: string;
  items: ElementSidebarItem[];
  ctx: RowContext;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: containerDroppableId(containerId) });
  return (
    <div
      ref={setNodeRef}
      className={
        isOver ? "element-sidebar__group-body is-drop-target" : "element-sidebar__group-body"
      }
    >
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        {items.length > 0 ? (
          items.map((item) => <SortableRow key={item.id} item={item} ctx={ctx} />)
        ) : (
          // A quiet dots placeholder reads as "empty" at a glance (prose read as
          // "full"); the label is kept accessible for screen readers.
          <p className="element-sidebar__group-empty" aria-label="Empty — drag items here">
            <span aria-hidden="true">· · ·</span>
          </p>
        )}
      </SortableContext>
    </div>
  );
}

function UngroupedSection({ items, ctx }: { items: ElementSidebarItem[]; ctx: RowContext }) {
  return (
    <section className="element-sidebar__group element-sidebar__group--ungrouped">
      <div className="element-sidebar__group-header">
        <span className="element-sidebar__group-label is-muted">Ungrouped</span>
        <span className="element-sidebar__group-rule" aria-hidden="true" />
      </div>
      <ContainerBody containerId={UNGROUPED_CONTAINER} items={items} ctx={ctx} />
    </section>
  );
}

function GroupSection({
  group,
  ctx,
  organization,
  isFirst,
  isLast,
  editing,
  onEditingChange,
}: {
  group: ElementSidebarGroup;
  ctx: RowContext;
  organization: ElementSidebarOrganization;
  isFirst: boolean;
  isLast: boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}) {
  const { idPrefix } = ctx;

  function moveGroup(direction: "up" | "down"): void {
    const ids = organization.groups.map((entry) => entry.id);
    const index = ids.indexOf(group.id);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    organization.onReorderGroups(ids);
  }

  return (
    <section id={`${idPrefix}-group-${group.id}`} className="element-sidebar__group">
      <div className="element-sidebar__group-header">
        {editing ? (
          <InlineHeaderNameEditor
            value={group.label}
            variant="inline"
            canEdit={ctx.canEdit}
            busy={ctx.actionDisabled}
            editLabel="Rename group"
            inputLabel="Group name"
            showEditButton={false}
            editing={editing}
            onEditingChange={onEditingChange}
            onSubmit={(label) => organization.onRenameGroup(group.id, label)}
          />
        ) : (
          <>
            <span className="element-sidebar__group-label is-muted">{group.label}</span>
            <span className="element-sidebar__group-rule" aria-hidden="true" />
          </>
        )}
        {ctx.canEdit && !editing ? (
          <span className="element-sidebar__group-actions">
            <SidebarActionButton
              id={`${idPrefix}-group-up-${group.id}`}
              label={`Move ${group.label} up`}
              icon={ArrowUp}
              disabled={ctx.actionDisabled || isFirst}
              onClick={() => moveGroup("up")}
            />
            <SidebarActionButton
              id={`${idPrefix}-group-down-${group.id}`}
              label={`Move ${group.label} down`}
              icon={ArrowDown}
              disabled={ctx.actionDisabled || isLast}
              onClick={() => moveGroup("down")}
            />
            <SidebarActionButton
              id={`${idPrefix}-group-rename-${group.id}`}
              label={`Rename ${group.label}`}
              icon={Pencil}
              disabled={ctx.actionDisabled}
              onClick={() => onEditingChange(true)}
            />
            <SidebarActionButton
              id={`${idPrefix}-group-delete-${group.id}`}
              label={`Delete ${group.label}`}
              icon={Trash2}
              danger
              disabled={ctx.actionDisabled}
              onClick={() => organization.onDeleteGroup(group.id)}
            />
          </span>
        ) : null}
      </div>
      <ContainerBody containerId={group.id} items={group.items} ctx={ctx} />
    </section>
  );
}
