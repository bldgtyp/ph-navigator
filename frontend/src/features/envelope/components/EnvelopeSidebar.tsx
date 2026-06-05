import {
  Copy,
  Download,
  Pencil,
  Shapes,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { NavLink, createSearchParams } from "react-router-dom";
import { envelopeAssemblyPath } from "../paths";
import type { Assembly } from "../types";

export function EnvelopeSidebar({
  projectId,
  assemblies,
  activeId,
  search,
  canEdit,
  actionDisabled,
  collapsed,
  onToggleCollapsed,
  onAddAssembly,
  exportBusy,
  onExportHbjson,
  onRename,
  onTypeChange,
  onDuplicate,
  onDelete,
}: {
  projectId: string;
  assemblies: Assembly[];
  activeId: string | null;
  search: URLSearchParams;
  canEdit: boolean;
  actionDisabled: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onAddAssembly: () => void;
  exportBusy: boolean;
  onExportHbjson: () => void;
  onRename: (assembly: Assembly) => void;
  onTypeChange: (assembly: Assembly) => void;
  onDuplicate: (assembly: Assembly) => void;
  onDelete: (assembly: Assembly) => void;
}) {
  const query = createSearchParams(search).toString();
  const addAssemblyButton = (
    <button
      type="button"
      className={collapsed ? "icon-button envelope-sidebar-add-collapsed" : "icon-button"}
      disabled={!canEdit}
      aria-label="Add assembly"
      data-sidebar-tooltip="Add assembly"
      onClick={onAddAssembly}
    >
      <Plus size={16} aria-hidden="true" />
    </button>
  );

  return (
    <aside
      className={collapsed ? "envelope-sidebar is-collapsed" : "envelope-sidebar"}
      aria-label="Assemblies"
    >
      <div className="envelope-sidebar-header">
        {collapsed ? null : <h2>Assemblies</h2>}
        <div className="envelope-sidebar-tools">
          <button
            type="button"
            className="icon-button"
            aria-label={collapsed ? "Expand assembly sidebar" : "Collapse assembly sidebar"}
            data-sidebar-tooltip={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onToggleCollapsed}
          >
            {collapsed ? (
              <PanelLeftOpen size={16} aria-hidden="true" />
            ) : (
              <PanelLeftClose size={16} aria-hidden="true" />
            )}
          </button>
          {collapsed ? null : (
            <>
              <button
                type="button"
                className="icon-button"
                aria-label="Download constructions HBJSON"
                data-sidebar-tooltip="Download constructions (HBJSON)"
                disabled={exportBusy}
                onClick={onExportHbjson}
              >
                <Download size={16} aria-hidden="true" />
              </button>
              {addAssemblyButton}
            </>
          )}
        </div>
      </div>
      {collapsed ? null : (
        <div className="envelope-sidebar-list">
          {assemblies.map((assembly) => {
            const isCurrent = assembly.id === activeId;
            return (
              <NavLink
                key={assembly.id}
                className={({ isActive }) =>
                  isActive || isCurrent ? "envelope-sidebar-row active" : "envelope-sidebar-row"
                }
                to={{
                  pathname: envelopeAssemblyPath(projectId, assembly.id),
                  search: query,
                }}
              >
                <span className="envelope-sidebar-row-name">{assembly.name}</span>
                {canEdit ? (
                  <span className="envelope-sidebar-row-actions" aria-label="Assembly actions">
                    <SidebarActionButton
                      label="Rename assembly"
                      tooltip="Rename assembly"
                      icon={Pencil}
                      disabled={actionDisabled}
                      onClick={() => onRename(assembly)}
                    />
                    <SidebarActionButton
                      label="Change assembly type"
                      tooltip="Change assembly type"
                      icon={Shapes}
                      disabled={actionDisabled}
                      onClick={() => onTypeChange(assembly)}
                    />
                    <SidebarActionButton
                      label="Duplicate assembly"
                      tooltip="Duplicate assembly"
                      icon={Copy}
                      disabled={actionDisabled}
                      onClick={() => onDuplicate(assembly)}
                    />
                    <SidebarActionButton
                      label="Delete assembly"
                      tooltip="Delete assembly"
                      icon={Trash2}
                      disabled={actionDisabled}
                      danger
                      onClick={() => onDelete(assembly)}
                    />
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </div>
      )}
      {collapsed ? addAssemblyButton : null}
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
      className={danger ? "envelope-sidebar-row-action is-danger" : "envelope-sidebar-row-action"}
      aria-label={label}
      data-sidebar-tooltip={tooltip}
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
    >
      <Icon size={13} aria-hidden="true" />
    </button>
  );
}
