import {
  Copy,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { InlineHeaderNameEditor } from "../../../shared/ui/InlineHeaderNameEditor";
import { Tooltip, TOOLTIP_HOVER_DELAY } from "../../../shared/ui";
import { nameCollides } from "../lib";
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
  onRename: (aperture: ApertureTypeEntry, name: string) => void;
  onDuplicate: (aperture: ApertureTypeEntry) => void;
  onDelete: (aperture: ApertureTypeEntry) => void;
}) {
  const [editingApertureId, setEditingApertureId] = useState<string | null>(null);
  const addButton = canEdit ? (
    <Tooltip content="Add aperture type" placement={collapsed ? "right" : "bottom"}>
      <button
        type="button"
        className={collapsed ? "icon-button aperture-sidebar__add-collapsed" : "icon-button"}
        disabled={actionDisabled}
        aria-label="Add aperture type"
        onClick={onAdd}
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </Tooltip>
  ) : null;

  return (
    <aside
      className={collapsed ? "aperture-sidebar is-collapsed" : "aperture-sidebar"}
      aria-label="Aperture types"
    >
      <div className="aperture-sidebar__header">
        {collapsed ? null : <h2>Aperture Types</h2>}
        <div className="aperture-sidebar__tools">
          <Tooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"} placement="bottom">
            <button
              id="aperture-sidebar-toggle"
              type="button"
              className="icon-button"
              aria-label={collapsed ? "Expand aperture sidebar" : "Collapse aperture sidebar"}
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
        <ul className="aperture-sidebar__list">
          {apertures.map((aperture) => {
            const isActive = aperture.id === activeApertureId;
            const isEditing = editingApertureId === aperture.id;
            return (
              <li
                key={aperture.id}
                className={`aperture-sidebar__item${isActive ? " is-active" : ""}`}
                onClick={() => {
                  if (isEditing) return;
                  onSelect(aperture.id);
                }}
              >
                {isEditing ? (
                  <InlineHeaderNameEditor
                    value={aperture.name}
                    variant="inline"
                    canEdit={canEdit}
                    busy={actionDisabled}
                    editLabel="Edit aperture type name"
                    inputLabel="Aperture type name"
                    showEditButton={false}
                    editing={isEditing}
                    onEditingChange={(editing) =>
                      setEditingApertureId(editing ? aperture.id : null)
                    }
                    getValidationMessage={(name) => {
                      if (!nameCollides(apertures, name.trim(), aperture.id)) return null;
                      return `An aperture type named '${name.trim()}' already exists in this version.`;
                    }}
                    onSubmit={(name) => onRename(aperture, name)}
                  />
                ) : (
                  <Tooltip
                    content={aperture.name}
                    placement="top"
                    hoverDelay={TOOLTIP_HOVER_DELAY.medium}
                  >
                    <span className="aperture-sidebar__item-name">{aperture.name}</span>
                  </Tooltip>
                )}
                {canEdit && !isEditing ? (
                  <span
                    id={`aperture-sidebar-row-actions-${aperture.id}`}
                    className="aperture-sidebar__row-actions"
                    aria-label="Aperture type actions"
                  >
                    <SidebarActionButton
                      label="Rename aperture type"
                      icon={Pencil}
                      disabled={actionDisabled}
                      onClick={() => setEditingApertureId(aperture.id)}
                    />
                    <SidebarActionButton
                      label="Duplicate aperture type"
                      icon={Copy}
                      disabled={actionDisabled}
                      onClick={() => onDuplicate(aperture)}
                    />
                    <SidebarActionButton
                      label="Delete aperture type"
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
  icon: Icon,
  disabled = false,
  danger = false,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip content={label} placement="top" hoverDelay={TOOLTIP_HOVER_DELAY.long}>
      <button
        type="button"
        className={
          danger ? "aperture-sidebar__row-action is-danger" : "aperture-sidebar__row-action"
        }
        aria-label={label}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
      >
        <Icon size={13} aria-hidden="true" />
      </button>
    </Tooltip>
  );
}
