import { formatProjectDateTime } from "../../../shared/lib/dates";
import type { McpTokenRecord } from "../types";

export function McpTokenList({
  tokens,
  emptyMessage,
  revokingTokenId,
  onRevoke,
}: {
  tokens: McpTokenRecord[];
  emptyMessage: string;
  revokingTokenId?: string;
  onRevoke?: (tokenId: string) => void;
}) {
  const now = Date.now();
  const activeTokens = tokens.filter((token) => !isInactive(token, now));
  const inactiveTokens = tokens.filter((token) => isInactive(token, now));

  return (
    <>
      <div className="token-list" aria-label="Active MCP tokens">
        {activeTokens.length === 0 ? <p className="form-note">{emptyMessage}</p> : null}
        {activeTokens.map((token) => (
          <McpTokenRow
            key={token.id}
            token={token}
            onRevoke={onRevoke ? () => onRevoke(token.id) : undefined}
            isRevoking={revokingTokenId === token.id}
          />
        ))}
      </div>
      {inactiveTokens.length > 0 ? (
        <details className="revoked-token-details">
          <summary>
            {inactiveTokens.length} inactive token{inactiveTokens.length === 1 ? "" : "s"}
          </summary>
          <div className="token-list">
            {inactiveTokens.map((token) => (
              <McpTokenRow key={token.id} token={token} />
            ))}
          </div>
        </details>
      ) : null}
    </>
  );
}

function McpTokenRow({
  token,
  isRevoking = false,
  onRevoke,
}: {
  token: McpTokenRecord;
  isRevoking?: boolean;
  onRevoke?: () => void;
}) {
  const expired = token.expires_at !== null && Date.parse(token.expires_at) <= Date.now();
  const inactive = token.revoked_at !== null || expired;
  return (
    <div className="token-row">
      <div>
        <strong>{token.label}</strong>
        <span>
          {token.token_prefix} · {token.scopes.join(", ")}
        </span>
        <span>
          Created {formatProjectDateTime(token.created_at)} · Last used{" "}
          {token.last_used_at ? formatProjectDateTime(token.last_used_at) : "never"}
          {token.expires_at ? ` · Expires ${formatProjectDateTime(token.expires_at)}` : ""}
          {token.revoked_at ? ` · Revoked ${formatProjectDateTime(token.revoked_at)}` : ""}
          {expired && token.revoked_at === null ? " · Expired" : ""}
        </span>
      </div>
      {!inactive && onRevoke ? (
        <button type="button" className="danger-button" disabled={isRevoking} onClick={onRevoke}>
          {isRevoking ? "Revoking..." : "Revoke"}
        </button>
      ) : null}
    </div>
  );
}

function isInactive(token: McpTokenRecord, now: number): boolean {
  return (
    token.revoked_at !== null || (token.expires_at !== null && Date.parse(token.expires_at) <= now)
  );
}
