export function insertAfterColumnOrder(
  columnOrder: ReadonlyArray<string>,
  anchorFieldKey: string,
  insertedFieldKey: string,
): string[] | null {
  if (columnOrder.length === 0) return null;
  const filtered = columnOrder.filter((id) => id !== insertedFieldKey);
  const anchorIndex = filtered.indexOf(anchorFieldKey);
  if (anchorIndex < 0) return null;
  return [
    ...filtered.slice(0, anchorIndex + 1),
    insertedFieldKey,
    ...filtered.slice(anchorIndex + 1),
  ];
}
