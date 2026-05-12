import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { WorkspaceTopbar } from "../../../shared/ui/WorkspaceTopbar";
import { useSignOutMutation } from "../../auth/hooks";
import type { AuthSession } from "../../auth/types";
import { NewProjectModal } from "../components/NewProjectModal";
import { ProjectList } from "../components/ProjectList";
import { useProjectsQuery } from "../hooks";
import { projectStatusPath } from "../lib";

export function Dashboard({ session }: { session: AuthSession }) {
  const navigate = useNavigate();
  const projectsQuery = useProjectsQuery();
  const signOutMutation = useSignOutMutation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleSignOut = () => {
    signOutMutation.mutate(undefined, {
      onSettled: () => {
        navigate("/sign-in?next=%2Fdashboard", { replace: true });
      },
    });
  };

  return (
    <main className="workspace-shell">
      <WorkspaceTopbar>
        <>
          <span>{session.user.display_name}</span>
          <button type="button" className="text-button" onClick={handleSignOut}>
            Sign out
          </button>
        </>
      </WorkspaceTopbar>
      <section className="dashboard-page" aria-labelledby="dashboard-title">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1 id="dashboard-title">Projects</h1>
          </div>
          <button type="button" onClick={() => setIsCreateOpen(true)}>
            New project
          </button>
        </div>
        <ProjectList
          isLoading={projectsQuery.isLoading}
          error={projectsQuery.error}
          projects={projectsQuery.data ?? []}
        />
      </section>
      {isCreateOpen ? (
        <NewProjectModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={(project) => {
            setIsCreateOpen(false);
            navigate(projectStatusPath(project.id));
          }}
        />
      ) : null}
    </main>
  );
}
