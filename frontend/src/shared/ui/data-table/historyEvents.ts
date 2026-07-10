export const CLEAR_DATA_TABLE_HISTORY_EVENT = "phn:data-table-clear-history";

export type DataTableHistoryScope = { projectId: string; versionId: string };

export function clearMountedDataTableHistories(scope: DataTableHistoryScope): void {
  window.dispatchEvent(new CustomEvent(CLEAR_DATA_TABLE_HISTORY_EVENT, { detail: scope }));
}
