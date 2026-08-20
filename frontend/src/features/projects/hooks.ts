import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { climateQueryKeys } from "../climate/query-keys";
import { projectDocumentQueryKeys } from "../project_document/query-keys";
import {
  bulkDeleteProjects,
  checkBtNumber,
  createProject,
  deleteVersion,
  fetchProjectLocation,
  fetchProject,
  geocodeProjectLocation,
  listDeletedProjects,
  listProjects,
  lookupProjectElevation,
  parseProjectLocationEpw,
  patchVersion,
  restoreProject,
  updateProjectLocation,
  updateProject,
} from "./api";
import { projectQueryKeys } from "./query-keys";
import type {
  CreateProjectPayload,
  ElevationLookupPayload,
  UpdateProjectLocationPayload,
  UpdateProjectPayload,
} from "./types";

export { projectQueryKeys };

function invalidateProjectVersionQueries(
  queryClient: QueryClient,
  projectId: string,
  { detail = true }: { detail?: boolean } = {},
) {
  if (detail) {
    queryClient.invalidateQueries({ queryKey: projectQueryKeys.detail(projectId) });
  }
  queryClient.invalidateQueries({ queryKey: projectQueryKeys.list() });
}

export function useProjectsQuery() {
  return useQuery({
    queryKey: projectQueryKeys.list(),
    queryFn: ({ signal }) => listProjects(signal),
  });
}

export function useDeletedProjectsQuery() {
  return useQuery({
    queryKey: projectQueryKeys.deleted(),
    queryFn: ({ signal }) => listDeletedProjects(signal),
    select: (payload) => payload.projects,
  });
}

export function useProjectQuery(projectId: string | undefined) {
  const resolvedProjectId = projectId ?? "";
  return useQuery({
    queryKey: projectQueryKeys.detail(resolvedProjectId),
    queryFn: ({ signal }) => fetchProject(resolvedProjectId, signal),
    enabled: resolvedProjectId.length > 0,
  });
}

export function useProjectLocationQuery(projectId: string | undefined) {
  const resolvedProjectId = projectId ?? "";
  return useQuery({
    queryKey: projectQueryKeys.location(resolvedProjectId),
    queryFn: ({ signal }) => fetchProjectLocation(resolvedProjectId, signal),
    enabled: resolvedProjectId.length > 0,
  });
}

export function useBtNumberAvailabilityQuery(value: string, enabled: boolean) {
  return useQuery({
    queryKey: projectQueryKeys.btNumber(value),
    queryFn: ({ signal }) => checkBtNumber(value, signal),
    enabled,
  });
}

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProjectPayload) => createProject(payload),
    onSuccess: (project) => {
      queryClient.setQueryData(projectQueryKeys.detail(project.id), project);
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.list() });
    },
  });
}

export function useBulkDeleteProjectsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectIds: string[]) => bulkDeleteProjects(projectIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.list() });
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.deleted() });
    },
  });
}

export function useRestoreProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => restoreProject(projectId),
    onSuccess: (project) => {
      queryClient.setQueryData(projectQueryKeys.detail(project.id), project);
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.list() });
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.deleted() });
    },
  });
}

export function useUpdateProjectMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProjectPayload) => updateProject(projectId, payload),
    onSuccess: (project) => {
      queryClient.setQueryData(projectQueryKeys.detail(project.id), project);
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.list() });
    },
  });
}

export function useUpdateProjectLocationMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProjectLocationPayload) =>
      updateProjectLocation(projectId, payload),
    onSuccess: (response) => {
      queryClient.setQueryData(projectQueryKeys.location(projectId), response.location);
      queryClient.invalidateQueries({ queryKey: climateQueryKeys.sources(projectId) });
    },
  });
}

export function useGeocodeProjectLocationMutation(projectId: string) {
  return useMutation({
    mutationFn: (query: string) => geocodeProjectLocation(projectId, query),
  });
}

// Stateless elevation lookup for the Set Location modal's auto-fill: returns a
// suggestion, so it writes nothing to the query cache.
export function useLookupElevationMutation(projectId: string) {
  return useMutation({
    mutationFn: (payload: ElevationLookupPayload) => lookupProjectElevation(projectId, payload),
  });
}

export function useParseProjectLocationEpwMutation(projectId: string) {
  return useMutation({
    mutationFn: (assetId: string) => parseProjectLocationEpw(projectId, assetId),
  });
}

export function usePatchVersionMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      versionId,
      name,
      locked,
      makeActive,
    }: {
      versionId: string;
      name?: string;
      locked?: boolean;
      makeActive?: boolean;
    }) => patchVersion(projectId, versionId, { name, locked, make_active: makeActive }),
    onSuccess: async (project, variables) => {
      queryClient.setQueryData(projectQueryKeys.detail(project.id), project);
      invalidateProjectVersionQueries(queryClient, projectId, { detail: false });
      if (variables.locked !== undefined) {
        await queryClient.invalidateQueries({
          queryKey: projectDocumentQueryKeys.draftSummary(projectId, variables.versionId),
        });
      }
    },
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: projectQueryKeys.detail(projectId) });
    },
  });
}

export function useDeleteVersionMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ versionId, confirmName }: { versionId: string; confirmName: string }) =>
      deleteVersion(projectId, versionId, confirmName),
    onSuccess: (project, variables) => {
      queryClient.setQueryData(projectQueryKeys.detail(project.id), project);
      invalidateProjectVersionQueries(queryClient, projectId, { detail: false });
      queryClient.removeQueries({
        predicate: ({ queryKey }) =>
          (queryKey[0] === "project-document" || queryKey[0] === "project-document-tables") &&
          queryKey.includes(projectId) &&
          queryKey.includes(variables.versionId),
      });
    },
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: projectQueryKeys.detail(projectId) });
    },
  });
}
