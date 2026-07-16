// Feature-local constants governing sidebar view-state persistence cadence and
// error messaging — the single place to tune them. Mirrors `table_views/lib.ts`.

export const SAVE_DEBOUNCE_MS = 500;

export const SAVE_FALLBACK_MESSAGE = "Sidebar layout persistence unavailable.";

/**
 * Order `items` by a persisted list of ids. Ids present in `order` lead, in
 * that order; any item not named in `order` (a newly created one, or a stale
 * order that predates it) is appended in its incoming order. Ids in `order`
 * that no longer match an item are skipped. An empty `order` is the identity.
 */
export function applySidebarOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  if (order.length === 0) return items;
  const byId = new Map(items.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const ordered: T[] = [];
  for (const id of order) {
    const item = byId.get(id);
    if (item && !seen.has(id)) {
      ordered.push(item);
      seen.add(id);
    }
  }
  for (const item of items) {
    if (!seen.has(item.id)) ordered.push(item);
  }
  return ordered;
}
