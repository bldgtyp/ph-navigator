import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  applyDefaultStatusTemplate,
  createStatusItem,
  deleteStatusItem,
  fetchStatusItems,
  updateStatusItem,
} from "./api";
import { sortStatusItems } from "./lib";
import type { StatusItem, StatusItemListResponse, StatusItemPayload } from "./types";

export const statusQueryKeys = {
  all: ["project-status"] as const,
  list: (projectId: string) => [...statusQueryKeys.all, "list", projectId] as const,
};

export function useStatusItemsQuery(projectId: string) {
  return useQuery({
    queryKey: statusQueryKeys.list(projectId),
    queryFn: ({ signal }) => fetchStatusItems(projectId, signal),
    select: (payload) => sortStatusItems(payload.items),
  });
}

export function useApplyDefaultStatusTemplateMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => applyDefaultStatusTemplate(projectId),
    onSuccess: (payload) => {
      queryClient.setQueryData(statusQueryKeys.list(projectId), payload);
    },
  });
}

export function useCreateStatusItemMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: StatusItemPayload) => createStatusItem(projectId, payload),
    onSuccess: (created) => {
      queryClient.setQueryData<StatusItemListResponse>(statusQueryKeys.list(projectId), (current) =>
        upsertStatusItem(current, created),
      );
    },
  });
}

export function useUpdateStatusItemMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: StatusItemPayload }) =>
      updateStatusItem(projectId, itemId, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData<StatusItemListResponse>(statusQueryKeys.list(projectId), (current) =>
        upsertStatusItem(current, updated),
      );
    },
  });
}

export function useDeleteStatusItemMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => deleteStatusItem(projectId, itemId),
    onSuccess: (_result, itemId) => {
      queryClient.setQueryData<StatusItemListResponse>(statusQueryKeys.list(projectId), (current) =>
        removeStatusItem(current, itemId),
      );
    },
  });
}

function upsertStatusItem(
  current: StatusItemListResponse | undefined,
  item: StatusItem,
): StatusItemListResponse {
  const existingItems = current?.items ?? [];
  return {
    items: sortStatusItems([
      item,
      ...existingItems.filter((candidate) => candidate.id !== item.id),
    ]),
  };
}

function removeStatusItem(
  current: StatusItemListResponse | undefined,
  itemId: string,
): StatusItemListResponse | undefined {
  if (!current) return current;
  const nextItems = current.items.filter((item) => item.id !== itemId);
  if (nextItems.length === current.items.length) return current;
  return { items: nextItems };
}
