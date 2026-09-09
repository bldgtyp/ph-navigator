import type { McpScope } from "./types";

export const CATALOG_READ_SCOPE_LABEL = "Read the shared material library";

export const REQUIRED_MCP_SCOPE: McpScope = "project:read";

export const MCP_SCOPES: McpScope[] = [
  REQUIRED_MCP_SCOPE,
  "project:write",
  "asset:read",
  "asset:write",
];
