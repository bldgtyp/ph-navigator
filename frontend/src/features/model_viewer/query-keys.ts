export const modelViewerQueryKeys = {
  all: ["model-viewer"] as const,
  files: (projectId: string) => [...modelViewerQueryKeys.all, "files", projectId] as const,
};
