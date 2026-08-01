import { useNavigate } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/errors";
import { TopbarAccountMenu, WorkspaceTopbar } from "../../../shared/ui/WorkspaceTopbar";
import { useSignOutMutation } from "../../auth/hooks";
import type { AuthSession } from "../../auth/types";
import { McpTokenList } from "../components/McpTokenList";
import { useAgentTokensQuery, useRevokeAgentTokenMutation } from "../hooks";
import type { McpTokenRecord } from "../types";

const EMPTY_TOKENS: McpTokenRecord[] = [];

export function AgentTokensPage({ session }: { session: AuthSession }) {
  const navigate = useNavigate();
  const tokensQuery = useAgentTokensQuery();
  const revokeMutation = useRevokeAgentTokenMutation();
  const signOutMutation = useSignOutMutation();

  const handleSignOut = () => {
    signOutMutation.mutate(undefined, {
      onSettled: () => navigate("/sign-in?next=%2Faccount%2Fagent-tokens", { replace: true }),
    });
  };

  return (
    <main className="workspace-shell">
      <WorkspaceTopbar
        breadcrumbs={[{ label: "Agent tokens" }]}
        accountSlot={
          <TopbarAccountMenu label={session.user.display_name} onSignOut={handleSignOut} />
        }
      />
      <section className="dashboard-page" aria-labelledby="agent-tokens-title">
        <div className="dashboard-sections">
          <header className="page-heading">
            <div>
              <p className="eyebrow">Account</p>
              <h1 id="agent-tokens-title">My agent tokens</h1>
            </div>
          </header>
          <section className="settings-section" aria-labelledby="user-token-list-title">
            <div className="settings-section-heading">
              <h3 id="user-token-list-title">User-scoped tokens</h3>
              <span>All accessible projects</span>
            </div>
            <p className="form-note">
              Tokens expire after one year. New credentials are issued through agent login.
            </p>
            {tokensQuery.isLoading ? <p className="form-note">Loading agent tokens...</p> : null}
            {tokensQuery.error ? (
              <p className="form-error">
                {errorMessage(tokensQuery.error, "Could not load agent tokens.")}
              </p>
            ) : null}
            {tokensQuery.isSuccess ? (
              <McpTokenList
                tokens={tokensQuery.data ?? EMPTY_TOKENS}
                emptyMessage="No active agent tokens."
                revokingTokenId={revokeMutation.isPending ? revokeMutation.variables : undefined}
                onRevoke={(tokenId) => revokeMutation.mutate(tokenId)}
              />
            ) : null}
            {revokeMutation.error ? (
              <p className="form-error" role="alert">
                {errorMessage(revokeMutation.error, "Could not revoke agent token.")}
              </p>
            ) : null}
          </section>
        </div>
      </section>
    </main>
  );
}
