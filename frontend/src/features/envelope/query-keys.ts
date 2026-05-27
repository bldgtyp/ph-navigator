import type { EnvelopeReadSource } from "./types";

export const envelopeQueryKeys = {
  all: (projectId: string) => ["projects", projectId, "envelope"] as const,
  read: (projectId: string, versionId: string, source: EnvelopeReadSource) =>
    [...envelopeQueryKeys.all(projectId), "read", versionId, source] as const,
  thermal: (projectId: string, versionId: string, assemblyId: string, source: EnvelopeReadSource) =>
    [...envelopeQueryKeys.all(projectId), "thermal", versionId, assemblyId, source] as const,
  materialDrift: (projectId: string, versionId: string, source: EnvelopeReadSource) =>
    [...envelopeQueryKeys.all(projectId), "material-drift", versionId, source] as const,
};
