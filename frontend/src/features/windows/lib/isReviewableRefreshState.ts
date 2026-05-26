import type { RefreshSlotState } from "../refresh/types";

export function isReviewableRefreshState(state: RefreshSlotState): boolean {
  return state === "drifted" || state === "source_deactivated";
}
