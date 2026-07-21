import { ArrowUpDown, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { useState } from "react";
import { GroupedList } from "./GroupedList";
import { SortableRows, StaticRow } from "./rows";
import { AppMenu, AppMenuRadioItem } from "../AppMenu";
import { Tooltip } from "../tooltip";
import type {
  ElementSidebarAdd,
  ElementSidebarItem,
  ElementSidebarNavigation,
  ElementSidebarOrganization,
  ElementSidebarRename,
  ElementSidebarSortMode,
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
          {collapsed || !organization ? null : (
            <SortModeMenu title={title} organization={organization} />
          )}
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
          {isManual && organization ? (
            <AddGroupControl idPrefix={idPrefix} onAddGroup={organization.onAddGroup} />
          ) : null}
          {!isManual || !organization ? (
            items.map((item) => <StaticRow key={item.id} item={item} ctx={rowContext} />)
          ) : isGrouped ? (
            <GroupedList ctx={rowContext} organization={organization} />
          ) : (
            <SortableRows items={items} ctx={rowContext} onReorder={organization.onReorder} />
          )}
        </div>
      )}
      {collapsed ? addButton : null}
    </aside>
  );
}

/**
 * Add-group affordance (manual mode, editors): a quiet divider line matching the
 * group rules, with a centered "+" and an "Add group" tooltip. Sits at the TOP
 * of the list so creating a group is a header-level action, not a footer button.
 */
function AddGroupControl({ idPrefix, onAddGroup }: { idPrefix: string; onAddGroup: () => void }) {
  return (
    <Tooltip content="Add group" placement="bottom">
      <button
        id={`${idPrefix}-add-group`}
        type="button"
        className="element-sidebar__add-group"
        aria-label="Add group"
        // Wrap so the click event isn't passed as onAddGroup's optional `label`
        // argument (which would make the new group's name the event).
        onClick={() => onAddGroup()}
      >
        <span className="element-sidebar__add-group-line" aria-hidden="true" />
        <Plus size={14} aria-hidden="true" />
        <span className="element-sidebar__add-group-line" aria-hidden="true" />
      </button>
    </Tooltip>
  );
}

const SORT_MODE_OPTIONS: { mode: ElementSidebarSortMode; label: string }[] = [
  { mode: "alphabetical", label: "Alphabetical" },
  { mode: "manual", label: "Manual" },
];

/**
 * Sort-mode control (editors only): a quiet ghost icon-button in the header
 * tools cluster that opens a two-option radio menu (Alphabetical / Manual),
 * rather than a persistent full-width tab row. The active mode is also implied
 * by the list itself (manual shows grips, group dividers, and the add-group line).
 */
function SortModeMenu({
  title,
  organization,
}: {
  title: string;
  organization: ElementSidebarOrganization;
}) {
  const { sortMode, onToggleSortMode } = organization;
  return (
    <AppMenu
      label={`${title} order`}
      tooltip="Sort order"
      className="element-sidebar__sort-menu"
      triggerIcon={ArrowUpDown}
    >
      {SORT_MODE_OPTIONS.map(({ mode, label }) => (
        <AppMenuRadioItem
          key={mode}
          checked={sortMode === mode}
          onClick={() => {
            if (sortMode !== mode) onToggleSortMode();
          }}
        >
          {label}
        </AppMenuRadioItem>
      ))}
    </AppMenu>
  );
}
