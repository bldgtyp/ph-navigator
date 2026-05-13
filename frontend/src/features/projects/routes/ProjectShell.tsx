import { Link, Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/errors";
import { ShellMessage } from "../../../shared/ui/ShellMessage";
import { WorkspaceTopbar } from "../../../shared/ui/WorkspaceTopbar";
import { VersionControls } from "../../project_document/components/VersionControls";
import { ProjectTabContent } from "../components/ProjectTabContent";
import { useProjectQuery } from "../hooks";
import { isProjectTab, PROJECT_TABS, projectStatusPath, projectTabPath, TAB_LABELS } from "../lib";

export function ProjectShell() {
  const { projectId, tab } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = isProjectTab(tab) ? tab : null;
  const projectQuery = useProjectQuery(projectId);

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

  if (!projectQuery.data) {
    return <ShellMessage title="Project unavailable" message="Could not load project." />;
  }

  const project = projectQuery.data;
  const requestedVersionId = searchParams.get("version");
  const openVersion =
    project.versions.find((version) => version.id === requestedVersionId) ??
    project.active_version ??
    null;
  const openProject = {
    ...project,
    active_version_id: openVersion?.id ?? null,
    active_version: openVersion,
  };
  const isViewer = project.access_mode === "viewer";
  const returnPath = `${location.pathname}${location.search}${location.hash}`;
  const openVersionById = (versionId: string) => {
    const next = new URLSearchParams(searchParams);
    if (versionId === project.active_version_id) {
      next.delete("version");
    } else {
      next.set("version", versionId);
    }
    setSearchParams(next);
  };

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
