import type { ClimateLocationSearch, ClimateRosterSearch, PhClimateKind } from "./types";

// Reference datasets are app-wide (no projectId in the keys).
export const climateQueryKeys = {
  all: ["climate"] as const,
  datasets: () => [...climateQueryKeys.all, "datasets"] as const,
  locations: (datasetId: string, search: ClimateLocationSearch) =>
    [...climateQueryKeys.all, "locations", datasetId, search] as const,
  location: (datasetId: string, locationId: string) =>
    [...climateQueryKeys.all, "location", datasetId, locationId] as const,
  // The project-scoped picker roster (PH stations + proximity for a project).
  datasetRoster: (projectId: string, kind: PhClimateKind, search: ClimateRosterSearch) =>
    [...climateQueryKeys.all, "dataset-roster", projectId, kind, search] as const,
  // Project-scoped climate sources (keyed by projectId, unlike the
  // app-wide reference-dataset keys above).
  sources: (projectId: string) => [...climateQueryKeys.all, "sources", projectId] as const,
};
