import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { formatProjectDateTime } from "../../../shared/lib/dates";
import { errorMessage } from "../../../shared/lib/errors";
import { TopbarAccountMenu, WorkspaceTopbar } from "../../../shared/ui/WorkspaceTopbar";
import { useSignOutMutation } from "../../auth/hooks";
import type { AuthSession } from "../../auth/types";
import { CATALOG_READ_SCOPE_LABEL } from "../constants";
import { useDecideDeviceAuthorizationMutation, useDeviceAuthorizationQuery } from "../hooks";
import "../approve-agent.css";

const PROJECT_ACCESS_ALL = "projects.access.all";

export function ApproveAgentPage({ session }: { session: AuthSession }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userCode = normalizeUserCode(searchParams.get("code") ?? "");
  const authorizationQuery = useDeviceAuthorizationQuery(userCode);
  const decisionMutation = useDecideDeviceAuthorizationMutation(userCode);
  const signOutMutation = useSignOutMutation();
  const authorization = authorizationQuery.data;
  const isPending = authorization?.status === "pending";
  const hasTenantWideReach = session.capabilities.includes(PROJECT_ACCESS_ALL);
  const hasProjectRead = authorization?.scopes.includes("project:read");

  const handleSignOut = () => {
    const next = encodeURIComponent(`/approve-agent?code=${userCode}`);
    signOutMutation.mutate(undefined, {
      onSettled: () => navigate(`/sign-in?next=${next}`, { replace: true }),
    });
  };

  return (
    <main className="workspace-shell">
      <WorkspaceTopbar
        breadcrumbs={[{ label: "Approve agent" }]}
        accountSlot={
          <TopbarAccountMenu label={session.user.display_name} onSignOut={handleSignOut} />
        }
      />
      <section className="agent-approval-page" aria-labelledby="approve-agent-title">
        <div className="agent-approval">
          <header className="agent-approval-heading">
            <div>
              <p className="eyebrow">Agent access</p>
              <h1 id="approve-agent-title">Approve this agent?</h1>
              <p className="agent-approval-intro">
                Review the request below to connect an agent to PH-Navigator.
              </p>
            </div>
          </header>
          <section className="agent-approval-card" aria-labelledby="agent-request-title">
            <div className="agent-approval-card-heading">
              <h2 id="agent-request-title">Device request</h2>
            </div>
            {!userCode ? (
              <p className="form-error" role="alert">
                This approval link does not include a valid user code.
              </p>
            ) : null}
            {authorizationQuery.isLoading ? <p className="form-note">Loading request...</p> : null}
            {authorizationQuery.error ? (
              <p className="form-error" role="alert">
                {errorMessage(authorizationQuery.error, "Could not load this agent request.")}
              </p>
            ) : null}
            {authorization ? (
              <>
                <dl className="agent-approval-details">
                  <div>
                    <dt>Machine / agent</dt>
                    <dd>{authorization.label}</dd>
                  </div>
                  <div>
                    <dt>User code</dt>
                    <dd>
                      <code className="agent-approval-code">{authorization.user_code}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Requested scopes</dt>
                    <dd className="agent-approval-scopes">
                      {authorization.scopes.map((scope) => (
                        <span className="chip chip--sm chip--outline" key={scope}>
                          {scope === "catalog:read" ? CATALOG_READ_SCOPE_LABEL : scope}
                        </span>
                      ))}
                    </dd>
                  </div>
                  <div>
                    <dt>Request expires</dt>
                    <dd>{formatProjectDateTime(authorization.expires_at)}</dd>
                  </div>
                </dl>
                <p className="agent-approval-note">
                  {hasProjectRead
                    ? "Approval creates a revocable credential valid for one year across every project your account can access."
                    : "Approval creates a revocable credential valid for one year to read the shared material, frame, and glazing libraries."}{" "}
                  The secret is delivered only to the requesting agent.
                </p>
                {hasTenantWideReach && hasProjectRead ? (
                  <p className="agent-approval-warning" role="alert">
                    Your account has tenant-wide project access. This credential will inherit that
                    reach.
                  </p>
                ) : null}
                {isPending ? (
                  <div className="agent-approval-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={decisionMutation.isPending}
                      onClick={() => decisionMutation.mutate("deny")}
                    >
                      {decisionMutation.isPending && decisionMutation.variables === "deny"
                        ? "Denying..."
                        : "Deny"}
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      disabled={decisionMutation.isPending}
                      onClick={() => decisionMutation.mutate("approve")}
                    >
                      {decisionMutation.isPending && decisionMutation.variables === "approve"
                        ? "Approving..."
                        : "Approve"}
                    </button>
                  </div>
                ) : (
                  <p className="agent-approval-status" role="status">
                    Request status: <strong>{authorization.status}</strong>. You may close this tab.
                  </p>
                )}
                {decisionMutation.error ? (
                  <p className="form-error" role="alert">
                    {errorMessage(decisionMutation.error, "Could not update this agent request.")}
                  </p>
                ) : null}
              </>
            ) : null}
          </section>
          <p className="agent-approval-manage">
            <Link to="/account/agent-tokens">Manage my agent tokens</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

function normalizeUserCode(value: string): string {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.length !== 8) return "";
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}
