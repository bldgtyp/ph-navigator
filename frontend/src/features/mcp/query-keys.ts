export const mcpTokenQueryKeys = {
  all: ["mcp-tokens"] as const,
  list: (projectId: string) => [...mcpTokenQueryKeys.all, projectId] as const,
};
