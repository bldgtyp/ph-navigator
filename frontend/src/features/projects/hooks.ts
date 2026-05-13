import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  checkBtNumber,
  createProject,
  discardDraft,
  fetchDiff,
  fetchProject,
  listProjects,
  patchVersion,
  saveDraft,
  saveDraftAs,
} from "./api";
import { projectQueryKeys } from "./query-keys";
import { roomsQueryKeys } from "../equipment/hooks";
import type { CreateProjectPayload, SaveAsPayload } from "./types";

export { projectQueryKeys };

function invalidateProjectVersionQueries(
  queryClient: QueryClient,
  projectId: string,
  { detail = true, rooms = true }: { detail?: boolean; rooms?: boolean } = {},
) {
  if (detail) {
    queryClient.invalidateQueries({ queryKey: projectQueryKeys.detail(projectId) });
  }
  queryClient.invalidateQueries({ queryKey: projectQueryKeys.list() });
  if (rooms) {
    queryClient.invalidateQueries({ queryKey: roomsQueryKeys.project(projectId) });
  }
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

export function useSaveDraftMutation(projectId: string, versionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ versionEtag }: { versionEtag: string }) =>
      saveDraft(projectId, versionId ?? "", versionEtag),
    onSuccess: () => {
      invalidateProjectVersionQueries(queryClient, projectId);
    },
  });
}

export function useSaveDraftAsMutation(projectId: string, versionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveAsPayload) => saveDraftAs(projectId, versionId ?? "", payload),
    onSuccess: () => {
      invalidateProjectVersionQueries(queryClient, projectId);
    },
  });
}

export function useDiscardDraftMutation(projectId: string, versionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => discardDraft(projectId, versionId ?? ""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roomsQueryKeys.project(projectId) });
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
      invalidateProjectVersionQueries(queryClient, projectId, { detail: false, rooms: false });
    },
  });
}

export function useDiffQuery(
  projectId: string,
  versionId: string | null,
  to: string,
  enabled: boolean,
) {
  const resolvedVersionId = versionId ?? "";
  return useQuery({
    queryKey: [...projectQueryKeys.detail(projectId), "diff", resolvedVersionId, to],
    queryFn: ({ signal }) => fetchDiff(projectId, resolvedVersionId, to, signal),
    enabled: enabled && resolvedVersionId.length > 0,
  });
}
