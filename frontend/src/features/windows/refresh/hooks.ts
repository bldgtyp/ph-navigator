import { useQuery, useQueryClient } from "@tanstack/react-query";
import { projectDocumentTableQueryKeys } from "../../project_document/hooks";
import { WINDOW_TYPES_TABLE_NAME } from "../types";
import { fetchWindowTypesRefreshReport } from "./api";

export const windowTypesRefreshQueryKeys = {
  all: (projectId: string) => [
    ...projectDocumentTableQueryKeys.table(projectId, WINDOW_TYPES_TABLE_NAME),
    "refresh",
  ],
  report: (projectId: string, versionId: string, source: "draft" | "version") =>
    [...windowTypesRefreshQueryKeys.all(projectId), versionId, source] as const,
};

export function useWindowTypesRefreshReportQuery(
  projectId: string,
  versionId: string | null,
  enabled: boolean,
) {
  const resolvedVersionId = versionId ?? "";
  return useQuery({
    queryKey: windowTypesRefreshQueryKeys.report(projectId, resolvedVersionId, "draft"),
    queryFn: ({ signal }) =>
      fetchWindowTypesRefreshReport(projectId, resolvedVersionId, "draft", signal),
    enabled: enabled && resolvedVersionId.length > 0,
  });
}

export function useInvalidateWindowTypesRefresh(projectId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: windowTypesRefreshQueryKeys.all(projectId) });
}
