export const envelopeQueryKeys = {
  all: (projectId: string) => ["projects", projectId, "envelope"] as const,
  read: (projectId: string, versionId: string, source: "draft" | "version") =>
    [...envelopeQueryKeys.all(projectId), "read", versionId, source] as const,
};
