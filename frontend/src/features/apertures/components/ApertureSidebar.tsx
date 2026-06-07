import {
  Copy,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { ApertureTypeEntry } from "../types";

export function ApertureSidebar({
  apertures,
  activeApertureId,
  canEdit,
  actionDisabled,
  collapsed,
  onToggleCollapsed,
  onSelect,
  onAdd,
  onRename,
  onDuplicate,
  onDelete,
}: {
  apertures: ApertureTypeEntry[];
  activeApertureId: string | null;
  canEdit: boolean;
  actionDisabled: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (aperture: ApertureTypeEntry) => void;
  onDuplicate: (aperture: ApertureTypeEntry) => void;
  onDelete: (aperture: ApertureTypeEntry) => void;
}) {
  const addButton = canEdit ? (
    <button
      type="button"
      className={collapsed ? "icon-button aperture-sidebar__add-collapsed" : "icon-button"}
      disabled={actionDisabled}
      aria-label="Add aperture type"
      data-sidebar-tooltip="Add aperture type"
      onClick={onAdd}
    >
      <Plus size={16} aria-hidden="true" />
    </button>
  ) : null;

  return (
    <aside
      className={collapsed ? "aperture-sidebar is-collapsed" : "aperture-sidebar"}
      aria-label="Aperture types"
    >
      <div className="aperture-sidebar__header">
        {collapsed ? null : <h2>Aperture Types</h2>}
        <div className="aperture-sidebar__tools">
          <button
            id="aperture-sidebar-toggle"
            type="button"
            className="icon-button"
            aria-label={collapsed ? "Expand aperture sidebar" : "Collapse aperture sidebar"}
            data-sidebar-tooltip={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onToggleCollapsed}
          >
            {collapsed ? (
              <PanelLeftOpen size={16} aria-hidden="true" />
            ) : (
              <PanelLeftClose size={16} aria-hidden="true" />
            )}
          </button>
          {collapsed ? null : addButton}
        </div>
      </div>
      {collapsed ? null : (
        <ul className="aperture-sidebar__list">
          {apertures.map((aperture) => {
            const isActive = aperture.id === activeApertureId;
            return (
              <li
                key={aperture.id}
                className={`aperture-sidebar__item${isActive ? " is-active" : ""}`}
                onClick={() => onSelect(aperture.id)}
              >
                <span className="aperture-sidebar__item-name">{aperture.name}</span>
                {canEdit ? (
                  <span
                    id={`aperture-sidebar-row-actions-${aperture.id}`}
                    className="aperture-sidebar__row-actions"
                    aria-label="Aperture type actions"
                  >
                    <SidebarActionButton
                      label="Rename aperture type"
                      tooltip="Rename aperture type"
                      icon={Pencil}
                      disabled={actionDisabled}
                      onClick={() => onRename(aperture)}
                    />
                    <SidebarActionButton
                      label="Duplicate aperture type"
                      tooltip="Duplicate aperture type"
                      icon={Copy}
                      disabled={actionDisabled}
                      onClick={() => onDuplicate(aperture)}
                    />
                    <SidebarActionButton
                      label="Delete aperture type"
                      tooltip="Delete aperture type"
                      icon={Trash2}
                      disabled={actionDisabled}
                      danger
                      onClick={() => onDelete(aperture)}
                    />
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {collapsed ? addButton : null}
    </aside>
  );
}

function SidebarActionButton({
  label,
  tooltip,
  icon: Icon,
  disabled = false,
  danger = false,
  onClick,
}: {
  label: string;
  tooltip: string;
  icon: LucideIcon;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={danger ? "aperture-sidebar__row-action is-danger" : "aperture-sidebar__row-action"}
      aria-label={label}
      data-sidebar-tooltip={tooltip}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <Icon size={13} aria-hidden="true" />
    </button>
  );
}
