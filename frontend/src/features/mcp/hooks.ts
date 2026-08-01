import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import {
  decideDeviceAuthorization,
  getDeviceAuthorization,
  issueMcpToken,
  listAgentTokens,
  listMcpTokens,
  revokeAgentToken,
  revokeMcpToken,
} from "./api";
import { mcpTokenQueryKeys } from "./query-keys";
import type {
  DeviceAuthorizationDecision,
  McpTokenIssuePayload,
  McpTokenListResponse,
  McpTokenRecord,
} from "./types";

export { mcpTokenQueryKeys };

function replaceCachedToken(
  queryClient: QueryClient,
  queryKey: QueryKey,
  replacement: McpTokenRecord,
) {
  const current = queryClient.getQueryData<McpTokenListResponse>(queryKey);
  if (!current) {
    queryClient.invalidateQueries({ queryKey });
    return;
  }
  queryClient.setQueryData(queryKey, {
    tokens: current.tokens.map((token) => (token.id === replacement.id ? replacement : token)),
  });
}

export function useMcpTokensQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: mcpTokenQueryKeys.list(projectId),
    queryFn: ({ signal }) => listMcpTokens(projectId, signal),
    enabled: enabled && projectId.length > 0,
    select: (payload) => payload.tokens,
  });
}

export function useIssueMcpTokenMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: McpTokenIssuePayload) => issueMcpToken(projectId, payload),
    onSuccess: (issued) => {
      const queryKey = mcpTokenQueryKeys.list(projectId);
      const current = queryClient.getQueryData<McpTokenListResponse>(queryKey);
      if (!current) {
        queryClient.invalidateQueries({ queryKey });
        return;
      }
      queryClient.setQueryData(queryKey, {
        tokens: [
          issued.token_record,
          ...current.tokens.filter((token) => token.id !== issued.token_record.id),
        ],
      });
    },
  });
}

export function useRevokeMcpTokenMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tokenId: string) => revokeMcpToken(projectId, tokenId),
    onSuccess: (revoked) => {
      replaceCachedToken(queryClient, mcpTokenQueryKeys.list(projectId), revoked);
    },
  });
}

export function useAgentTokensQuery() {
  return useQuery({
    queryKey: mcpTokenQueryKeys.account(),
    queryFn: ({ signal }) => listAgentTokens(signal),
    select: (payload) => payload.tokens,
  });
}

export function useRevokeAgentTokenMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeAgentToken,
    onSuccess: (revoked) => {
      replaceCachedToken(queryClient, mcpTokenQueryKeys.account(), revoked);
    },
  });
}

export function useDeviceAuthorizationQuery(userCode: string) {
  return useQuery({
    queryKey: mcpTokenQueryKeys.device(userCode),
    queryFn: ({ signal }) => getDeviceAuthorization(userCode, signal),
    enabled: userCode.length > 0,
  });
}

export function useDecideDeviceAuthorizationMutation(userCode: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (decision: DeviceAuthorizationDecision) =>
      decideDeviceAuthorization(userCode, decision),
    onSuccess: (authorization) => {
      queryClient.setQueryData(mcpTokenQueryKeys.device(userCode), authorization);
    },
  });
}
