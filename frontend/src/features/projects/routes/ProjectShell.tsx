import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/errors";
import { ShellMessage } from "../../../shared/ui/ShellMessage";
import { WorkspaceTopbar } from "../../../shared/ui/WorkspaceTopbar";
import { ProjectHeaderControls } from "../components/ProjectHeaderControls";
import { ProjectTabContent } from "../components/ProjectTabContent";
import { useProjectQuery } from "../hooks";
import { isProjectTab, PROJECT_TABS, projectStatusPath, projectTabPath, TAB_LABELS } from "../lib";

export function ProjectShell() {
  const { projectId, tab } = useParams();
  const location = useLocation();
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
  const isViewer = project.access_mode === "viewer";
  const returnPath = `${location.pathname}${location.search}${location.hash}`;

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
          <ProjectHeaderControls project={project} />
        </div>
        <nav className="tabbar" aria-label="Project tabs">
          {PROJECT_TABS.map((projectTab) => (
            <Link
              key={projectTab}
              className={projectTab === activeTab ? "active" : ""}
              to={projectTabPath(project.id, projectTab)}
            >
              {TAB_LABELS[projectTab]}
            </Link>
          ))}
        </nav>
        <ProjectTabContent tab={activeTab ?? "status"} project={project} />
      </section>
    </main>
  );
}
