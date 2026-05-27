import { Plus } from "lucide-react";
import { NavLink, createSearchParams } from "react-router-dom";
import { envelopeAssemblyPath } from "../paths";
import type { Assembly } from "../types";

export function EnvelopeSidebar({
  projectId,
  assemblies,
  activeId,
  search,
  canEdit,
  onAddAssembly,
}: {
  projectId: string;
  assemblies: Assembly[];
  activeId: string | null;
  search: URLSearchParams;
  canEdit: boolean;
  onAddAssembly: () => void;
}) {
  return (
    <aside className="envelope-sidebar" aria-label="Assemblies">
      <div className="envelope-sidebar-header">
        <h2>Assemblies</h2>
        <button
          type="button"
          className="icon-button"
          disabled={!canEdit}
          aria-label="Add assembly"
          data-tooltip="Add assembly"
          onClick={onAddAssembly}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="envelope-sidebar-list">
        {assemblies.map((assembly) => (
          <NavLink
            key={assembly.id}
            className={({ isActive }) =>
              isActive || assembly.id === activeId ? "active" : undefined
            }
            to={{
              pathname: envelopeAssemblyPath(projectId, assembly.id),
              search: createSearchParams(search).toString(),
            }}
          >
            <span>{assembly.name}</span>
            <small>{assembly.type}</small>
          </NavLink>
        ))}
      </div>
    </aside>
  );
}
