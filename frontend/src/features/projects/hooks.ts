import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { checkBtNumber, createProject, fetchProject, listProjects, patchVersion } from "./api";
import { projectQueryKeys } from "./query-keys";
import type { CreateProjectPayload } from "./types";

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

export function useProjectQuery(projectId: string | undefined) {
  const resolvedProjectId = projectId ?? "";
  return useQuery({
    queryKey: projectQueryKeys.detail(resolvedProjectId),
    queryFn: ({ signal }) => fetchProject(resolvedProjectId, signal),
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
