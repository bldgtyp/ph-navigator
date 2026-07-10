import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "../../shared/api/client";
import { projectDocumentQueryKeys } from "../project_document/query-keys";

export type StatusSummaryState = "needed" | "question" | "complete" | "na" | "unknown";

export type StatusSummaryCounts = Record<StatusSummaryState, number>;

export type StatusSummaryRecord = {
  id: string;
  display_name: string;
  status: StatusSummaryState;
  notes: string | null;
};

export type StatusSummaryDestination = {
  kind: "equipment_tab" | "heat_pump_leaf" | "thermal_bridges";
  key: string | null;
};

export type StatusSummaryLeaf = {
  table_name: string;
  label: string;
  destination: StatusSummaryDestination;
  counts: StatusSummaryCounts;
  records: StatusSummaryRecord[];
};

export type StatusSummaryGroup = {
  key: string;
  label: string;
  counts: StatusSummaryCounts;
  leaves: StatusSummaryLeaf[];
};

export type ProjectStatusSummary = {
  project_id: string;
  version_id: string;
  source: "version" | "draft";
  version_etag: string;
  draft_etag: string | null;
  counts: StatusSummaryCounts;
  groups: StatusSummaryGroup[];
};

export function useProjectStatusSummaryQuery(
  projectId: string,
  versionId: string | null,
  accessMode: "editor" | "viewer",
) {
  const resolvedVersionId = versionId ?? "";
  return useQuery({
    queryKey: projectDocumentQueryKeys.statusSummary(projectId, resolvedVersionId, accessMode),
    queryFn: ({ signal }) =>
      fetchProjectStatusSummary(projectId, resolvedVersionId, accessMode, signal),
    enabled: resolvedVersionId.length > 0,
    staleTime: Infinity,
  });
}

export function statusSummaryDestinationPath(
  projectId: string,
  destination: StatusSummaryDestination,
  rowId?: string,
): string {
  const focus = rowId ? `?focus=${encodeURIComponent(rowId)}` : "";
  if (destination.kind === "heat_pump_leaf") {
    return `/projects/${projectId}/equipment/heat-pumps/${destination.key ?? "equipment-outdoor"}${focus}`;
  }
  if (destination.kind === "thermal_bridges") {
    return `/projects/${projectId}/thermal-bridges${focus}`;
  }
  const tab = encodeURIComponent(destination.key ?? "ventilators");
  const separator = rowId ? "&" : "";
  return `/projects/${projectId}/equipment?tab=${tab}${separator}${focus.slice(1)}`;
}

async function fetchProjectStatusSummary(
  projectId: string,
  versionId: string,
  accessMode: "editor" | "viewer",
  signal?: AbortSignal,
): Promise<ProjectStatusSummary> {
  const source = accessMode === "editor" ? "draft" : "document";
  return fetchJson<ProjectStatusSummary>(
    `/api/v1/projects/${projectId}/versions/${versionId}/${source}/status-summary`,
    { signal },
  );
}
