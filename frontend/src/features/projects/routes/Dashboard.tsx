import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CatalogMenu } from "../../catalogs/components/CatalogMenu";
import { WorkspaceTopbar, TopbarAccountMenu } from "../../../shared/ui/WorkspaceTopbar";
import { useSignOutMutation } from "../../auth/hooks";
import type { AuthSession } from "../../auth/types";
import { DeletedProjectsPanel } from "../components/DeletedProjectsPanel";
import { DeleteProjectsModal } from "../components/DeleteProjectsModal";
import { NewProjectModal } from "../components/NewProjectModal";
import { ProjectList } from "../components/ProjectList";
import {
  useBulkDeleteProjectsMutation,
  useDeletedProjectsQuery,
  useProjectsQuery,
  useRestoreProjectMutation,
} from "../hooks";
import { projectStatusPath } from "../lib";
import type { ProjectSummary } from "../types";

const EMPTY_PROJECTS: ProjectSummary[] = [];

export function Dashboard({ session }: { session: AuthSession }) {
  const navigate = useNavigate();
  const projectsQuery = useProjectsQuery();
  const deletedProjectsQuery = useDeletedProjectsQuery();
  const bulkDeleteMutation = useBulkDeleteProjectsMutation();
  const restoreMutation = useRestoreProjectMutation();
  const signOutMutation = useSignOutMutation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(() => new Set());
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const projects = projectsQuery.data ?? EMPTY_PROJECTS;
  const selectedProjects = projects.filter((project) => selectedProjectIds.has(project.id));

  useEffect(() => {
    setSelectedProjectIds((current) => {
      if (current.size === 0) return current;
      const visibleIds = new Set(projects.map((project) => project.id));
      const next = new Set(Array.from(current).filter((projectId) => visibleIds.has(projectId)));
      return next.size === current.size ? current : next;
    });
  }, [projects]);

  const handleSignOut = () => {
    signOutMutation.mutate(undefined, {
      onSettled: () => {
        navigate("/sign-in?next=%2Fdashboard", { replace: true });
      },
    });
  };

  const toggleProjectSelection = (projectId: string, selected: boolean) => {
    setSelectedProjectIds((current) => {
      const next = new Set(current);
      if (selected) {
        next.add(projectId);
      } else {
        next.delete(projectId);
      }
      return next;
    });
  };

  const toggleAllProjects = (selected: boolean) => {
    setSelectedProjectIds(selected ? new Set(projects.map((project) => project.id)) : new Set());
  };

  const openDeleteModal = () => {
    if (selectedProjects.length === 0) return;
    bulkDeleteMutation.reset();
    setIsDeleteOpen(true);
  };

  const closeDeleteModal = () => {
    if (bulkDeleteMutation.isPending) return;
    bulkDeleteMutation.reset();
    setIsDeleteOpen(false);
  };

  const confirmDelete = () => {
    const projectIds = selectedProjects.map((project) => project.id);
    if (projectIds.length === 0) return;
    bulkDeleteMutation.mutate(projectIds, {
      onSuccess: () => {
        setSelectedProjectIds(new Set());
        setIsDeleteOpen(false);
      },
    });
  };

  return (
    <main className="workspace-shell">
      <WorkspaceTopbar
        primaryNav={<CatalogMenu />}
        accountSlot={
          <TopbarAccountMenu label={session.user.display_name} onSignOut={handleSignOut} />
        }
      />
      <section className="dashboard-page" aria-labelledby="dashboard-title">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1 id="dashboard-title">My Projects</h1>
          </div>
          <button
            type="button"
            aria-label="Create new project"
            onClick={() => setIsCreateOpen(true)}
          >
            New project
          </button>
        </div>
        <div className="dashboard-sections">
          <ProjectList
            isLoading={projectsQuery.isLoading}
            error={projectsQuery.error}
            projects={projects}
            onCreateProject={() => setIsCreateOpen(true)}
            selectedProjectIds={selectedProjectIds}
            selectedCount={selectedProjectIds.size}
            isDeleting={bulkDeleteMutation.isPending}
            onToggleProject={toggleProjectSelection}
            onToggleAllProjects={toggleAllProjects}
            onDeleteSelected={openDeleteModal}
          />
          <DeletedProjectsPanel
            isLoading={deletedProjectsQuery.isLoading}
            error={deletedProjectsQuery.error}
            projects={deletedProjectsQuery.data ?? []}
            restoreError={restoreMutation.error}
            restoringProjectId={
              restoreMutation.isPending ? (restoreMutation.variables ?? null) : null
            }
            onRestoreProject={(projectId) => restoreMutation.mutate(projectId)}
          />
        </div>
      </section>
      {isDeleteOpen ? (
        <DeleteProjectsModal
          projects={selectedProjects}
          isPending={bulkDeleteMutation.isPending}
          error={bulkDeleteMutation.error}
          onCancel={closeDeleteModal}
          onConfirm={confirmDelete}
        />
      ) : null}
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
