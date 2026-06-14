import type { ClimateLocationSearch } from "./types";

// Reference datasets are app-wide (no projectId in the keys).
export const climateQueryKeys = {
  all: ["climate"] as const,
  datasets: () => [...climateQueryKeys.all, "datasets"] as const,
  locations: (datasetId: string, search: ClimateLocationSearch) =>
    [...climateQueryKeys.all, "locations", datasetId, search] as const,
  location: (datasetId: string, locationId: string) =>
    [...climateQueryKeys.all, "location", datasetId, locationId] as const,
};
