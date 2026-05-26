export const statusQueryKeys = {
  all: ["project-status"] as const,
  list: (projectId: string) => [...statusQueryKeys.all, "list", projectId] as const,
};
