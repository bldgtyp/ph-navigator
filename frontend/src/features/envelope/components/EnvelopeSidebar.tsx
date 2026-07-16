import {
  BrickWall,
  CircleHelp,
  Copy,
  House,
  Layers,
  Shapes,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { createSearchParams } from "react-router-dom";
import { ElementSidebar, type ElementSidebarItem } from "../../../shared/ui";
import { envelopeAssemblyPath } from "../paths";
import type { Assembly, AssemblyType } from "../types";

/**
 * Assemblies sidebar — a thin adapter over the shared {@link ElementSidebar}.
 * Navigation is routing-based (`NavLink`); each row leads with its
 * assembly-type icon and carries `data-assembly-type`.
 */
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
  const items: ElementSidebarItem[] = assemblies.map((assembly) => ({
    id: assembly.id,
    name: assembly.name,
    leadingIcon: assemblyTypeIcon(assembly.type),
    linkData: { "data-assembly-type": assembly.type },
    onRename: (name) => onRename(assembly, name),
    actions: [
      {
        key: "change-type",
        label: "Change assembly type",
        icon: Shapes,
        onClick: () => onTypeChange(assembly),
      },
      {
        key: "duplicate",
        label: "Duplicate assembly",
        icon: Copy,
        onClick: () => onDuplicate(assembly),
      },
      {
        key: "delete",
        label: "Delete assembly",
        icon: Trash2,
        danger: true,
        onClick: () => onDelete(assembly),
      },
    ],
  }));

  return (
    <ElementSidebar
      title="Assemblies"
      ariaLabel="Assemblies"
      toggleNoun="assembly"
      idPrefix="assembly-sidebar"
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      canEdit={canEdit}
      actionDisabled={actionDisabled}
      items={items}
      activeId={activeId}
      navigation={{
        mode: "link",
        buildTo: (item) => ({ pathname: envelopeAssemblyPath(projectId, item.id), search: query }),
      }}
      rename={{
        actionLabel: "Rename assembly",
        inputLabel: "Assembly name",
        editLabel: "Edit assembly name",
      }}
      add={{ label: "Add assembly", onAdd: onAddAssembly, disabled: !canEdit }}
    />
  );
}

function assemblyTypeIcon(type: AssemblyType): LucideIcon {
  switch (type) {
    case "wall":
      return BrickWall;
    case "roof":
      return House;
    case "floor":
      return Layers;
    case "other":
      return CircleHelp;
  }
}
