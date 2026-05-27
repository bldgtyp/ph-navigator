import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "../features/auth/routes/RequireAuth";
import { SignInPage } from "../features/auth/routes/SignInPage";
import { FrameTypesCatalogPage } from "../features/catalogs/routes/FrameTypesCatalogPage";
import { GlazingTypesCatalogPage } from "../features/catalogs/routes/GlazingTypesCatalogPage";
import { MaterialsCatalogPage } from "../features/catalogs/routes/MaterialsCatalogPage";
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
        path="/catalog/materials"
        element={
          <RequireAuth>{(session) => <MaterialsCatalogPage session={session} />}</RequireAuth>
        }
      />
      <Route
        path="/catalog/frame-types"
        element={
          <RequireAuth>{(session) => <FrameTypesCatalogPage session={session} />}</RequireAuth>
        }
      />
      <Route
        path="/catalog/glazing-types"
        element={
          <RequireAuth>{(session) => <GlazingTypesCatalogPage session={session} />}</RequireAuth>
        }
      />
      <Route path="/projects/:projectId" element={<ProjectTabRedirect />} />
      <Route path="/projects/:projectId/:tab/*" element={<ProjectShell />} />
      <Route path="/" element={<RootRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function RootRoute() {
  return <RequireAuth>{() => <Navigate to="/dashboard" replace />}</RequireAuth>;
}
