import { RefreshDialog } from "../refresh/RefreshDialog";
import { RefreshReviewAllModal } from "../refresh/RefreshReviewAllModal";
import type { RefreshSlotName, RefreshSlotReport } from "../refresh/types";
import type { FrameRef, GlazingRef, WindowTypeEntry } from "../types";

type ReviewTarget = {
  windowTypeId: string;
  elementId: string;
  slot: RefreshSlotName;
};

export function WindowsRefreshDialogs({
  refreshSlot,
  refreshRef,
  replaceBusy,
  reviewAllOpen,
  reviewableRefreshSlots,
  windowTypes,
  onCancelRefresh,
  onApplyRefresh,
  onCloseReviewAll,
  onReview,
}: {
  refreshSlot: RefreshSlotReport | null;
  refreshRef: FrameRef | GlazingRef | null;
  replaceBusy: boolean;
  reviewAllOpen: boolean;
  reviewableRefreshSlots: RefreshSlotReport[];
  windowTypes: WindowTypeEntry[];
  onCancelRefresh: () => void;
  onApplyRefresh: (nextRef: FrameRef | GlazingRef) => void;
  onCloseReviewAll: () => void;
  onReview: (target: ReviewTarget) => void;
}) {
  return (
    <>
      {refreshSlot && refreshRef ? (
        <RefreshDialog
          slot={refreshSlot}
          refValue={refreshRef}
          busy={replaceBusy}
          onCancel={onCancelRefresh}
          onApply={onApplyRefresh}
        />
      ) : null}
      {reviewAllOpen ? (
        <RefreshReviewAllModal
          slots={reviewableRefreshSlots}
          windowTypes={windowTypes}
          onClose={onCloseReviewAll}
          onReview={onReview}
        />
      ) : null}
    </>
  );
}
