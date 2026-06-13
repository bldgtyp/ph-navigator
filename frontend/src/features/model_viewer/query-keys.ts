export const modelViewerQueryKeys = {
  all: ["model-viewer"] as const,
  files: (projectId: string) => [...modelViewerQueryKeys.all, "files", projectId] as const,
  modelData: (projectId: string, fileId: string) =>
    [...modelViewerQueryKeys.all, "model-data", projectId, fileId] as const,
};
