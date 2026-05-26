import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { issueMcpToken, listMcpTokens, revokeMcpToken } from "./api";
import { mcpTokenQueryKeys } from "./query-keys";
import type { McpTokenIssuePayload, McpTokenListResponse } from "./types";

export { mcpTokenQueryKeys };

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
      const queryKey = mcpTokenQueryKeys.list(projectId);
      const current = queryClient.getQueryData<McpTokenListResponse>(queryKey);
      if (!current) {
        queryClient.invalidateQueries({ queryKey });
        return;
      }
      queryClient.setQueryData(queryKey, {
        tokens: current.tokens.map((token) => (token.id === revoked.id ? revoked : token)),
      });
    },
  });
}
