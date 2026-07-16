import { useState, type ReactNode } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ApiRequestError } from "../../../shared/api/client";
import { errorMessage } from "../../../shared/lib/errors";
import { ShellMessage } from "../../../shared/ui/ShellMessage";
import { TopbarAccountMenu, WorkspaceTopbar } from "../../../shared/ui/WorkspaceTopbar";
import { useSessionQuery, useSignOutMutation } from "../../auth/hooks";
import { projectDownloadUrl } from "../../project_document/api";
import { VersionControls } from "../../project_document/components/VersionControls";
import { useDraftSummaryQuery, useProjectDocumentQuery } from "../../project_document/hooks";
import { isReadSafeProjectDocument } from "../../project_document/lib";
import type { ProjectDocumentReadSafeEnvelope } from "../../project_document/types";
import { ProjectTabContent } from "../components/ProjectTabContent";
import { ProjectSettingsModal } from "../components/ProjectSettingsModal";
import { useProjectQuery } from "../hooks";
import { isProjectTab, PROJECT_TABS, projectStatusPath, projectTabPath, TAB_LABELS } from "../lib";

export function ProjectShell() {
  const { projectId, tab } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const activeTab = isProjectTab(tab) ? tab : null;
  const sessionQuery = useSessionQuery();
  const signOutMutation = useSignOutMutation();
  const projectQuery = useProjectQuery(projectId);
  const projectData = projectQuery.data;
  const isViewer = projectData?.access_mode === "viewer";
  // Viewers (beta `client`) are pinned to the latest committed version with no
  // version UI (CP-8 / ledger §4.9): ignore any `?version=` override so they
  // auto-follow `active_version` and cannot reach older versions by URL.
  const requestedVersionId = isViewer ? null : searchParams.get("version");
  const openVersion = projectData
    ? (projectData.versions.find((version) => version.id === requestedVersionId) ??
      projectData.active_version ??
      null)
    : null;
  const activeVersionId = openVersion?.id ?? null;
  const editorDraftStatusQuery = useDraftSummaryQuery(
    projectData?.id ?? "",
    activeVersionId,
    Boolean(projectData && activeTab && !isViewer),
  );
  const viewerDocumentQuery = useProjectDocumentQuery(
    projectData?.id ?? "",
    activeVersionId,
    Boolean(projectData && activeTab && isViewer),
  );

  if (!activeTab && projectId) {
    return <Navigate to={projectStatusPath(projectId)} replace />;
  }

  if (projectQuery.isLoading) {
    return <ShellMessage title="Project" message="Loading project..." />;
  }

  if (projectQuery.isError) {
    if (
      projectQuery.error instanceof ApiRequestError &&
      projectQuery.error.status === 410 &&
      projectQuery.error.errorCode === "project_deleted"
    ) {
      return (
        <ShellMessage
          title="Project deleted"
          message="This project is deleted and no longer available from this URL."
        />
      );
    }
    return (
      <ShellMessage
        title="Project unavailable"
        message={errorMessage(projectQuery.error, "Could not load project.")}
      />
    );
  }

  if (!projectData) {
    return <ShellMessage title="Project unavailable" message="Could not load project." />;
  }

  const project = projectData;
  const openProject = {
    ...project,
    active_version_id: activeVersionId,
    active_version: openVersion,
  };
  const returnPath = `${location.pathname}${location.search}${location.hash}`;
  const editorReadSafeEnvelope = isReadSafeProjectDocument(editorDraftStatusQuery.data)
    ? editorDraftStatusQuery.data
    : null;
  const viewerReadSafeEnvelope = isReadSafeProjectDocument(viewerDocumentQuery.data)
    ? viewerDocumentQuery.data
    : null;
  const readSafeEnvelope = editorReadSafeEnvelope ?? viewerReadSafeEnvelope;
  const openVersionById = (versionId: string) => {
    const next = new URLSearchParams(searchParams);
    if (versionId === project.active_version_id) {
      next.delete("version");
    } else {
      next.set("version", versionId);
    }
    setSearchParams(next);
  };
  // Title sites render the public-facing `display_name` (alias ?? name), never
  // the internal `name` directly. See planning/features/project-public-alias.
  const projectTitleLabel = `${project.bt_number} - ${project.display_name}`;
  const projectCrumbLabel = projectTitleLabel;
  const topbarBreadcrumbs = [{ label: projectCrumbLabel, to: projectStatusPath(project.id) }];
  const handleSignOut = () => {
    signOutMutation.mutate(undefined, {
      onSettled: () => {
        navigate(`/sign-in?next=${encodeURIComponent(returnPath)}`, { replace: true });
      },
    });
  };
  const accountSlot = isViewer ? (
    <>
      <span className="chip chip--sm read-only-pill">Read-only</span>
      <Link className="text-link" to={`/sign-in?next=${encodeURIComponent(returnPath)}`}>
        Sign in
      </Link>
    </>
  ) : sessionQuery.data ? (
    <TopbarAccountMenu label={sessionQuery.data.user.display_name} onSignOut={handleSignOut} />
  ) : null;
  const renderTopbar = ({
    pathControls,
    documentControls,
  }: {
    pathControls?: ReactNode;
    documentControls?: ReactNode;
  } = {}) => (
    <WorkspaceTopbar
      breadcrumbs={topbarBreadcrumbs}
      pathControls={pathControls}
      documentControls={documentControls}
      accountSlot={accountSlot}
    />
  );
  const topbar = readSafeEnvelope ? (
    renderTopbar()
  ) : (
    <VersionControls
      project={openProject}
      defaultVersionId={project.active_version_id}
      onOpenVersion={openVersionById}
      onOpenProjectSettings={() => setIsSettingsOpen(true)}
    >
      {renderTopbar}
    </VersionControls>
  );

  if (readSafeEnvelope && openProject.active_version_id) {
    return (
      <main className="workspace-shell">
        {topbar}
        <ReadSafeRecoveryPanel
          projectName={project.display_name}
          versions={project.versions.map((version) => ({ id: version.id, name: version.name }))}
          isViewer={isViewer}
          envelope={readSafeEnvelope}
          onOpenVersion={openVersionById}
        />
      </main>
    );
  }

  return (
    // The model viewer fills the viewport: `model-shell` switches the shell to
    // a viewport-height flex column (see base.css). Other tabs scroll as normal.
    <main className={activeTab === "model" ? "workspace-shell model-shell" : "workspace-shell"}>
      {topbar}
      <section
        className="project-page project-workspace"
        aria-label={`${projectTitleLabel} workspace`}
      >
        <nav className="tabbar" aria-label="Project tabs">
          {PROJECT_TABS.map((projectTab) => (
            <Link
              key={projectTab}
              className={projectTab === activeTab ? "active" : ""}
              to={{
                pathname: projectTabPath(project.id, projectTab),
                search: searchParams.toString(),
              }}
            >
              {TAB_LABELS[projectTab]}
            </Link>
          ))}
        </nav>
        <ProjectTabContent tab={activeTab ?? "status"} project={openProject} />
      </section>
      {isSettingsOpen ? (
        <ProjectSettingsModal project={openProject} onClose={() => setIsSettingsOpen(false)} />
      ) : null}
    </main>
  );
}

