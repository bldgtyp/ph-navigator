import { type FormEvent, useState } from "react";
import { ApiRequestError } from "../../../shared/api/client";
import { formatProjectDateTime } from "../../../shared/lib/dates";
import { errorMessage } from "../../../shared/lib/errors";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { useUnitPreference } from "../../../lib/units";
import { useMcpTokensQuery } from "../../mcp/hooks";
import { useProjectLocationQuery, useUpdateProjectMutation } from "../hooks";
import { elevationUnitLabel } from "../location-form";
import type { CertificationProgram, ProjectDetail, UpdateProjectPayload } from "../types";
import { CertificationProgramFieldset } from "./CertificationProgramFieldset";
import { ProjectLocationSummary } from "./ProjectLocationSummary";
import { ProjectMcpTokensSection } from "./ProjectMcpTokensSection";

export function ProjectSettingsModal({
  project,
  onClose,
}: {
  project: ProjectDetail;
  onClose: () => void;
}) {
  const isViewer = project.access_mode === "viewer";
  const [name, setName] = useState(project.name);
  const [publicAlias, setPublicAlias] = useState(project.public_alias ?? "");
  const [btNumber, setBtNumber] = useState(project.bt_number);
  const [client, setClient] = useState(project.client ?? "");
  const [certPrograms, setCertPrograms] = useState<CertificationProgram[]>(project.cert_programs);
  const [phiusNumber, setPhiusNumber] = useState(project.phius_number ?? "");
  const [phiusDropboxUrl, setPhiusDropboxUrl] = useState(project.phius_dropbox_url ?? "");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const { unitSystem } = useUnitPreference();
  const updateProjectMutation = useUpdateProjectMutation(project.id);
  const locationQuery = useProjectLocationQuery(project.id);
  const tokensQuery = useMcpTokensQuery(project.id, !isViewer);
  const changedPayload = changedProjectFields(project, {
    name,
    publicAlias,
    btNumber,
    client,
    certPrograms,
    phiusNumber,
    phiusDropboxUrl,
  });
  const validationError = settingsValidationError(name, btNumber, phiusDropboxUrl);
  const isDirty = Object.keys(changedPayload).length > 0;
  const isSaving = updateProjectMutation.isPending;
  const canSave = !isViewer && isDirty && !validationError && !isSaving;

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
    void saveSettings();
  };

  const saveSettings = async () => {
    try {
      await updateProjectMutation.mutateAsync(changedPayload);
      onClose();
    } catch {
      // Mutation state renders the authoritative error message below.
    }
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
                <span>Public alias</span>
                <input
                  value={publicAlias}
                  maxLength={200}
                  placeholder="e.g. Manhattan Townhouse"
                  onChange={(event) => setPublicAlias(event.target.value)}
                />
              </label>
              <p className="form-note">
                Public-facing title shown wherever the project name appears. Leave blank to show the
                real project name.
              </p>
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
        <section className="settings-section" aria-labelledby="settings-location-title">
          <div className="settings-section-heading">
            <h3 id="settings-location-title">Location</h3>
            <span>{elevationUnitLabel(unitSystem)}</span>
          </div>
          {locationQuery.isLoading ? (
            <p className="form-note">Loading project location...</p>
          ) : null}
          {locationQuery.error ? (
            <p className="form-error">
              {errorMessage(locationQuery.error, "Could not load project location.")}
            </p>
          ) : null}
          <ProjectLocationSummary
            projectId={project.id}
            location={locationQuery.data}
            unitSystem={unitSystem}
          />
          <p className="form-note">Edit location and weather data in the Climate tab.</p>
        </section>
        {!isViewer ? (
          <ProjectMcpTokensSection
            tokens={tokensQuery.data}
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
              {isSaving ? "Saving..." : "Save"}
            </button>
          ) : null}
        </div>
      </form>
    </ModalDialog>
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
    publicAlias: string;
    btNumber: string;
    client: string;
    certPrograms: CertificationProgram[];
    phiusNumber: string;
    phiusDropboxUrl: string;
  },
): UpdateProjectPayload {
  const next = {
    name: values.name.trim(),
    public_alias: values.publicAlias.trim() || null,
    bt_number: values.btNumber.trim(),
    client: values.client.trim() || null,
    cert_programs: values.certPrograms,
    phius_number: values.phiusNumber.trim() || null,
    phius_dropbox_url: values.phiusDropboxUrl.trim() || null,
  };
  const payload: UpdateProjectPayload = {};
  if (next.name !== project.name) payload.name = next.name;
  if (next.public_alias !== project.public_alias) payload.public_alias = next.public_alias;
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
