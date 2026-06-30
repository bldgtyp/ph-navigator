import { fetchJson } from "../../shared/api/client";
import {
  TABLE_VIEW_SCHEMA_VERSION,
  type BatchTableViewsResponse,
  type TableViewResponse,
  type TableViewUpsertRequest,
  type ViewStateEnvelope,
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

// Batch counterpart to `fetchTableView`: one request for a page's whole set of
// table keys. Returns the `table_key -> TableViewResponse` map (one entry per
// requested key, defaults for keys with no saved row).
export async function fetchTableViews(
  projectId: string,
  keys: string[],
  signal?: AbortSignal,
): Promise<Record<string, TableViewResponse>> {
  const params = new URLSearchParams();
  for (const key of keys) params.append("keys", key);
  const response = await fetchJson<BatchTableViewsResponse>(
    `/api/v1/projects/${projectId}/table-views?${params.toString()}`,
    { signal },
  );
  return response.views;
}

export async function saveTableView(
  projectId: string,
  tableKey: string,
  envelope: ViewStateEnvelope,
  signal?: AbortSignal,
): Promise<TableViewResponse> {
  const body: TableViewUpsertRequest = {
    view_state_schema_version: TABLE_VIEW_SCHEMA_VERSION,
    view_state: envelope,
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
