// Immutable single-row patch, shared by the command-journal bindings that
// reproduce a server field edit on a cached slice.
/**
 * Return `rows` with `patch` merged into the row whose id is `rowId`, or `null`
 * when no row matches.
 *
 * `null` rather than the original array so a caller can return its whole slice
 * unchanged — an optimistic apply for a row the slice no longer holds must be a
 * no-op, not a new object identity that re-renders every consumer.
 */
export function patchRowById<TRow extends { id: string }>(
  rows: readonly TRow[],
  rowId: string,
  patch: Partial<NoInfer<TRow>>,
): TRow[] | null {
  let matched = false;
  const next = rows.map((row) => {
    if (row.id !== rowId) return row;
    matched = true;
    return { ...row, ...patch };
  });
  return matched ? next : null;
}
