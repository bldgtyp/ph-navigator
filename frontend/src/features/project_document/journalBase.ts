// Journal wiring shared by every `SliceWriteJournal` call site.
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { refetchResultData } from "./table-slice";

/**
 * Build a `SliceWriteJournal` `prepareBase` that reuses the acknowledged slice
 * unless it is stale — either because a write asked to refresh it, or because
 * something invalidated the read query while the write was queued.
 *
 * `resolve` is read at dispatch time rather than captured, so a journal built
 * once keeps using the current query client, key, and refetch function.
 */
export function refreshInvalidatedBase<TSlice>(
  resolve: () => {
    queryClient: QueryClient;
    queryKey: QueryKey | null;
    refetch: () => Promise<unknown>;
  },
): (slice: TSlice, forceRefresh: boolean) => Promise<TSlice> {
  return async (slice, forceRefresh) => {
    const { queryClient, queryKey, refetch } = resolve();
    if (!queryKey) return slice;
    if (!forceRefresh && !queryClient.getQueryState(queryKey)?.isInvalidated) return slice;
    return refetchResultData<TSlice>(await refetch()) ?? slice;
  };
}
