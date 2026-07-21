// Pure drag-drop math for the grouped sidebar's single multi-container
// DndContext. Kept UI-free so the cross-group placement logic is unit-testable
// without simulating pointer events (dnd-kit sensors don't run under jsdom).

import { arrayMove } from "@dnd-kit/sortable";

/** Sentinel container id for the ungrouped remainder (groups use their own id). */
export const UNGROUPED_CONTAINER = "__ungrouped__";

/** dnd-kit droppable id for a container's own body (the target when a drop lands
 * on empty space rather than on a specific row). */
export function containerDroppableId(containerId: string): string {
  return `sidebar-container:${containerId}`;
}

function parseContainerDroppableId(droppableId: string): string | null {
  const prefix = "sidebar-container:";
  return droppableId.startsWith(prefix) ? droppableId.slice(prefix.length) : null;
}

/** A drop container: a group (id = group id) or the ungrouped remainder, with its
 * member item ids in display order. */
export type DropContainer = { id: string; itemIds: string[] };

export type SidebarDrop =
  | { kind: "none" }
  /** Reorder within one container: persist `orderedIds` as that container's order. */
  | { kind: "reorder"; containerId: string; orderedIds: string[] }
  /** Move `itemId` into `targetContainerId`, whose members become `orderedIds`. */
  | { kind: "move"; itemId: string; targetContainerId: string; orderedIds: string[] };

/**
 * Resolve a drag end into a persistence action. `activeId` is the dragged row;
 * `overId` is the row or container droppable under the pointer at release.
 * Same-container drops become a `reorder`; cross-container drops become a `move`
 * that inserts the item before the row it was dropped on (or at the end when
 * dropped on empty container space).
 */
export function computeSidebarDrop(
  activeId: string,
  overId: string | null,
  containers: DropContainer[],
): SidebarDrop {
  if (!overId || overId === activeId) return { kind: "none" };

  const source = containers.find((container) => container.itemIds.includes(activeId));
  if (!source) return { kind: "none" };

  const overContainerId = parseContainerDroppableId(overId);
  let target: DropContainer | undefined;
  let index: number;
  if (overContainerId !== null) {
    target = containers.find((container) => container.id === overContainerId);
    index = target ? target.itemIds.length : 0; // dropped on empty space → append
  } else {
    target = containers.find((container) => container.itemIds.includes(overId));
    index = target ? target.itemIds.indexOf(overId) : 0;
  }
  if (!target) return { kind: "none" };

  if (source.id === target.id) {
    const from = source.itemIds.indexOf(activeId);
    if (from === index) return { kind: "none" };
    return {
      kind: "reorder",
      containerId: source.id,
      orderedIds: arrayMove(source.itemIds, from, index),
    };
  }

  const orderedIds = target.itemIds.slice();
  orderedIds.splice(index, 0, activeId);
  return { kind: "move", itemId: activeId, targetContainerId: target.id, orderedIds };
}
