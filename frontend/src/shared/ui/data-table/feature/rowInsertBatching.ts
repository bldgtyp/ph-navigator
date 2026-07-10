import type { RowInsertPayload } from "../types";

export function flattenBatchedRowInserts(
  batches: ReadonlyArray<ReadonlyArray<RowInsertPayload>>,
): RowInsertPayload[] {
  const lastInsertedByOriginalAnchor = new Map<string | null, string>();
  const rewritten: RowInsertPayload[] = [];
  for (const rows of batches) {
    for (const row of rows) {
      const originalAnchor = row.anchorRowId;
      rewritten.push({
        ...row,
        anchorRowId: lastInsertedByOriginalAnchor.get(originalAnchor) ?? originalAnchor,
      });
      lastInsertedByOriginalAnchor.set(originalAnchor, row.rowId);
    }
  }
  return rewritten;
}
