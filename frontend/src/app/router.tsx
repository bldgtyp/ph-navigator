import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "../features/auth/routes/RequireAuth";
import { SignInPage } from "../features/auth/routes/SignInPage";
import { CatalogPlaceholder } from "../features/catalogs/routes/CatalogPlaceholder";
import { Dashboard } from "../features/projects/routes/Dashboard";
import { ProjectShell } from "../features/projects/routes/ProjectShell";
import { ProjectTabRedirect } from "../features/projects/routes/ProjectTabRedirect";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignInPage />} />
      <Route
        path="/dashboard"
        element={<RequireAuth>{(session) => <Dashboard session={session} />}</RequireAuth>}
      />
      <Route
        path="/catalog/:catalogSlug"
        element={<RequireAuth>{(session) => <CatalogPlaceholder session={session} />}</RequireAuth>}
      />
      <Route path="/projects/:projectId" element={<ProjectTabRedirect />} />
      <Route path="/projects/:projectId/:tab" element={<ProjectShell />} />
      <Route path="/" element={<RootRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function RootRoute() {
  return <RequireAuth>{() => <Navigate to="/dashboard" replace />}</RequireAuth>;
}
