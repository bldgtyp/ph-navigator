import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  createClimateSource,
  deleteClimateSource,
  fetchClimateDatasetRoster,
  fetchClimateDatasets,
  fetchClimateLocation,
  fetchClimateLocations,
  fetchClimateSources,
} from "./api";
import { climateQueryKeys } from "./query-keys";
import type {
  ClimateLocationSearch,
  ClimateRosterSearch,
  CreateClimateSourceRequest,
  PhClimateKind,
} from "./types";

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

// The picker roster: a PH dataset's stations for a project, proximity-ranked.
// Keyed by [projectId, kind, search] so changing the state filter refetches.
export function useClimateDatasetRosterQuery(
  projectId: string,
  kind: PhClimateKind,
  search: ClimateRosterSearch,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: climateQueryKeys.datasetRoster(projectId, kind, search),
    queryFn: ({ signal }) => fetchClimateDatasetRoster(projectId, kind, search, signal),
    enabled: options.enabled ?? true,
  });
}

// ---- Project-scoped climate sources (Phase 3b) ----

function invalidateClimateSourceQueries(queryClient: QueryClient, projectId: string) {
  return queryClient.invalidateQueries({ queryKey: climateQueryKeys.sources(projectId) });
}

export function useClimateSourcesQuery(projectId: string) {
  return useQuery({
    queryKey: climateQueryKeys.sources(projectId),
    queryFn: ({ signal }) => fetchClimateSources(projectId, signal),
    select: (payload) => payload.items,
  });
}

export function useCreateClimateSourceMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateClimateSourceRequest) => createClimateSource(projectId, body),
    onSuccess: () => invalidateClimateSourceQueries(queryClient, projectId),
  });
}

export function useDeleteClimateSourceMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sourceId: string) => deleteClimateSource(projectId, sourceId),
    onSuccess: () => invalidateClimateSourceQueries(queryClient, projectId),
  });
}
