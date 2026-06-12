import { memo, useState } from "react";
import { formatProjectDateTime } from "../../../shared/lib/dates";
import { errorMessage } from "../../../shared/lib/errors";
import { MCP_SCOPES, REQUIRED_MCP_SCOPE } from "../../mcp/constants";
import { useIssueMcpTokenMutation, useRevokeMcpTokenMutation } from "../../mcp/hooks";
import type { McpScope, McpTokenRecord } from "../../mcp/types";

const EMPTY_MCP_TOKENS: McpTokenRecord[] = [];

export const ProjectMcpTokensSection = memo(function ProjectMcpTokensSection({
  tokens,
  isLoading,
  error,
  projectId,
}: {
  tokens: McpTokenRecord[] | undefined;
  isLoading: boolean;
  error: Error | null;
  projectId: string;
}) {
  const [label, setLabel] = useState("");
  const [scopes, setScopes] = useState<McpScope[]>(MCP_SCOPES);
  const [expiresAt, setExpiresAt] = useState("");
  const [plaintextToken, setPlaintextToken] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const issueMutation = useIssueMcpTokenMutation(projectId);
  const revokeMutation = useRevokeMcpTokenMutation(projectId);
  const resolvedTokens = tokens ?? EMPTY_MCP_TOKENS;
  const activeTokens = resolvedTokens.filter((token) => token.revoked_at === null);
  const revokedTokens = resolvedTokens.filter((token) => token.revoked_at !== null);
  const canIssue =
    label.trim().length > 0 && scopes.includes(REQUIRED_MCP_SCOPE) && !issueMutation.isPending;

  const toggleScope = (scope: McpScope) => {
    setScopes((current) => {
      if (scope === REQUIRED_MCP_SCOPE) return current;
      return current.includes(scope)
        ? current.filter((value) => value !== scope)
        : [...current, scope];
    });
  };

  const handleIssue = () => {
    if (!canIssue) return;
    issueMutation.mutate(
      {
        label: label.trim(),
        scopes,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      },
      {
        onSuccess: (issued) => {
          setPlaintextToken(issued.token);
          setCopyStatus(null);
          setLabel("");
          setScopes(MCP_SCOPES);
          setExpiresAt("");
        },
      },
    );
  };

  const copyPlaintextToken = async () => {
    if (!plaintextToken) return;
    if (!navigator.clipboard?.writeText) {
      setCopyStatus("Clipboard unavailable. Select and copy manually.");
      return;
    }
    try {
      await navigator.clipboard.writeText(plaintextToken);
      setCopyStatus("Copied.");
    } catch {
      setCopyStatus("Clipboard unavailable. Select and copy manually.");
    }
  };

  return (
    <section className="settings-section" aria-labelledby="settings-mcp-title">
      <div className="settings-section-heading">
        <h3 id="settings-mcp-title">MCP tokens</h3>
        <span>Project scoped</span>
      </div>
      {isLoading ? <p className="form-note">Loading MCP tokens...</p> : null}
      {error ? (
        <p className="form-error">{errorMessage(error, "Could not load MCP tokens.")}</p>
      ) : null}
      {plaintextToken ? (
        <div className="one-time-token" role="status">
          <p>This token is shown once. Store it before closing settings.</p>
          <div className="one-time-token-copy">
            <code>{plaintextToken}</code>
            <button type="button" className="secondary-button" onClick={copyPlaintextToken}>
              Copy
            </button>
          </div>
          {copyStatus ? <p>{copyStatus}</p> : null}
        </div>
      ) : null}
      <div className="token-list" aria-label="Active MCP tokens">
        {activeTokens.length === 0 ? <p className="form-note">No active MCP tokens.</p> : null}
        {activeTokens.map((token) => (
          <TokenRow
            key={token.id}
            token={token}
            onRevoke={() => revokeMutation.mutate(token.id)}
            isRevoking={revokeMutation.isPending && revokeMutation.variables === token.id}
          />
        ))}
      </div>
      {revokedTokens.length > 0 ? (
        <details className="revoked-token-details">
          <summary>
            {revokedTokens.length} revoked token{revokedTokens.length === 1 ? "" : "s"}
          </summary>
          <div className="token-list">
            {revokedTokens.map((token) => (
              <TokenRow key={token.id} token={token} revoked />
            ))}
          </div>
        </details>
      ) : null}
      <div className="token-issue-form">
        <label>
          <span>Token label</span>
          <input value={label} maxLength={120} onChange={(event) => setLabel(event.target.value)} />
        </label>
        <fieldset>
          <legend>Scopes</legend>
          {MCP_SCOPES.map((scope) => (
            <label className="checkbox-row" key={scope}>
              <input
                type="checkbox"
                checked={scopes.includes(scope)}
                disabled={scope === REQUIRED_MCP_SCOPE}
                onChange={() => toggleScope(scope)}
              />
              <span>{scope}</span>
            </label>
          ))}
        </fieldset>
        <label>
          <span>Expires at</span>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
        </label>
        {issueMutation.isError ? (
          <p className="form-error" role="alert">
            {errorMessage(issueMutation.error, "Could not issue MCP token.")}
          </p>
        ) : null}
        {revokeMutation.isError ? (
          <p className="form-error" role="alert">
            {errorMessage(revokeMutation.error, "Could not revoke MCP token.")}
          </p>
        ) : null}
        <button
          type="button"
          className="secondary-button"
          disabled={!canIssue}
          onClick={handleIssue}
        >
          {issueMutation.isPending ? "Issuing..." : "Create token"}
        </button>
      </div>
    </section>
  );
});

function TokenRow({
  token,
  revoked = false,
  isRevoking = false,
  onRevoke,
}: {
  token: McpTokenRecord;
  revoked?: boolean;
  isRevoking?: boolean;
  onRevoke?: () => void;
}) {
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
        </span>
      </div>
      {!revoked && onRevoke ? (
        <button type="button" className="danger-button" disabled={isRevoking} onClick={onRevoke}>
          {isRevoking ? "Revoking..." : "Revoke"}
        </button>
      ) : null}
    </div>
  );
}
