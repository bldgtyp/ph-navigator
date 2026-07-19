import { projectDocumentQueryKeys } from "../project_document/query-keys";

export const documentationQueryKeys = {
  summaries: (projectId: string) => projectDocumentQueryKeys.documentationSummaries(projectId),
  summary: (projectId: string, versionId: string, accessMode: "editor" | "viewer") =>
    projectDocumentQueryKeys.documentationSummary(projectId, versionId, accessMode),
};
