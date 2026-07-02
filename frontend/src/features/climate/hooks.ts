import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { projectQueryKeys } from "../projects/query-keys";
import {
  attachWeatherFromCatalog,
  attachWeatherFromUpload,
  type WeatherUploadRefs,
  createClimateSource,
  deleteClimateSource,
  deriveClimateSource,
  fetchAttachedClimateRecord,
  fetchClimateDatasetRoster,
  fetchClimateDatasets,
  fetchClimateLocation,
  fetchClimateLocations,
  fetchClimateSources,
  fetchEpwRoster,
} from "./api";
import { climateQueryKeys } from "./query-keys";
import type {
  ClimateLocationSearch,
  ClimateRosterSearch,
  ClimateSourceDeriveKind,
  CreateClimateSourceRequest,
  EpwRosterSearch,
  PhClimateKind,
  ProjectClimateSource,
  ProjectClimateSourceListResponse,
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

export function useAttachedClimateRecordQuery(
  projectId: string | undefined,
  sourceId: string | undefined,
) {
  return useQuery({
    queryKey: climateQueryKeys.sourceRecord(projectId ?? "", sourceId ?? ""),
    queryFn: ({ signal }) =>
      fetchAttachedClimateRecord(projectId as string, sourceId as string, signal),
    enabled: Boolean(projectId) && Boolean(sourceId),
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

// The weather picker roster: OneBuilding EPW stations for a project, nearest-first.
// Keyed by [projectId, search] so changing the state filter refetches.
export function useEpwRosterQuery(
  projectId: string,
  search: EpwRosterSearch,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: climateQueryKeys.epwRoster(projectId, search),
    queryFn: ({ signal }) => fetchEpwRoster(projectId, search, signal),
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
    onSuccess: (source) => {
      queryClient.setQueryData<ProjectClimateSourceListResponse>(
        climateQueryKeys.sources(projectId),
        (current) => upsertClimateSource(current, source),
      );
      return invalidateClimateSourceQueries(queryClient, projectId);
    },
  });
}

function upsertClimateSource(
  current: ProjectClimateSourceListResponse | undefined,
  source: ProjectClimateSource,
): ProjectClimateSourceListResponse {
  if (!current) return { items: [source] };
  const replaced = current.items.some((item) => item.id === source.id);
  if (replaced) {
    return { items: current.items.map((item) => (item.id === source.id ? source : item)) };
  }
  return { items: [...current.items, source] };
}

export function useDeleteClimateSourceMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sourceId: string) => deleteClimateSource(projectId, sourceId),
    onSuccess: () => invalidateClimateSourceQueries(queryClient, projectId),
  });
}

// Attach the map-picked OneBuilding weather station. The server stores the EPW
// and writes the project EPW pointer onto the location, so we refresh both the
// source roster and the location cache (like the derive mutation).
export function useAttachWeatherFromCatalogMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => attachWeatherFromCatalog(projectId, url),
    onSuccess: (source) => {
      queryClient.setQueryData<ProjectClimateSourceListResponse>(
        climateQueryKeys.sources(projectId),
        (current) => upsertClimateSource(current, source),
      );
      void queryClient.invalidateQueries({ queryKey: projectQueryKeys.location(projectId) });
      return invalidateClimateSourceQueries(queryClient, projectId);
    },
  });
}

// Attach a manually-uploaded EPW + STAT + DDY bundle (the files are already
// stored as assets). Refreshes the source roster + the location cache.
export function useAttachWeatherFromUploadMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (refs: WeatherUploadRefs) => attachWeatherFromUpload(projectId, refs),
    onSuccess: (source) => {
      queryClient.setQueryData<ProjectClimateSourceListResponse>(
        climateQueryKeys.sources(projectId),
        (current) => upsertClimateSource(current, source),
      );
      void queryClient.invalidateQueries({ queryKey: projectQueryKeys.location(projectId) });
      return invalidateClimateSourceQueries(queryClient, projectId);
    },
  });
}

// "Set from nearest" for one climate type. The server attaches the source(s)
// off the saved coordinates and returns the (possibly updated) location, so we
// refresh both the location cache and the source roster.
export function useDeriveClimateSourceMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (kind: ClimateSourceDeriveKind) => deriveClimateSource(projectId, kind),
    onSuccess: (response) => {
      queryClient.setQueryData(projectQueryKeys.location(projectId), response.location);
      return invalidateClimateSourceQueries(queryClient, projectId);
    },
  });
}
