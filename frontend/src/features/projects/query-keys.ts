export const projectQueryKeys = {
  all: ["projects"] as const,
  list: () => [...projectQueryKeys.all, "list"] as const,
  deleted: () => [...projectQueryKeys.all, "deleted"] as const,
  detail: (projectId: string) => [...projectQueryKeys.all, "detail", projectId] as const,
  btNumber: (value: string) => [...projectQueryKeys.all, "bt-number", value] as const,
};
