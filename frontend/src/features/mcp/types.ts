export type McpScope = "project:read" | "project:write" | "asset:read" | "asset:write";

export type McpTokenRecord = {
  id: string;
  project_id: string;
  label: string;
  token_prefix: string;
  scopes: McpScope[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

export type McpTokenListResponse = {
  tokens: McpTokenRecord[];
};

export type McpTokenIssuePayload = {
  label: string;
  scopes: McpScope[];
  expires_at: string | null;
};

export type McpTokenIssueResponse = {
  token: string;
  token_record: McpTokenRecord;
};
