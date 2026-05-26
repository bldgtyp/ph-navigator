// Stable empty-array sentinel for memo dependencies.
// Inline `[]` literals invalidate `useMemo` / `useCallback` deps every
// render — a frozen module-scope value keeps identity stable across renders.
export const STABLE_EMPTY_ARRAY: readonly never[] = Object.freeze([]);

export function stableEmptyArray<T>(): readonly T[] {
  return STABLE_EMPTY_ARRAY as readonly T[];
}
