import { projectDocumentTableQueryKeys } from "../project_document/query-keys";
import { APERTURES_TABLE_NAME } from "./types";

export const apertureQueryKeys = {
  all: (projectId: string) => projectDocumentTableQueryKeys.table(projectId, APERTURES_TABLE_NAME),
  slice: (projectId: string, versionId: string, accessMode: "editor" | "viewer") =>
    [
      ...projectDocumentTableQueryKeys.table(projectId, APERTURES_TABLE_NAME),
      "slice",
      versionId,
      accessMode,
    ] as const,
};
