export function cellKey(rowId: string, fieldKey: string): string {
  return `${rowId}\u0000${fieldKey}`;
}
