import { PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { NavLink, createSearchParams } from "react-router-dom";
import { envelopeAssemblyPath } from "../paths";
import type { Assembly } from "../types";

export function EnvelopeSidebar({
  projectId,
  assemblies,
  activeId,
  search,
  canEdit,
  collapsed,
  onToggleCollapsed,
  onAddAssembly,
}: {
  projectId: string;
  assemblies: Assembly[];
  activeId: string | null;
  search: URLSearchParams;
  canEdit: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onAddAssembly: () => void;
}) {
  const query = createSearchParams(search).toString();
  const addAssemblyButton = (
    <button
      type="button"
      className={collapsed ? "icon-button envelope-sidebar-add-collapsed" : "icon-button"}
      disabled={!canEdit}
      aria-label="Add assembly"
      data-tooltip="Add assembly"
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
            data-tooltip={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onToggleCollapsed}
          >
            {collapsed ? (
              <PanelLeftOpen size={16} aria-hidden="true" />
            ) : (
              <PanelLeftClose size={16} aria-hidden="true" />
            )}
          </button>
          {collapsed ? null : addAssemblyButton}
        </div>
      </div>
      {collapsed ? null : (
        <div className="envelope-sidebar-list">
          {assemblies.map((assembly) => (
            <NavLink
              key={assembly.id}
              className={({ isActive }) =>
                isActive || assembly.id === activeId ? "active" : undefined
              }
              to={{
                pathname: envelopeAssemblyPath(projectId, assembly.id),
                search: query,
              }}
            >
              <span>{assembly.name}</span>
            </NavLink>
          ))}
        </div>
      )}
      {collapsed ? addAssemblyButton : null}
    </aside>
  );
}
