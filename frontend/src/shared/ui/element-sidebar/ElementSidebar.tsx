import { PanelLeftClose, PanelLeftOpen, Pencil, Plus, type LucideIcon } from "lucide-react";
import { useState } from "react";
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

/**
 * The single shared element-list sidebar behind both the Apertures (Aperture
 * Types) and Envelope (Assemblies) sidebars. Owns collapse chrome, the item
 * list, inline rename state, and the row-action buttons. Features supply their
 * data and behaviors through the props below; nothing feature-specific lives
 * here.
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
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

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
      {collapsed ? null : (
        <div id={`${idPrefix}-list`} className="element-sidebar__list">
          {items.map((item) => {
            const isActive = item.id === activeId;
            const isEditing = editingId === item.id;
            return (
              <div
                key={item.id}
                id={`${idPrefix}-row-${item.id}`}
                className={isActive ? "element-sidebar__row is-active" : "element-sidebar__row"}
              >
                {isEditing ? (
                  <InlineHeaderNameEditor
                    value={item.name}
                    variant="inline"
                    canEdit={canEdit}
                    busy={actionDisabled}
                    editLabel={rename.editLabel}
                    inputLabel={rename.inputLabel}
                    showEditButton={false}
                    editing={isEditing}
                    onEditingChange={(editing) => setEditingId(editing ? item.id : null)}
                    getValidationMessage={item.getRenameValidationMessage}
                    onSubmit={(name) => item.onRename(name)}
                  />
                ) : (
                  <ElementSidebarRowLink item={item} navigation={navigation} />
                )}
                {canEdit && !isEditing ? (
                  <span
                    id={`${idPrefix}-row-actions-${item.id}`}
                    className="element-sidebar__row-actions"
                    aria-label={`${title} actions`}
                  >
                    <SidebarActionButton
                      id={`${idPrefix}-rename-${item.id}`}
                      label={rename.actionLabel}
                      icon={Pencil}
                      disabled={actionDisabled}
                      onClick={() => setEditingId(item.id)}
                    />
                    {item.actions.map((action) => (
                      <SidebarActionButton
                        key={action.key}
                        id={`${idPrefix}-${action.key}-${item.id}`}
                        label={action.label}
                        icon={action.icon}
                        disabled={actionDisabled}
                        danger={action.danger}
                        onClick={action.onClick}
                      />
                    ))}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {collapsed ? addButton : null}
    </aside>
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
