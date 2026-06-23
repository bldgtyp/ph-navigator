export const modelViewerQueryKeys = {
  all: ["model-viewer"] as const,
  files: (projectId: string) => [...modelViewerQueryKeys.all, "files", projectId] as const,
  modelData: (projectId: string, fileId: string) =>
    [...modelViewerQueryKeys.all, "model-data", projectId, fileId] as const,
  // Project-scoped (not file-scoped): the sun path depends on project location,
  // not on which HBJSON is active.
  sunPath: (projectId: string) => [...modelViewerQueryKeys.all, "sun-path", projectId] as const,
};
