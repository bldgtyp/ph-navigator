import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { formatProjectDateTime } from "../../../shared/lib/dates";
import { errorMessage } from "../../../shared/lib/errors";
import { TopbarAccountMenu, WorkspaceTopbar } from "../../../shared/ui/WorkspaceTopbar";
import { useSignOutMutation } from "../../auth/hooks";
import type { AuthSession } from "../../auth/types";
import { useDecideDeviceAuthorizationMutation, useDeviceAuthorizationQuery } from "../hooks";

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
      <section className="dashboard-page" aria-labelledby="approve-agent-title">
        <div className="dashboard-sections">
          <header className="page-heading">
            <div>
              <p className="eyebrow">Agent access</p>
              <h1 id="approve-agent-title">Approve this agent?</h1>
            </div>
          </header>
          <section className="settings-section" aria-labelledby="agent-request-title">
            <div className="settings-section-heading">
              <h3 id="agent-request-title">Device request</h3>
              <span>{userCode || "Missing code"}</span>
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
                <dl className="metadata-grid">
                  <div>
                    <dt>Machine / agent</dt>
                    <dd>{authorization.label}</dd>
                  </div>
                  <div>
                    <dt>User code</dt>
                    <dd>{authorization.user_code}</dd>
                  </div>
                  <div>
                    <dt>Requested scopes</dt>
                    <dd>{authorization.scopes.join(", ")}</dd>
                  </div>
                  <div>
                    <dt>Expires</dt>
                    <dd>{formatProjectDateTime(authorization.expires_at)}</dd>
                  </div>
                </dl>
                <p className="form-note">
                  Approval creates a revocable credential valid for one year across every project
                  your account can access. The secret is delivered only to the requesting agent.
                </p>
                {hasTenantWideReach ? (
                  <p className="form-error" role="alert">
                    Your account has tenant-wide project access. This credential will inherit that
                    reach.
                  </p>
                ) : null}
                {isPending ? (
                  <div className="modal-actions">
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
                  <p role="status">
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
          <p className="form-note">
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
