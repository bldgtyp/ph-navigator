import { Link, Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/errors";
import { ShellMessage } from "../../../shared/ui/ShellMessage";
import { WorkspaceTopbar } from "../../../shared/ui/WorkspaceTopbar";
import { projectDownloadUrl } from "../../project_document/api";
import { VersionControls } from "../../project_document/components/VersionControls";
import { useDraftSummaryQuery, useProjectDocumentQuery } from "../../project_document/hooks";
import { isReadSafeProjectDocument } from "../../project_document/lib";
import type { ProjectDocumentReadSafeEnvelope } from "../../project_document/types";
import { ProjectTabContent } from "../components/ProjectTabContent";
import { useProjectQuery } from "../hooks";
import { isProjectTab, PROJECT_TABS, projectStatusPath, projectTabPath, TAB_LABELS } from "../lib";

export function ProjectShell() {
  const { projectId, tab } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = isProjectTab(tab) ? tab : null;
  const projectQuery = useProjectQuery(projectId);
  const projectData = projectQuery.data;
  const requestedVersionId = searchParams.get("version");
  const openVersion = projectData
    ? (projectData.versions.find((version) => version.id === requestedVersionId) ??
      projectData.active_version ??
      null)
    : null;
  const activeVersionId = openVersion?.id ?? null;
  const isViewer = projectData?.access_mode === "viewer";
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

  if (readSafeEnvelope && openProject.active_version_id) {
    return (
      <main className="workspace-shell">
        <WorkspaceTopbar>
          {isViewer ? (
            <Link className="text-link" to={`/sign-in?next=${encodeURIComponent(returnPath)}`}>
              Sign in
            </Link>
          ) : (
            <span>Editor</span>
          )}
        </WorkspaceTopbar>
        <ReadSafeRecoveryPanel
          projectName={project.name}
          versions={project.versions.map((version) => ({ id: version.id, name: version.name }))}
          isViewer={isViewer}
          envelope={readSafeEnvelope}
          onOpenVersion={openVersionById}
        />
      </main>
    );
  }

  return (
    <main className="workspace-shell">
      <WorkspaceTopbar>
        {isViewer ? (
          <Link className="text-link" to={`/sign-in?next=${encodeURIComponent(returnPath)}`}>
            Sign in
          </Link>
        ) : (
          <span>Editor</span>
        )}
      </WorkspaceTopbar>
      <section className="project-page" aria-labelledby="project-title">
        {isViewer ? <div className="read-only-banner">Read-only public view</div> : null}
        <div className="project-header">
          <div>
            <p className="eyebrow">Project</p>
            <h1 id="project-title">{project.name}</h1>
            <p className="project-meta">
              {project.bt_number}
              {project.client ? ` · ${project.client}` : ""}
            </p>
          </div>
          <VersionControls
            project={openProject}
            defaultVersionId={project.active_version_id}
            onOpenVersion={openVersionById}
          />
        </div>
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
      {isViewer ? <div className="read-only-banner">Read-only public view</div> : null}
      <div className="project-header">
        <div>
          <p className="eyebrow">Project</p>
          <h1>{projectName}</h1>
        </div>
        <a
          className="secondary-button download-link"
          href={projectDownloadUrl(projectId, activeVersionId)}
        >
          Project JSON
        </a>
      </div>
      <div className="read-safe-panel">
        <h2 id="read-safe-title">Project format recovery</h2>
        <p>{envelope.message}</p>
        <div className="read-safe-actions">
          <a className="download-link" href={projectDownloadUrl(projectId, activeVersionId)}>
            Download raw project JSON
          </a>
        </div>
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
      </div>
    </section>
  );
}
