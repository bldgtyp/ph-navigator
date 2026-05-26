import { useState } from "react";
import { applyRefToWindowTypes, findSlotRef, refreshSlotLookupKey } from "../refresh/lib";
import type { RefreshSlotName, RefreshSlotReport } from "../refresh/types";
import type { FrameRef, GlazingRef, WindowTypeEntry } from "../types";

type ActiveRefreshTarget = {
  windowTypeId: string;
  elementId: string;
  slot: RefreshSlotName;
};

export function useWindowsRefreshController({
  windowTypes,
  refreshSlots,
  commitWindowTypes,
}: {
  windowTypes: WindowTypeEntry[];
  refreshSlots: { byTarget: Map<string, RefreshSlotReport> };
  commitWindowTypes: (nextList: WindowTypeEntry[]) => Promise<boolean>;
}) {
  const [activeRefresh, setActiveRefresh] = useState<ActiveRefreshTarget | null>(null);
  const [reviewAllOpen, setReviewAllOpen] = useState(false);

  const refreshSlot = activeRefresh
    ? (refreshSlots.byTarget.get(
        refreshSlotLookupKey(
          activeRefresh.windowTypeId,
          activeRefresh.elementId,
          activeRefresh.slot,
        ),
      ) ?? null)
    : null;
  const refreshRef =
    activeRefresh && refreshSlot
      ? findSlotRef(
          windowTypes,
          activeRefresh.windowTypeId,
          activeRefresh.elementId,
          activeRefresh.slot,
        )
      : null;

  const applyRefresh = async (nextRef: FrameRef | GlazingRef) => {
    if (!activeRefresh) return;
    const nextList = applyRefToWindowTypes(
      windowTypes,
      activeRefresh.windowTypeId,
      activeRefresh.elementId,
      activeRefresh.slot,
      nextRef,
    );
    const saved = await commitWindowTypes(nextList);
    if (saved) setActiveRefresh(null);
  };

  return {
    reviewAllOpen,
    refreshSlot,
    refreshRef,
    openReviewAll: () => setReviewAllOpen(true),
    closeReviewAll: () => setReviewAllOpen(false),
    startRefresh: setActiveRefresh,
    cancelRefresh: () => setActiveRefresh(null),
    applyRefresh,
  };
}
