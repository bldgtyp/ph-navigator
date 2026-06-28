import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { AccountCompletePage } from "../features/auth/routes/AccountCompletePage";
import { RequireAuth } from "../features/auth/routes/RequireAuth";
import { SignInPage } from "../features/auth/routes/SignInPage";
import type { AuthSession } from "../features/auth/types";
import { ProjectTabRedirect } from "../features/projects/routes/ProjectTabRedirect";
import { spacesRoomsPath } from "../features/spaces/paths";
import { ShellMessage } from "../shared/ui/ShellMessage";

const Dashboard = lazy(() =>
  import("../features/projects/routes/Dashboard").then((module) => ({ default: module.Dashboard })),
);
const MaterialsCatalogPage = lazy(() =>
  import("../features/catalogs/routes/MaterialsCatalogPage").then((module) => ({
    default: module.MaterialsCatalogPage,
  })),
);
const FrameTypesCatalogPage = lazy(() =>
  import("../features/catalogs/routes/FrameTypesCatalogPage").then((module) => ({
    default: module.FrameTypesCatalogPage,
  })),
);
const GlazingTypesCatalogPage = lazy(() =>
  import("../features/catalogs/routes/GlazingTypesCatalogPage").then((module) => ({
    default: module.GlazingTypesCatalogPage,
  })),
);
const ProjectShell = lazy(() =>
  import("../features/projects/routes/ProjectShell").then((module) => ({
    default: module.ProjectShell,
  })),
);
const AdminUsersPage = lazy(() =>
  import("../features/admin/routes/AdminUsersPage").then((module) => ({
    default: module.AdminUsersPage,
  })),
);

export function AppRouter() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/invite" element={<AccountCompletePage mode="invite" />} />
      <Route path="/reset" element={<AccountCompletePage mode="reset" />} />
      <Route
        path="/admin/users"
        element={authenticatedRoute(
          (session) => (
            <AdminUsersPage session={session} />
          ),
          "Users",
          "Loading users...",
        )}
      />
      <Route
        path="/dashboard"
        element={authenticatedRoute(
          (session) => (
            <Dashboard session={session} />
          ),
          "Dashboard",
          "Loading dashboard...",
        )}
      />
      <Route
        path="/catalog/materials"
        element={authenticatedRoute(
          (session) => (
            <MaterialsCatalogPage session={session} />
          ),
          "Catalog",
          "Loading materials...",
        )}
      />
      <Route
        path="/catalog/frame-types"
        element={authenticatedRoute(
          (session) => (
            <FrameTypesCatalogPage session={session} />
          ),
          "Catalog",
          "Loading frame types...",
        )}
      />
      <Route
        path="/catalog/glazing-types"
        element={authenticatedRoute(
          (session) => (
            <GlazingTypesCatalogPage session={session} />
          ),
          "Catalog",
          "Loading glazing types...",
        )}
      />
      <Route path="/projects/:projectId" element={<ProjectTabRedirect />} />
      <Route path="/projects/:projectId/windows/*" element={<WindowsToAperturesRedirect />} />
      <Route path="/projects/:projectId/rooms" element={<RoomsToSpacesRedirect />} />
      <Route
        path="/projects/:projectId/:tab/*"
        element={
          <Suspense fallback={<ShellMessage title="Project" message="Loading project..." />}>
            <ProjectShell />
          </Suspense>
        }
      />
      <Route path="/" element={<RootRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function authenticatedRoute(
  render: (session: AuthSession) => ReactNode,
  title: string,
  message: string,
) {
  return (
    <RequireAuth>
      {(session) => (
        <Suspense fallback={<ShellMessage title={title} message={message} />}>
          {render(session)}
        </Suspense>
      )}
    </RequireAuth>
  );
}

function RootRoute() {
  return <RequireAuth>{() => <Navigate to="/dashboard" replace />}</RequireAuth>;
}

function WindowsToAperturesRedirect() {
  const { projectId } = useParams();
  return <Navigate to={`/projects/${projectId}/apertures`} replace />;
}

function RoomsToSpacesRedirect() {
  const { projectId } = useParams();
  const location = useLocation();
  return (
    <Navigate
      to={{
        pathname: spacesRoomsPath(projectId ?? ""),
        search: location.search,
        hash: location.hash,
      }}
      replace
    />
  );
}
