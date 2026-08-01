import { fetchJson } from "../../shared/api/client";
import type {
  DeviceAuthorization,
  DeviceAuthorizationDecision,
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

export async function listAgentTokens(signal?: AbortSignal): Promise<McpTokenListResponse> {
  return fetchJson<McpTokenListResponse>("/api/v1/agent-tokens", { signal });
}

export async function revokeAgentToken(tokenId: string): Promise<McpTokenRecord> {
  return fetchJson<McpTokenRecord>(`/api/v1/agent-tokens/${tokenId}/revoke`, {
    method: "POST",
  });
}

export async function getDeviceAuthorization(
  userCode: string,
  signal?: AbortSignal,
): Promise<DeviceAuthorization> {
  return fetchJson<DeviceAuthorization>(`/api/v1/agent-tokens/device/${userCode}`, { signal });
}

export async function decideDeviceAuthorization(
  userCode: string,
  decision: DeviceAuthorizationDecision,
): Promise<DeviceAuthorization> {
  return fetchJson<DeviceAuthorization>(`/api/v1/agent-tokens/device/${userCode}`, {
    method: "POST",
    body: JSON.stringify({ decision }),
  });
}
