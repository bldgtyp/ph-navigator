import { Copy, Trash2 } from "lucide-react";
import { ElementSidebar, type ElementSidebarItem } from "../../../shared/ui";
import { useSidebarOrganization } from "../../sidebar_views/useSidebarOrganization";
import { nameCollides } from "../lib";
import type { ApertureTypeEntry } from "../types";

/**
 * Aperture Types sidebar — a thin adapter over the shared {@link ElementSidebar}.
 * Selection is state-based (`onSelect`); rows carry no leading icon.
 */
export function ApertureSidebar({
  projectId,
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
  projectId: string;
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
  const items: ElementSidebarItem[] = apertures.map((aperture) => ({
    id: aperture.id,
    name: aperture.name,
    onRename: (name) => onRename(aperture, name),
    getRenameValidationMessage: (name) => {
      if (!nameCollides(apertures, name.trim(), aperture.id)) return null;
      return `An aperture type named '${name.trim()}' already exists in this version.`;
    },
    actions: [
      {
        key: "duplicate",
        label: "Duplicate aperture type",
        icon: Copy,
        onClick: () => onDuplicate(aperture),
      },
      {
        key: "delete",
        label: "Delete aperture type",
        icon: Trash2,
        danger: true,
        onClick: () => onDelete(aperture),
      },
    ],
  }));

  const org = useSidebarOrganization({ projectId, viewKey: "apertures", canEdit, items });

  return (
    <ElementSidebar
      title="Aperture Types"
      ariaLabel="Aperture types"
      toggleNoun="aperture"
      idPrefix="aperture-sidebar"
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      canEdit={canEdit}
      actionDisabled={actionDisabled}
      items={org.orderedItems}
      activeId={activeApertureId}
      navigation={{ mode: "select", onSelect }}
      rename={{
        actionLabel: "Rename aperture type",
        inputLabel: "Aperture type name",
        editLabel: "Edit aperture type name",
      }}
      add={canEdit ? { label: "Add aperture type", onAdd, disabled: actionDisabled } : null}
      organization={
        canEdit
          ? {
              sortMode: org.sortMode,
              onToggleSortMode: org.onToggleSortMode,
              onReorder: org.onReorder,
            }
          : undefined
      }
    />
  );
}
