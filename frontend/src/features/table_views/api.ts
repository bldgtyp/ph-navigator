import { fetchJson } from "../../shared/api/client";
import type { ViewState } from "../../shared/ui/data-table";
import {
  TABLE_VIEW_SCHEMA_VERSION,
  type TableViewResponse,
  type TableViewUpsertRequest,
} from "./types";

function endpoint(projectId: string, tableKey: string): string {
  return `/api/v1/projects/${projectId}/table-views/${tableKey}`;
}

export async function fetchTableView(
  projectId: string,
  tableKey: string,
  signal?: AbortSignal,
): Promise<TableViewResponse> {
  return fetchJson<TableViewResponse>(endpoint(projectId, tableKey), { signal });
}

export async function saveTableView(
  projectId: string,
  tableKey: string,
  viewState: ViewState,
  signal?: AbortSignal,
): Promise<TableViewResponse> {
  const body: TableViewUpsertRequest = {
    view_state_schema_version: TABLE_VIEW_SCHEMA_VERSION,
    view_state: viewState,
  };
  return fetchJson<TableViewResponse>(endpoint(projectId, tableKey), {
    method: "PUT",
    body: JSON.stringify(body),
    signal,
  });
}

export async function deleteTableView(
  projectId: string,
  tableKey: string,
  signal?: AbortSignal,
): Promise<void> {
  await fetchJson<void>(endpoint(projectId, tableKey), {
    method: "DELETE",
    signal,
  });
}
