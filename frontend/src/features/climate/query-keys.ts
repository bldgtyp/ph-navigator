import type { ClimateLocationSearch } from "./types";

// Reference datasets are app-wide (no projectId in the keys).
export const climateQueryKeys = {
  all: ["climate"] as const,
  datasets: () => [...climateQueryKeys.all, "datasets"] as const,
  locations: (datasetId: string, search: ClimateLocationSearch) =>
    [...climateQueryKeys.all, "locations", datasetId, search] as const,
  location: (datasetId: string, locationId: string) =>
    [...climateQueryKeys.all, "location", datasetId, locationId] as const,
  // Project-scoped climate sources (keyed by projectId, unlike the
  // app-wide reference-dataset keys above).
  sources: (projectId: string) => [...climateQueryKeys.all, "sources", projectId] as const,
  // Project sun-path diagram (Phase 1 endpoint; rendered in Phase 3c).
  sunPath: (projectId: string) => [...climateQueryKeys.all, "sun-path", projectId] as const,
};
