// Pure operations over the grouped sidebar view-state document. Groups are a
// manual-mode-only tree: each group owns an ordered `member_ids` list; items in
// no group are "ungrouped" and ordered by `order`. Every operation returns a new
// SidebarViewState (never mutates) so the persistence hook can diff + save.

import { applySidebarOrder } from "./lib";
import type { SidebarGroup, SidebarViewState } from "./types";

/** A group paired with its resolved, in-order items. */
export type SidebarTreeGroup<T> = {
  group: SidebarGroup;
  items: T[];
};

export type SidebarTree<T> = {
  groups: SidebarTreeGroup<T>[];
  /** Items belonging to no group, ordered by `view_state.order`. */
  ungrouped: T[];
};

/**
 * Resolve items into the group tree: each group's `member_ids` in order (stale
 * ids dropped, an id claimed by an earlier group is not double-listed), then the
 * remaining items as `ungrouped`, ordered by `order` with new items appended.
 */
export function buildSidebarTree<T extends { id: string }>(
  items: T[],
  viewState: SidebarViewState,
): SidebarTree<T> {
  const byId = new Map(items.map((item) => [item.id, item]));
  const claimed = new Set<string>();
  const groups = viewState.groups.map((group) => {
    const groupItems: T[] = [];
    for (const id of group.member_ids) {
      const item = byId.get(id);
      if (item && !claimed.has(id)) {
        groupItems.push(item);
        claimed.add(id);
      }
    }
    return { group, items: groupItems };
  });
  const ungroupedItems = items.filter((item) => !claimed.has(item.id));
  return { groups, ungrouped: applySidebarOrder(ungroupedItems, viewState.order) };
}

/** Mint a group id. Uses crypto.randomUUID when available, else a time-free fallback. */
export function newGroupId(existing: SidebarGroup[]): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `grp_${uuid}`;
  // Fallback: highest numeric suffix + 1, so ids stay unique without a clock.
  const max = existing.reduce((acc, group) => {
    const match = /^grp_(\d+)$/.exec(group.id);
    return match ? Math.max(acc, Number(match[1])) : acc;
  }, 0);
  return `grp_${max + 1}`;
}

export function addGroup(viewState: SidebarViewState, label: string): SidebarViewState {
  const group: SidebarGroup = {
    id: newGroupId(viewState.groups),
    label,
    member_ids: [],
  };
  return { ...viewState, sort_mode: "manual", groups: [...viewState.groups, group] };
}

export function renameGroup(
  viewState: SidebarViewState,
  groupId: string,
  label: string,
): SidebarViewState {
  return {
    ...viewState,
    groups: viewState.groups.map((group) => (group.id === groupId ? { ...group, label } : group)),
  };
}

/** Delete a group; its members fall back to ungrouped (they simply leave the tree). */
export function deleteGroup(viewState: SidebarViewState, groupId: string): SidebarViewState {
  return {
    ...viewState,
    groups: viewState.groups.filter((group) => group.id !== groupId),
    collapsed_group_ids: viewState.collapsed_group_ids.filter((id) => id !== groupId),
  };
}

/**
 * Assign an item to a group (or to `null` for ungrouped). The item is removed
 * from every group's `member_ids` first, then appended to the target group.
 */
export function moveItemToGroup(
  viewState: SidebarViewState,
  itemId: string,
  groupId: string | null,
): SidebarViewState {
  const groups = viewState.groups.map((group) => {
    const without = group.member_ids.filter((id) => id !== itemId);
    if (group.id === groupId) return { ...group, member_ids: [...without, itemId] };
    if (without.length === group.member_ids.length) return group;
    return { ...group, member_ids: without };
  });
  return { ...viewState, sort_mode: "manual", groups };
}

export function reorderGroups(
  viewState: SidebarViewState,
  orderedGroupIds: string[],
): SidebarViewState {
  const byId = new Map(viewState.groups.map((group) => [group.id, group]));
  const seen = new Set<string>();
  const groups: SidebarGroup[] = [];
  for (const id of orderedGroupIds) {
    const group = byId.get(id);
    if (group && !seen.has(id)) {
      groups.push(group);
      seen.add(id);
    }
  }
  for (const group of viewState.groups) {
    if (!seen.has(group.id)) groups.push(group);
  }
  return { ...viewState, groups };
}

/** Reorder the items within one group (from a drag inside that group's section). */
export function setGroupMemberOrder(
  viewState: SidebarViewState,
  groupId: string,
  orderedMemberIds: string[],
): SidebarViewState {
  return {
    ...viewState,
    groups: viewState.groups.map((group) =>
      group.id === groupId ? { ...group, member_ids: orderedMemberIds } : group,
    ),
  };
}
