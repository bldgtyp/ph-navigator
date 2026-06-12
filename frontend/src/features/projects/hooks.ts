import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  bulkDeleteProjects,
  checkBtNumber,
  createProject,
  fetchProjectLocation,
  fetchProject,
  listDeletedProjects,
  listProjects,
  parseProjectLocationEpw,
  patchVersion,
  restoreProject,
  updateProjectLocation,
  updateProject,
} from "./api";
import { projectQueryKeys } from "./query-keys";
import type {
  CreateProjectPayload,
  ProjectListResponse,
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
    select: (payload) => payload.projects,
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
      queryClient.setQueryData(
        projectQueryKeys.list(),
        (current: Awaited<ReturnType<typeof listProjects>> | undefined) => ({
          projects: [
            project,
            ...(current?.projects.filter((item) => item.id !== project.id) ?? []),
          ],
        }),
      );
      queryClient.setQueryData(projectQueryKeys.detail(project.id), project);
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
      queryClient.setQueryData(
        projectQueryKeys.list(),
        (current: ProjectListResponse | undefined): ProjectListResponse | undefined => {
          if (!current) return current;
          return {
            projects: current.projects.map((item) => (item.id === project.id ? project : item)),
          };
        },
      );
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
    },
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
      locked,
      makeActive,
    }: {
      versionId: string;
      locked?: boolean;
      makeActive?: boolean;
    }) => patchVersion(projectId, versionId, { locked, make_active: makeActive }),
    onSuccess: (project) => {
      queryClient.setQueryData(projectQueryKeys.detail(project.id), project);
      invalidateProjectVersionQueries(queryClient, projectId, { detail: false });
    },
  });
}
