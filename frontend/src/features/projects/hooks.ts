import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { checkBtNumber, createProject, fetchProject, listProjects } from "./api";
import { projectQueryKeys } from "./query-keys";
import type { CreateProjectPayload } from "./types";

export { projectQueryKeys };

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
