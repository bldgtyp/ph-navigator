import { fetchJson } from "../../../shared/api/client";
import type { WindowTypesRefreshReport } from "./types";

export async function fetchWindowTypesRefreshReport(
  projectId: string,
  versionId: string,
  source: "draft" | "version" = "draft",
  signal?: AbortSignal,
): Promise<WindowTypesRefreshReport> {
  return fetchJson<WindowTypesRefreshReport>(
    `/api/v1/projects/${projectId}/versions/${versionId}/refresh/window-types?source=${source}`,
    { signal },
  );
}
