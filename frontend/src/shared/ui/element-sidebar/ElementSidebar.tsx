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
import {
  ArrowDownAZ,
  GripVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { useState, type CSSProperties } from "react";
import { NavLink, type To } from "react-router-dom";
import { InlineHeaderNameEditor } from "../InlineHeaderNameEditor";
import { Tooltip, TOOLTIP_HOVER_DELAY } from "../tooltip";

/**
 * One extra row-action button beyond the built-in rename (e.g. duplicate,
 * delete, change-type). `key` doubles as the stable-id suffix so browser/MCP
 * automation can target it as `${idPrefix}-${key}-${itemId}`.
 */
export type ElementSidebarAction = {
  key: string;
  label: string;
  icon: LucideIcon;
  danger?: boolean;
  onClick: () => void;
};

export type ElementSidebarItem = {
  id: string;
  name: string;
  /** Leading glyph (e.g. the envelope assembly-type icon); omitted for apertures. */
  leadingIcon?: LucideIcon;
  /** Extra data-* attributes placed on the row link (e.g. `data-assembly-type`). */
  linkData?: Record<string, string>;
  /** Commit a new name for this item (closes over the typed entity). */
  onRename: (name: string) => void;
  /** Optional collision/validation message for a proposed name. */
  getRenameValidationMessage?: (name: string) => string | null;
  /** Additional row actions after the built-in rename, in display order. */
  actions: ElementSidebarAction[];
};

/**
 * How a row navigates. `select` renders a button that reports the clicked id;
 * `link` renders a routing `NavLink`. Active styling comes from `activeId` in
 * both modes (not NavLink's own active state), so selection and routing behave
 * identically.
 */
export type ElementSidebarNavigation =
  | { mode: "select"; onSelect: (id: string) => void }
  | { mode: "link"; buildTo: (item: ElementSidebarItem) => To };

export type ElementSidebarRename = {
  /** aria-label for the built-in rename button. */
  actionLabel: string;
  /** Labels forwarded to the inline editor. */
  inputLabel: string;
  editLabel: string;
};

export type ElementSidebarAdd = {
  label: string;
  onAdd: () => void;
  disabled: boolean;
};

export type ElementSidebarSortMode = "alphabetical" | "manual";

/**
 * User-controlled ordering. Provided only for editors (persistence is
 * editor-only); its presence turns on the sort-mode toggle, and `manual` mode
 * turns on drag-to-reorder. `items` must already be in the order this mode
 * implies — the sidebar renders them as given and reports drags via `onReorder`.
 */
export type ElementSidebarOrganization = {
  sortMode: ElementSidebarSortMode;
  onToggleSortMode: () => void;
  /** Called on drag end with the full new id order. */
  onReorder: (orderedIds: string[]) => void;
};

/** Everything a row needs that is constant across the list, bundled to avoid drilling. */
type RowContext = {
  idPrefix: string;
  title: string;
  canEdit: boolean;
  actionDisabled: boolean;
  activeId: string | null;
  navigation: ElementSidebarNavigation;
  rename: ElementSidebarRename;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
};

/**
 * The single shared element-list sidebar behind both the Apertures (Aperture
 * Types) and Envelope (Assemblies) sidebars. Owns collapse chrome, the item
 * list, inline rename state, the row-action buttons, and (for editors) the
 * sort-mode toggle + drag-to-reorder. Features supply their data and behaviors
 * through the props below; nothing feature-specific lives here.
 */
export function ElementSidebar({
  title,
  ariaLabel,
  toggleNoun,
  idPrefix,
  collapsed,
  onToggleCollapsed,
  canEdit,
  actionDisabled,
  items,
  activeId,
  navigation,
  rename,
  add,
  organization,
}: {
  title: string;
  ariaLabel: string;
  /** Noun for the collapse/expand aria-label, e.g. `"aperture"` → "Collapse aperture sidebar". */
  toggleNoun: string;
  /** Prefix for stable element ids (`${idPrefix}`, `-toggle`, `-add`, `-row-*`…). */
  idPrefix: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  canEdit: boolean;
  actionDisabled: boolean;
  items: ElementSidebarItem[];
  activeId: string | null;
  navigation: ElementSidebarNavigation;
  rename: ElementSidebarRename;
  /** Add control; omit (null) to hide it entirely (e.g. read-only apertures). */
  add: ElementSidebarAdd | null;
  /** User-controlled ordering (editors only); omit to render a fixed list. */
  organization?: ElementSidebarOrganization;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const rowContext: RowContext = {
    idPrefix,
    title,
    canEdit,
    actionDisabled,
    activeId,
    navigation,
    rename,
    editingId,
    setEditingId,
  };
  const isManual = organization?.sortMode === "manual";

  const addButton = add ? (
    <Tooltip content={add.label} placement={collapsed ? "right" : "bottom"}>
      <button
        id={collapsed ? `${idPrefix}-add-collapsed` : `${idPrefix}-add`}
        type="button"
        className={collapsed ? "icon-button element-sidebar__add-collapsed" : "icon-button"}
        disabled={add.disabled}
        aria-label={add.label}
        onClick={add.onAdd}
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </Tooltip>
  ) : null;

  return (
    <aside
      id={idPrefix}
      className={collapsed ? "element-sidebar is-collapsed" : "element-sidebar"}
      aria-label={ariaLabel}
    >
      <div className="element-sidebar__header">
        {collapsed ? null : <h2>{title}</h2>}
        <div className="element-sidebar__tools">
          <Tooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"} placement="bottom">
            <button
              id={`${idPrefix}-toggle`}
              type="button"
              className="icon-button"
              aria-label={
                collapsed ? `Expand ${toggleNoun} sidebar` : `Collapse ${toggleNoun} sidebar`
              }
              onClick={onToggleCollapsed}
            >
              {collapsed ? (
                <PanelLeftOpen size={16} aria-hidden="true" />
              ) : (
                <PanelLeftClose size={16} aria-hidden="true" />
              )}
            </button>
          </Tooltip>
          {collapsed ? null : addButton}
        </div>
      </div>
      {collapsed || !organization ? null : (
        <SortModeToggle idPrefix={idPrefix} title={title} organization={organization} />
      )}
      {collapsed ? null : (
        <div id={`${idPrefix}-list`} className="element-sidebar__list">
          {isManual && organization ? (
            <SortableRows items={items} ctx={rowContext} onReorder={organization.onReorder} />
          ) : (
            items.map((item) => <StaticRow key={item.id} item={item} ctx={rowContext} />)
          )}
        </div>
      )}
      {collapsed ? addButton : null}
    </aside>
  );
}

function SortModeToggle({
  idPrefix,
  title,
  organization,
}: {
  idPrefix: string;
  title: string;
  organization: ElementSidebarOrganization;
}) {
  const { sortMode, onToggleSortMode } = organization;
  return (
    <div className="element-sidebar__sortbar" role="group" aria-label={`${title} order`}>
      <span className="element-sidebar__sortbar-label">Order</span>
      <div className="element-sidebar__sort-toggle">
        <button
          id={`${idPrefix}-sort-alphabetical`}
          type="button"
          className="element-sidebar__sort-option"
          aria-pressed={sortMode === "alphabetical"}
          onClick={() => {
            if (sortMode !== "alphabetical") onToggleSortMode();
          }}
        >
          <ArrowDownAZ size={13} aria-hidden="true" />
          A–Z
        </button>
        <button
          id={`${idPrefix}-sort-manual`}
          type="button"
          className="element-sidebar__sort-option"
          aria-pressed={sortMode === "manual"}
          onClick={() => {
            if (sortMode !== "manual") onToggleSortMode();
          }}
        >
          <GripVertical size={13} aria-hidden="true" />
          Manual
        </button>
      </div>
    </div>
  );
}

function SortableRows({
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

function StaticRow({ item, ctx }: { item: ElementSidebarItem; ctx: RowContext }) {
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

function SortableRow({ item, ctx }: { item: ElementSidebarItem; ctx: RowContext }) {
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

function SidebarActionButton({
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
