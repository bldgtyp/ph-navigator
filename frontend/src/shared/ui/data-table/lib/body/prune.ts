import type { GroupRule } from "../../types";

// Drop expandedGroups entries whose path depth exceeds the new group
// depth, so stale deep-path keys don't accumulate across re-grouping.
export function pruneExpandedGroups(
  map: Record<string, boolean>,
  nextGroup: readonly GroupRule[],
): Record<string, boolean> {
  const maxDepth = nextGroup.length;
  if (maxDepth === 0) return {};
  const next: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(map)) {
    // JSON.stringify never emits "::" for any primitive — split-count
    // is the segment count.
    const depth = key.split("::").length;
    if (depth <= maxDepth) next[key] = value;
  }
  return next;
}
