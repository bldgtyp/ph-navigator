export const mcpTokenQueryKeys = {
  all: ["mcp-tokens"] as const,
  list: (projectId: string) => [...mcpTokenQueryKeys.all, projectId] as const,
  account: () => [...mcpTokenQueryKeys.all, "account"] as const,
  device: (userCode: string) => [...mcpTokenQueryKeys.all, "device", userCode] as const,
};
