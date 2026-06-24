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
import { createPortal } from "react-dom";
import { InlineHeaderNameEditor } from "../../../shared/ui/InlineHeaderNameEditor";
import { nameCollides } from "../lib";
import type { ApertureTypeEntry } from "../types";

type SidebarTooltipState = {
  label: string;
  left: number;
  top: number;
};

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
  const [tooltip, setTooltip] = useState<SidebarTooltipState | null>(null);
  const showTooltip = (label: string, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    setTooltip({
      label,
      left: rect.left + rect.width / 2,
      top: rect.top - 8,
    });
  };
  const hideTooltip = () => setTooltip(null);
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
                  <span
                    className="aperture-sidebar__item-name"
                    onPointerEnter={(event) => showTooltip(aperture.name, event.currentTarget)}
                    onPointerLeave={hideTooltip}
                  >
                    {aperture.name}
                  </span>
                )}
                {canEdit && !isEditing ? (
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
                      onHideTooltip={hideTooltip}
                      onShowTooltip={showTooltip}
                      onClick={() => setEditingApertureId(aperture.id)}
                    />
                    <SidebarActionButton
                      label="Duplicate aperture type"
                      tooltip="Duplicate aperture type"
                      icon={Copy}
                      disabled={actionDisabled}
                      onHideTooltip={hideTooltip}
                      onShowTooltip={showTooltip}
                      onClick={() => onDuplicate(aperture)}
                    />
                    <SidebarActionButton
                      label="Delete aperture type"
                      tooltip="Delete aperture type"
                      icon={Trash2}
                      disabled={actionDisabled}
                      danger
                      onHideTooltip={hideTooltip}
                      onShowTooltip={showTooltip}
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
      {tooltip
        ? createPortal(
            <div
              className="aperture-sidebar__floating-tooltip"
              role="tooltip"
              style={{ left: tooltip.left, top: tooltip.top }}
            >
              {tooltip.label}
            </div>,
            document.body,
          )
        : null}
    </aside>
  );
}

function SidebarActionButton({
  label,
  tooltip,
  icon: Icon,
  disabled = false,
  danger = false,
  onHideTooltip,
  onShowTooltip,
  onClick,
}: {
  label: string;
  tooltip: string;
  icon: LucideIcon;
  disabled?: boolean;
  danger?: boolean;
  onHideTooltip: () => void;
  onShowTooltip: (label: string, target: HTMLElement) => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={danger ? "aperture-sidebar__row-action is-danger" : "aperture-sidebar__row-action"}
      aria-label={label}
      disabled={disabled}
      onBlur={onHideTooltip}
      onClick={(event) => {
        event.stopPropagation();
        onHideTooltip();
        onClick();
      }}
      onFocus={(event) => onShowTooltip(tooltip, event.currentTarget)}
      onPointerEnter={(event) => onShowTooltip(tooltip, event.currentTarget)}
      onPointerLeave={onHideTooltip}
    >
      <Icon size={13} aria-hidden="true" />
    </button>
  );
}
