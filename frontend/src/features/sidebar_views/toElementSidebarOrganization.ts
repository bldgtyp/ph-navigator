import type { ElementSidebarItem, ElementSidebarOrganization } from "../../shared/ui";
import type { UseSidebarOrganizationResult } from "./useSidebarOrganization";

/**
 * Bridge the UI-agnostic `useSidebarOrganization` result into the shared
 * sidebar's `organization` prop, in one place so both the Apertures and
 * Envelope adapters wire it identically (uniformity by construction). Pass the
 * result through only for editors; hand `undefined` to the sidebar for viewers.
 */
export function toElementSidebarOrganization(
  org: UseSidebarOrganizationResult<ElementSidebarItem>,
): ElementSidebarOrganization {
  return {
    sortMode: org.sortMode,
    onToggleSortMode: org.onToggleSortMode,
    onReorder: org.onReorder,
    hasGroups: org.hasGroups,
    groups: org.groups,
    ungrouped: org.ungrouped,
    onAddGroup: org.onAddGroup,
    onRenameGroup: org.onRenameGroup,
    onDeleteGroup: org.onDeleteGroup,
    onMoveItemToContainer: org.onMoveItemToContainer,
    onReorderGroups: org.onReorderGroups,
    onReorderGroupMembers: org.onReorderGroupMembers,
    onToggleGroupCollapsed: org.onToggleGroupCollapsed,
  };
}
