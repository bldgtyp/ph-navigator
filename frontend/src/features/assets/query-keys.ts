export const assetQueryKeys = {
  all: (projectId: string) => ["assets", projectId] as const,
  urls: (projectId: string, ids: string[]) => ["assets", projectId, "urls", ids.join(",")] as const,
  job: (projectId: string, jobId: string) => ["assets", projectId, "jobs", jobId] as const,
};
