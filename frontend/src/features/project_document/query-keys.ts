export const projectDocumentQueryKeys = {
  all: ["project-document"] as const,
  project: (projectId: string) => [...projectDocumentQueryKeys.all, "project", projectId] as const,
  draftSummary: (projectId: string, versionId: string) =>
    [...projectDocumentQueryKeys.project(projectId), "draft-summary", versionId] as const,
  document: (projectId: string, versionId: string) =>
    [...projectDocumentQueryKeys.project(projectId), "document", versionId] as const,
  diff: (projectId: string, versionId: string, to: string) =>
    [...projectDocumentQueryKeys.project(projectId), "diff", versionId, to] as const,
};

export const projectDocumentTableQueryKeys = {
  all: ["project-document-tables"] as const,
  project: (projectId: string) =>
    [...projectDocumentTableQueryKeys.all, "project", projectId] as const,
  table: (projectId: string, tableName: string) =>
    [...projectDocumentTableQueryKeys.project(projectId), "table", tableName] as const,
};
