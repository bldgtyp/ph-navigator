import { useCallback, useMemo } from "react";
import {
  addGroup,
  buildSidebarTree,
  deleteGroup,
  moveItemToContainer,
  renameGroup,
  reorderGroups,
  setGroupMemberOrder,
} from "./groups";
import { useProjectSidebarViewState } from "./hooks";
import { applySidebarOrder } from "./lib";
import type { SidebarSortMode } from "./types";

export type UseSidebarOrganizationArgs<T extends { id: string }> = {
  projectId: string;
  /** Sidebar identity, e.g. `"apertures"` / `"assemblies"`. */
  viewKey: string;
  /** Persistence is editor-only; viewers get the identity ordering, no I/O. */
  canEdit: boolean;
  /** Items in their canonical (e.g. alphabetical) order. */
  items: T[];
};

/** A group resolved to its items plus its persisted collapse flag. */
export type SidebarGroupView<T> = {
  id: string;
  label: string;
  items: T[];
  collapsed: boolean;
};

export type UseSidebarOrganizationResult<T extends { id: string }> = {
  sortMode: SidebarSortMode;
  /** Flat list for alphabetical mode or manual mode with no groups. */
  orderedItems: T[];
  /** Manual-mode groups (empty when no groups defined). */
  groups: SidebarGroupView<T>[];
  /** Manual-mode items belonging to no group. */
  ungrouped: T[];
  /** True when at least one group is defined (render the tree, not the flat list). */
  hasGroups: boolean;
  /** Flip alphabetical ⇄ manual; switching to manual freezes the current order. */
  onToggleSortMode: () => void;
  /** Persist a new flat / ungrouped-section order (from a drag); implies manual. */
  onReorder: (orderedIds: string[]) => void;
  onAddGroup: (label?: string) => void;
  onRenameGroup: (groupId: string, label: string) => void;
  onDeleteGroup: (groupId: string) => void;
  /**
   * Drop-driven move: place an item into a container (group id, or `null` for
   * ungrouped) so that container's members become exactly `orderedIds`.
   */
  onMoveItemToContainer: (itemId: string, groupId: string | null, orderedIds: string[]) => void;
  onReorderGroups: (orderedGroupIds: string[]) => void;
  onReorderGroupMembers: (groupId: string, orderedIds: string[]) => void;
  onToggleGroupCollapsed: (groupId: string) => void;
  isLoading: boolean;
  saveError: string | null;
};

/**
 * Composes the sidebar persistence hook with ordering + grouping so both element
 * sidebars get identical organization behavior from one place (uniformity by
 * construction). Manual mode adds a flat drag order; defining groups turns the
 * list into a collapsible tree (groups → items, plus an ungrouped remainder).
 */
export function useSidebarOrganization<T extends { id: string }>({
  projectId,
  viewKey,
  canEdit,
  items,
}: UseSidebarOrganizationArgs<T>): UseSidebarOrganizationResult<T> {
  const { viewState, setViewState, isLoading, saveError } = useProjectSidebarViewState({
    projectId,
    viewKey,
    enabled: canEdit,
  });

  const isManual = viewState.sort_mode === "manual";

  const orderedItems = useMemo(
    () => (isManual ? applySidebarOrder(items, viewState.order) : items),
    [isManual, viewState.order, items],
  );

  const tree = useMemo(() => buildSidebarTree(items, viewState), [items, viewState]);
  const collapsed = useMemo(
    () => new Set(viewState.collapsed_group_ids),
    [viewState.collapsed_group_ids],
  );
  const groups = useMemo<SidebarGroupView<T>[]>(
    () =>
      tree.groups.map(({ group, items: groupItems }) => ({
        id: group.id,
        label: group.label,
        items: groupItems,
        collapsed: collapsed.has(group.id),
      })),
    [tree, collapsed],
  );

  const onToggleSortMode = useCallback(() => {
    const nextMode: SidebarSortMode = isManual ? "alphabetical" : "manual";
    // Switching to manual with no saved order freezes the current display order,
    // so the choice is immediately meaningful (new items append; alphabetical
    // re-sorts no longer reshuffle). Drag then rearranges via onReorder below.
    const nextOrder =
      nextMode === "manual" && viewState.order.length === 0
        ? items.map((item) => item.id)
        : viewState.order;
    setViewState({ ...viewState, sort_mode: nextMode, order: nextOrder });
  }, [isManual, viewState, setViewState, items]);

  const onReorder = useCallback(
    (orderedIds: string[]) => {
      // A drag only happens in manual mode; pin the mode defensively so the new
      // order can never be stranded behind an alphabetical sort.
      setViewState({ ...viewState, sort_mode: "manual", order: orderedIds });
    },
    [viewState, setViewState],
  );

  const onAddGroup = useCallback(
    // 1A: new groups are created as "Untitled group" (the button reads "New
    // group"); rename via the group Rename affordance.
    (label = "Untitled group") => setViewState(addGroup(viewState, label)),
    [viewState, setViewState],
  );
  const onRenameGroup = useCallback(
    (groupId: string, label: string) => setViewState(renameGroup(viewState, groupId, label)),
    [viewState, setViewState],
  );
  const onDeleteGroup = useCallback(
    (groupId: string) => setViewState(deleteGroup(viewState, groupId)),
    [viewState, setViewState],
  );
  const onMoveItemToContainer = useCallback(
    (itemId: string, groupId: string | null, orderedIds: string[]) =>
      setViewState(moveItemToContainer(viewState, itemId, groupId, orderedIds)),
    [viewState, setViewState],
  );
  const onReorderGroups = useCallback(
    (orderedGroupIds: string[]) => setViewState(reorderGroups(viewState, orderedGroupIds)),
    [viewState, setViewState],
  );
  const onReorderGroupMembers = useCallback(
    (groupId: string, orderedIds: string[]) =>
      setViewState(setGroupMemberOrder(viewState, groupId, orderedIds)),
    [viewState, setViewState],
  );
  const onToggleGroupCollapsed = useCallback(
    (groupId: string) => {
      const next = collapsed.has(groupId)
        ? viewState.collapsed_group_ids.filter((id) => id !== groupId)
        : [...viewState.collapsed_group_ids, groupId];
      setViewState({ ...viewState, collapsed_group_ids: next });
    },
    [collapsed, viewState, setViewState],
  );

  return {
    sortMode: viewState.sort_mode,
    orderedItems,
    groups,
    ungrouped: tree.ungrouped,
    hasGroups: groups.length > 0,
    onToggleSortMode,
    onReorder,
    onAddGroup,
    onRenameGroup,
    onDeleteGroup,
    onMoveItemToContainer,
    onReorderGroups,
    onReorderGroupMembers,
    onToggleGroupCollapsed,
    isLoading,
    saveError,
  };
}
