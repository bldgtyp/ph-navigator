import type { McpScope } from "./types";

export const REQUIRED_MCP_SCOPE: McpScope = "project:read";

export const MCP_SCOPES: McpScope[] = [
  REQUIRED_MCP_SCOPE,
  "project:write",
  "asset:read",
  "asset:write",
];
