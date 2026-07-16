import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { InlineHeaderNameEditor } from "../InlineHeaderNameEditor";
import { SidebarActionButton, SortableRows } from "./rows";
import type { ElementSidebarGroup, ElementSidebarOrganization, RowContext } from "./types";

/**
 * The manual-mode group tree: each group as a collapsible section with its
 * member rows, then the ungrouped remainder. Assignment between groups is the
 * per-row "move to group" select (in `rows.tsx`); within-section order is drag;
 * group order is up/down buttons (kept simple/robust rather than nesting a
 * second drag context). The "new group" button is owned by `ElementSidebar`.
 */
export function GroupedList({
  ctx,
  organization,
}: {
  ctx: RowContext;
  organization: ElementSidebarOrganization;
}) {
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const { groups, ungrouped } = organization;

  return (
    <>
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
      {ungrouped.length > 0 ? (
        <section className="element-sidebar__group element-sidebar__group--ungrouped">
          <div className="element-sidebar__group-header">
            <span className="element-sidebar__group-label is-muted">Ungrouped</span>
          </div>
          <SortableRows
            items={ungrouped}
            ctx={ctx}
            currentGroupId={null}
            onReorder={organization.onReorder}
          />
        </section>
      ) : null}
    </>
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
  const CollapseIcon = group.collapsed ? ChevronRight : ChevronDown;

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
        <button
          type="button"
          className="element-sidebar__group-collapse"
          aria-expanded={!group.collapsed}
          aria-label={`${group.collapsed ? "Expand" : "Collapse"} ${group.label}`}
          onClick={() => organization.onToggleGroupCollapsed(group.id)}
        >
          <CollapseIcon size={14} aria-hidden="true" />
        </button>
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
          <span className="element-sidebar__group-label">{group.label}</span>
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
      {group.collapsed ? null : group.items.length > 0 ? (
        <SortableRows
          items={group.items}
          ctx={ctx}
          currentGroupId={group.id}
          onReorder={(ids) => organization.onReorderGroupMembers(group.id, ids)}
        />
      ) : (
        <p className="element-sidebar__group-empty">Empty — move items here.</p>
      )}
    </section>
  );
}
