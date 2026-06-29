import {
  BrickWall,
  CircleHelp,
  Copy,
  House,
  Layers,
  Pencil,
  Shapes,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  type LucideIcon,
} from "lucide-react";
import {
  useState,
  type Dispatch,
  type FocusEvent,
  type MouseEvent,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { NavLink, createSearchParams } from "react-router-dom";
import { InlineHeaderNameEditor, Tooltip } from "../../../shared/ui";
import { envelopeAssemblyPath } from "../paths";
import type { Assembly, AssemblyType } from "../types";

type NameTooltipState = {
  assemblyId: string;
  left: number;
  name: string;
  top: number;
};

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
  onRename: (assembly: Assembly, name: string) => void;
  onTypeChange: (assembly: Assembly) => void;
  onDuplicate: (assembly: Assembly) => void;
  onDelete: (assembly: Assembly) => void;
}) {
  const query = createSearchParams(search).toString();
  const [editingAssemblyId, setEditingAssemblyId] = useState<string | null>(null);
  const [nameTooltip, setNameTooltip] = useState<NameTooltipState | null>(null);
  const addAssemblyButton = (
    <Tooltip content="Add assembly" placement={collapsed ? "right" : "bottom"}>
      <button
        id={collapsed ? "assembly-sidebar-add-collapsed" : "assembly-sidebar-add"}
        type="button"
        className={collapsed ? "icon-button envelope-sidebar-add-collapsed" : "icon-button"}
        disabled={!canEdit}
        aria-label="Add assembly"
        onClick={onAddAssembly}
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </Tooltip>
  );

  return (
    <aside
      id="assembly-sidebar"
      className={collapsed ? "envelope-sidebar is-collapsed" : "envelope-sidebar"}
      aria-label="Assemblies"
    >
      <div id="assembly-sidebar-header" className="envelope-sidebar-header">
        {collapsed ? null : <h2>Assemblies</h2>}
        <div className="envelope-sidebar-tools">
          <Tooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"} placement="bottom">
            <button
              id="assembly-sidebar-toggle"
              type="button"
              className="icon-button"
              aria-label={collapsed ? "Expand assembly sidebar" : "Collapse assembly sidebar"}
              onClick={onToggleCollapsed}
            >
              {collapsed ? (
                <PanelLeftOpen size={16} aria-hidden="true" />
              ) : (
                <PanelLeftClose size={16} aria-hidden="true" />
              )}
            </button>
          </Tooltip>
          {collapsed ? null : addAssemblyButton}
        </div>
      </div>
      {collapsed ? null : (
        <div id="assembly-sidebar-list" className="envelope-sidebar-list">
          {assemblies.map((assembly) => {
            const isCurrent = assembly.id === activeId;
            const isEditing = editingAssemblyId === assembly.id;
            const typeIcon = assemblyTypeIcon(assembly.type);
            const AssemblyTypeIcon = typeIcon.icon;
            const tooltipId = assemblyNameTooltipId(assembly.id);
            const isNameTooltipVisible = nameTooltip?.assemblyId === assembly.id;
            return (
              <div
                key={assembly.id}
                id={`assembly-sidebar-row-${assembly.id}`}
                className={isCurrent ? "envelope-sidebar-row active" : "envelope-sidebar-row"}
              >
                {isEditing ? (
                  <InlineHeaderNameEditor
                    value={assembly.name}
                    variant="inline"
                    canEdit={canEdit}
                    busy={actionDisabled}
                    editLabel="Edit assembly name"
                    inputLabel="Assembly name"
                    showEditButton={false}
                    editing={isEditing}
                    onEditingChange={(editing) =>
                      setEditingAssemblyId(editing ? assembly.id : null)
                    }
                    onSubmit={(name) => onRename(assembly, name)}
                  />
                ) : (
                  <NavLink
                    className="envelope-sidebar-row-name"
                    data-assembly-type={assembly.type}
                    aria-describedby={isNameTooltipVisible ? tooltipId : undefined}
                    onBlur={() => hideNameTooltip(assembly.id, setNameTooltip)}
                    onFocus={(event) => showNameTooltip(assembly, event, setNameTooltip)}
                    onMouseEnter={(event) => showNameTooltip(assembly, event, setNameTooltip)}
                    onMouseLeave={() => hideNameTooltip(assembly.id, setNameTooltip)}
                    to={{
                      pathname: envelopeAssemblyPath(projectId, assembly.id),
                      search: query,
                    }}
                  >
                    <AssemblyTypeIcon
                      className="envelope-sidebar-row-type-icon"
                      size={14}
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <span className="envelope-sidebar-row-name-text">{assembly.name}</span>
                  </NavLink>
                )}
                {canEdit && !isEditing ? (
                  <span
                    id={`assembly-sidebar-row-actions-${assembly.id}`}
                    className="envelope-sidebar-row-actions"
                    aria-label="Assembly actions"
                  >
                    <SidebarActionButton
                      id={`assembly-sidebar-rename-${assembly.id}`}
                      label="Rename assembly"
                      tooltip="Rename assembly"
                      icon={Pencil}
                      disabled={actionDisabled}
                      onClick={() => setEditingAssemblyId(assembly.id)}
                    />
                    <SidebarActionButton
                      id={`assembly-sidebar-change-type-${assembly.id}`}
                      label="Change assembly type"
                      tooltip="Change assembly type"
                      icon={Shapes}
                      disabled={actionDisabled}
                      onClick={() => onTypeChange(assembly)}
                    />
                    <SidebarActionButton
                      id={`assembly-sidebar-duplicate-${assembly.id}`}
                      label="Duplicate assembly"
                      tooltip="Duplicate assembly"
                      icon={Copy}
                      disabled={actionDisabled}
                      onClick={() => onDuplicate(assembly)}
                    />
                    <SidebarActionButton
                      id={`assembly-sidebar-delete-${assembly.id}`}
                      label="Delete assembly"
                      tooltip="Delete assembly"
                      icon={Trash2}
                      disabled={actionDisabled}
                      danger
                      onClick={() => onDelete(assembly)}
                    />
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {collapsed ? addAssemblyButton : null}
      {nameTooltip
        ? createPortal(
            <div
              id={assemblyNameTooltipId(nameTooltip.assemblyId)}
              className="envelope-sidebar-name-tooltip"
              role="tooltip"
              style={{ left: nameTooltip.left, top: nameTooltip.top }}
            >
              {nameTooltip.name}
            </div>,
            document.body,
          )
        : null}
    </aside>
  );
}

function assemblyTypeIcon(type: AssemblyType): { icon: LucideIcon } {
  switch (type) {
    case "wall":
      return { icon: BrickWall };
    case "roof":
      return { icon: House };
    case "floor":
      return { icon: Layers };
    case "other":
      return { icon: CircleHelp };
  }
}

function assemblyNameTooltipId(assemblyId: string): string {
  return `assembly-sidebar-name-tooltip-${assemblyId}`;
}

function showNameTooltip(
  assembly: Assembly,
  event: FocusEvent<HTMLAnchorElement> | MouseEvent<HTMLAnchorElement>,
  setNameTooltip: Dispatch<SetStateAction<NameTooltipState | null>>,
): void {
  const row = event.currentTarget.closest(".envelope-sidebar-row") ?? event.currentTarget;
  const rect = row.getBoundingClientRect();
  setNameTooltip({
    assemblyId: assembly.id,
    left: rect.right + 10,
    name: assembly.name,
    top: rect.top + rect.height / 2,
  });
}

function hideNameTooltip(
  assemblyId: string,
  setNameTooltip: Dispatch<SetStateAction<NameTooltipState | null>>,
): void {
  setNameTooltip((current) => (current?.assemblyId === assemblyId ? null : current));
}

function SidebarActionButton({
  id,
  label,
  tooltip,
  icon: Icon,
  disabled = false,
  danger = false,
  onClick,
}: {
  id?: string;
  label: string;
  tooltip: string;
  icon: LucideIcon;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip content={tooltip} placement="right">
      <button
        id={id}
        type="button"
        className={danger ? "envelope-sidebar-row-action is-danger" : "envelope-sidebar-row-action"}
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
