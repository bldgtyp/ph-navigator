import { useQuery } from "@tanstack/react-query";
import { fetchClimateDatasets, fetchClimateLocation, fetchClimateLocations } from "./api";
import { climateQueryKeys } from "./query-keys";
import type { ClimateLocationSearch } from "./types";

export { climateQueryKeys };

export function useClimateDatasetsQuery() {
  return useQuery({
    queryKey: climateQueryKeys.datasets(),
    queryFn: ({ signal }) => fetchClimateDatasets(signal),
    select: (payload) => payload.items,
  });
}

export function useClimateLocationsQuery(
  datasetId: string | undefined,
  search: ClimateLocationSearch,
) {
  return useQuery({
    queryKey: climateQueryKeys.locations(datasetId ?? "", search),
    queryFn: ({ signal }) => fetchClimateLocations(datasetId as string, search, signal),
    enabled: Boolean(datasetId),
  });
}

export function useClimateLocationQuery(
  datasetId: string | undefined,
  locationId: string | undefined,
) {
  return useQuery({
    queryKey: climateQueryKeys.location(datasetId ?? "", locationId ?? ""),
    queryFn: ({ signal }) =>
      fetchClimateLocation(datasetId as string, locationId as string, signal),
    enabled: Boolean(datasetId) && Boolean(locationId),
  });
}
