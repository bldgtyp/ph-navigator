// Sidebar view persistence uses direct fetch calls rather than TanStack Query
// (the hook owns its own loading/save state), mirroring `table_views`. This
// namespace is reserved for a future migration to TanStack Query and kept for
// shape consistency with other feature packages.
export const sidebarViewQueryKeys = {
  all: ["sidebar-views"] as const,
  scope: (projectId: string, viewKey: string) =>
    [...sidebarViewQueryKeys.all, projectId, viewKey] as const,
};
