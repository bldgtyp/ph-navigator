import { useCallback, useMemo } from "react";
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

export type UseSidebarOrganizationResult<T extends { id: string }> = {
  sortMode: SidebarSortMode;
  /** `items` reordered per the persisted manual order when in manual mode. */
  orderedItems: T[];
  /** Flip alphabetical ⇄ manual; switching to manual freezes the current order. */
  onToggleSortMode: () => void;
  /** Persist a new manual order (from a drag); implies manual mode. */
  onReorder: (orderedIds: string[]) => void;
  isLoading: boolean;
  saveError: string | null;
};

/**
 * Composes the sidebar persistence hook with ordering so both element sidebars
 * get identical organization behavior from one place (uniformity by
 * construction). Phase 1 wires sort mode + manual order; grouping/collapse
 * (Phases 3–4) extend the same persisted document.
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

  const orderedItems = useMemo(
    () => (viewState.sort_mode === "manual" ? applySidebarOrder(items, viewState.order) : items),
    [viewState.sort_mode, viewState.order, items],
  );

  const onToggleSortMode = useCallback(() => {
    const nextMode: SidebarSortMode = viewState.sort_mode === "manual" ? "alphabetical" : "manual";
    // Switching to manual with no saved order freezes the current display order,
    // so the choice is immediately meaningful (new items append; alphabetical
    // re-sorts no longer reshuffle). Drag then rearranges via onReorder below.
    const nextOrder =
      nextMode === "manual" && viewState.order.length === 0
        ? items.map((item) => item.id)
        : viewState.order;
    setViewState({ ...viewState, sort_mode: nextMode, order: nextOrder });
  }, [viewState, setViewState, items]);

  const onReorder = useCallback(
    (orderedIds: string[]) => {
      // A drag only happens in manual mode; pin the mode defensively so the new
      // order can never be stranded behind an alphabetical sort.
      setViewState({ ...viewState, sort_mode: "manual", order: orderedIds });
    },
    [viewState, setViewState],
  );

  return {
    sortMode: viewState.sort_mode,
    orderedItems,
    onToggleSortMode,
    onReorder,
    isLoading,
    saveError,
  };
}
