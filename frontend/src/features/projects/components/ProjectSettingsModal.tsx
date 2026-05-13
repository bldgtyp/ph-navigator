import { type FormEvent, useMemo, useState } from "react";
import { ApiRequestError } from "../../../shared/api/client";
import { formatProjectDateTime } from "../../../shared/lib/dates";
import { errorMessage } from "../../../shared/lib/errors";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { MCP_SCOPES, REQUIRED_MCP_SCOPE } from "../../mcp/constants";
import {
  useIssueMcpTokenMutation,
  useMcpTokensQuery,
  useRevokeMcpTokenMutation,
} from "../../mcp/hooks";
import type { McpScope, McpTokenRecord } from "../../mcp/types";
import { useUpdateProjectMutation } from "../hooks";
import type { CertificationProgram, ProjectDetail, UpdateProjectPayload } from "../types";
import { CertificationProgramFieldset } from "./CertificationProgramFieldset";

export function ProjectSettingsModal({
  project,
  onClose,
}: {
  project: ProjectDetail;
  onClose: () => void;
}) {
  const isViewer = project.access_mode === "viewer";
  const [name, setName] = useState(project.name);
  const [btNumber, setBtNumber] = useState(project.bt_number);
  const [client, setClient] = useState(project.client ?? "");
  const [certPrograms, setCertPrograms] = useState<CertificationProgram[]>(project.cert_programs);
  const [phiusNumber, setPhiusNumber] = useState(project.phius_number ?? "");
  const [phiusDropboxUrl, setPhiusDropboxUrl] = useState(project.phius_dropbox_url ?? "");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const updateProjectMutation = useUpdateProjectMutation(project.id);
  const tokensQuery = useMcpTokensQuery(project.id, !isViewer);
  const changedPayload = useMemo(
    () =>
      changedProjectFields(project, {
        name,
        btNumber,
        client,
        certPrograms,
        phiusNumber,
        phiusDropboxUrl,
      }),
    [btNumber, certPrograms, client, name, phiusDropboxUrl, phiusNumber, project],
  );
  const validationError = settingsValidationError(name, btNumber, phiusDropboxUrl);
  const isDirty = Object.keys(changedPayload).length > 0;
  const canSave = !isViewer && isDirty && !validationError && !updateProjectMutation.isPending;

  const closeWithGuard = () => {
    if (isDirty && !confirmDiscard && !isViewer) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave) return;
    updateProjectMutation.mutate(changedPayload, { onSuccess: onClose });
  };

  return (
    <ModalDialog title="Project settings" titleId="project-settings-title" onClose={closeWithGuard}>
      <p className="modal-subtitle">
        {project.name} · {project.bt_number}
      </p>
      <form className="project-form settings-form" onSubmit={handleSubmit}>
        <section className="settings-section" aria-labelledby="settings-metadata-title">
          <h3 id="settings-metadata-title">Metadata</h3>
          {isViewer ? (
            <ReadOnlyMetadata project={project} />
          ) : (
            <>
              <label>
                <span>Project name</span>
                <input
                  value={name}
                  maxLength={200}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </label>
              <label>
                <span>BT number</span>
                <input
                  value={btNumber}
                  maxLength={64}
                  onChange={(event) => setBtNumber(event.target.value)}
                  required
                />
              </label>
              <label>
                <span>Client</span>
                <input
                  value={client}
                  maxLength={200}
                  onChange={(event) => setClient(event.target.value)}
                />
              </label>
              <CertificationProgramFieldset value={certPrograms} onChange={setCertPrograms} />
              <label>
                <span>Phius number</span>
                <input
                  value={phiusNumber}
                  maxLength={100}
                  onChange={(event) => setPhiusNumber(event.target.value)}
                />
              </label>
              <label>
                <span>Phius Dropbox URL</span>
                <input
                  value={phiusDropboxUrl}
                  maxLength={500}
                  onChange={(event) => setPhiusDropboxUrl(event.target.value)}
                />
              </label>
            </>
          )}
          <dl className="metadata-grid settings-readonly-grid" aria-label="Project metadata">
            <div>
              <dt>Owner</dt>
              <dd>{project.owner_display_name ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatProjectDateTime(project.created_at)}</dd>
            </div>
            <div>
              <dt>Last saved</dt>
              <dd>
                {project.last_saved_at ? formatProjectDateTime(project.last_saved_at) : "Never"}
              </dd>
            </div>
            <div>
              <dt>Project ID</dt>
              <dd>{project.id}</dd>
            </div>
          </dl>
        </section>
        {!isViewer ? (
          <McpTokensSection
            tokens={tokensQuery.data ?? []}
            isLoading={tokensQuery.isLoading}
            error={tokensQuery.error}
            projectId={project.id}
          />
        ) : null}
        {validationError ? <p className="form-error">{validationError}</p> : null}
        {updateProjectMutation.isError ? (
          <p className="form-error" role="alert">
            {settingsSaveError(updateProjectMutation.error)}
          </p>
        ) : null}
        {confirmDiscard ? (
          <div className="draft-banner settings-discard-warning">
            <span>You have unsaved changes. Discard?</span>
            <button type="button" className="text-button" onClick={() => setConfirmDiscard(false)}>
              Cancel
            </button>
            <button type="button" className="text-button" onClick={onClose}>
              Discard
            </button>
          </div>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={closeWithGuard}>
            {isViewer ? "Close" : "Cancel"}
          </button>
          {!isViewer ? (
            <button type="submit" disabled={!canSave}>
              {updateProjectMutation.isPending ? "Saving..." : "Save"}
            </button>
          ) : null}
        </div>
      </form>
    </ModalDialog>
  );
}

function McpTokensSection({
  tokens,
  isLoading,
  error,
  projectId,
}: {
  tokens: McpTokenRecord[];
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
  const activeTokens = tokens.filter((token) => token.revoked_at === null);
  const revokedTokens = tokens.filter((token) => token.revoked_at !== null);
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
}

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

function ReadOnlyMetadata({ project }: { project: ProjectDetail }) {
  return (
    <dl className="settings-readonly-list">
      <div>
        <dt>Project name</dt>
        <dd>{project.name}</dd>
      </div>
      <div>
        <dt>BT number</dt>
        <dd>{project.bt_number}</dd>
      </div>
      <div>
        <dt>Client</dt>
        <dd>{project.client ?? "None"}</dd>
      </div>
      <div>
        <dt>Phius number</dt>
        <dd>{project.phius_number ?? "None"}</dd>
      </div>
      <div>
        <dt>Phius Dropbox URL</dt>
        <dd>{project.phius_dropbox_url ?? "None"}</dd>
      </div>
    </dl>
  );
}

function changedProjectFields(
  project: ProjectDetail,
  values: {
    name: string;
    btNumber: string;
    client: string;
    certPrograms: CertificationProgram[];
    phiusNumber: string;
    phiusDropboxUrl: string;
  },
): UpdateProjectPayload {
  const next = {
    name: values.name.trim(),
    bt_number: values.btNumber.trim(),
    client: values.client.trim() || null,
    cert_programs: values.certPrograms,
    phius_number: values.phiusNumber.trim() || null,
    phius_dropbox_url: values.phiusDropboxUrl.trim() || null,
  };
  const payload: UpdateProjectPayload = {};
  if (next.name !== project.name) payload.name = next.name;
  if (next.bt_number !== project.bt_number) payload.bt_number = next.bt_number;
  if (next.client !== project.client) payload.client = next.client;
  if (next.phius_number !== project.phius_number) payload.phius_number = next.phius_number;
  if (next.phius_dropbox_url !== project.phius_dropbox_url) {
    payload.phius_dropbox_url = next.phius_dropbox_url;
  }
  if (
    normalizedPrograms(next.cert_programs).join("|") !==
    normalizedPrograms(project.cert_programs).join("|")
  ) {
    payload.cert_programs = next.cert_programs;
  }
  return payload;
}

function normalizedPrograms(programs: CertificationProgram[]): CertificationProgram[] {
  return Array.from(new Set(programs)).sort();
}

function settingsValidationError(
  name: string,
  btNumber: string,
  phiusDropboxUrl: string,
): string | null {
  if (name.trim().length === 0) return "Project name is required.";
  if (btNumber.trim().length === 0) return "BT number is required.";
  const trimmedUrl = phiusDropboxUrl.trim();
  if (trimmedUrl && !/^https?:\/\//.test(trimmedUrl)) {
    return "Phius Dropbox URL must start with http:// or https://.";
  }
  return null;
}

function settingsSaveError(error: Error): string {
  if (error instanceof ApiRequestError && error.errorCode === "bt_number_taken") {
    return "BT number is already in use by another project.";
  }
  return errorMessage(error, "Could not save project settings.");
}
