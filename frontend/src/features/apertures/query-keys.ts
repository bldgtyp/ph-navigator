import { projectDocumentTableQueryKeys } from "../project_document/query-keys";
import { APERTURES_TABLE_NAME, type ApertureReadSource } from "./types";

export const apertureQueryKeys = {
  all: (projectId: string) => projectDocumentTableQueryKeys.table(projectId, APERTURES_TABLE_NAME),
  slice: (projectId: string, versionId: string, accessMode: "editor" | "viewer") =>
    [
      ...projectDocumentTableQueryKeys.table(projectId, APERTURES_TABLE_NAME),
      "slice",
      versionId,
      accessMode,
    ] as const,
  specReport: (projectId: string, versionId: string, source: ApertureReadSource) =>
    [...apertureQueryKeys.all(projectId), "spec-report", versionId, source] as const,
};
