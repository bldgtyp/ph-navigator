import { fetchJson } from "../../shared/api/client";
import type {
  McpTokenIssuePayload,
  McpTokenIssueResponse,
  McpTokenListResponse,
  McpTokenRecord,
} from "./types";

export async function listMcpTokens(
  projectId: string,
  signal?: AbortSignal,
): Promise<McpTokenListResponse> {
  return fetchJson<McpTokenListResponse>(`/api/v1/projects/${projectId}/mcp-tokens`, { signal });
}

export async function issueMcpToken(
  projectId: string,
  payload: McpTokenIssuePayload,
): Promise<McpTokenIssueResponse> {
  return fetchJson<McpTokenIssueResponse>(`/api/v1/projects/${projectId}/mcp-tokens`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function revokeMcpToken(projectId: string, tokenId: string): Promise<McpTokenRecord> {
  return fetchJson<McpTokenRecord>(`/api/v1/projects/${projectId}/mcp-tokens/${tokenId}/revoke`, {
    method: "POST",
  });
}