function ReadSafeRecoveryPanel({
  projectName,
  versions,
  isViewer,
  envelope,
  onOpenVersion,
}: {
  projectName: string;
  versions: Array<{ id: string; name: string }>;
  isViewer: boolean;
  envelope: ProjectDocumentReadSafeEnvelope;
  onOpenVersion: (versionId: string) => void;
}) {
  const projectId = envelope.project_id;
  const activeVersionId = envelope.version_id;

  return (
    <section className="project-page read-safe-page" aria-labelledby="read-safe-title">
      <div className="project-header">
        <div>
          <p className="eyebrow">Project</p>
          <div className="project-title-row">
            <h1>{projectName}</h1>
          </div>
        </div>
        {/* Raw project-JSON download is a bulk export → editor-only (CP-7); the
            backend route 401s viewers, so don't surface the link to them. */}
        {!isViewer ? (
          <a
            className="secondary-button download-link"
            href={projectDownloadUrl(projectId, activeVersionId)}
          >
            Project JSON
          </a>
        ) : null}
      </div>
      <div className="read-safe-panel">
        <h2 id="read-safe-title">Project format recovery</h2>
        <p>{envelope.message}</p>
        {!isViewer ? (
          <div className="read-safe-actions">
            <a className="download-link" href={projectDownloadUrl(projectId, activeVersionId)}>
              Download raw project JSON
            </a>
          </div>
        ) : null}
        {!isViewer ? (
          <dl className="metadata-grid read-safe-diagnostics" aria-label="Diagnostic details">
            <div>
              <dt>Project ID</dt>
              <dd>{projectId}</dd>
            </div>
            <div>
              <dt>Version ID</dt>
              <dd>{activeVersionId}</dd>
            </div>
            <div>
              <dt>Saved schema</dt>
              <dd>{envelope.schema_version ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Current schema</dt>
              <dd>{envelope.current_schema_version}</dd>
            </div>
            <div>
              <dt>Request ID</dt>
              <dd>{envelope.request_id}</dd>
            </div>
          </dl>
        ) : null}
        {/* Version switching is editor/certifier-only; viewers are pinned to
            the latest committed version (CP-8), so hide the version list. */}
        {!isViewer ? (
          <div className="read-safe-versions">
            <h3>Open another version</h3>
            <div className="read-safe-version-list">
              {versions.map((version) => (
                <button
                  key={version.id}
                  type="button"
                  className="secondary-button"
                  onClick={() => onOpenVersion(version.id)}
                  disabled={version.id === activeVersionId}
                >
                  {version.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
