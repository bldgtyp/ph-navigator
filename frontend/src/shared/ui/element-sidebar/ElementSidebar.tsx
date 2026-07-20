import { FolderPlus, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { useState } from "react";
import { GroupedList } from "./GroupedList";
import { SortableRows, StaticRow } from "./rows";
import { Tooltip } from "../tooltip";
import type {
  ElementSidebarAdd,
  ElementSidebarItem,
  ElementSidebarNavigation,
  ElementSidebarOrganization,
  ElementSidebarRename,
  RowContext,
} from "./types";

/**
 * The single shared element-list sidebar behind both the Apertures (Aperture
 * Types) and Envelope (Assemblies) sidebars. Owns collapse chrome, the item
 * list, inline rename state, the row-action buttons, and (for editors) the
 * sort-mode toggle, drag-to-reorder, and the group tree. Features supply their
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
  /** User-controlled ordering + grouping (editors only); omit for a fixed list. */
  organization?: ElementSidebarOrganization;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const isManual = organization?.sortMode === "manual";
  const isGrouped = Boolean(isManual && organization?.hasGroups);

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
    groupTargets: isGrouped
      ? organization!.groups.map((group) => ({ id: group.id, label: group.label }))
      : [],
    onMoveItem: organization?.onMoveItem ?? (() => undefined),
  };

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
          {!isManual || !organization ? (
            items.map((item) => <StaticRow key={item.id} item={item} ctx={rowContext} />)
          ) : isGrouped ? (
            <GroupedList ctx={rowContext} organization={organization} />
          ) : (
            <SortableRows
              items={items}
              ctx={rowContext}
              currentGroupId={null}
              onReorder={organization.onReorder}
            />
          )}
          {isManual && organization ? (
            <button
              id={`${idPrefix}-new-group`}
              type="button"
              className="element-sidebar__new-group"
              onClick={organization.onAddGroup}
            >
              <FolderPlus size={14} aria-hidden="true" />
              New group
            </button>
          ) : null}
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
    <div className="element-sidebar__sortbar" role="tablist" aria-label={`${title} order`}>
      <button
        id={`${idPrefix}-sort-alphabetical`}
        type="button"
        role="tab"
        className="element-sidebar__sort-tab"
        aria-selected={sortMode === "alphabetical"}
        onClick={() => {
          if (sortMode !== "alphabetical") onToggleSortMode();
        }}
      >
        Alphabetical
      </button>
      <button
        id={`${idPrefix}-sort-manual`}
        type="button"
        role="tab"
        className="element-sidebar__sort-tab"
        aria-selected={sortMode === "manual"}
        onClick={() => {
          if (sortMode !== "manual") onToggleSortMode();
        }}
      >
        Manual
      </button>
    </div>
  );
}
