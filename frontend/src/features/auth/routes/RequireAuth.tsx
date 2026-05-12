import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/errors";
import { ShellMessage } from "../../../shared/ui/ShellMessage";
import { useSessionQuery } from "../hooks";
import { isAuthFailure } from "../lib";
import type { AuthSession } from "../types";

export function RequireAuth({ children }: { children: (session: AuthSession) => ReactNode }) {
  const sessionQuery = useSessionQuery();
  const location = useLocation();

  if (sessionQuery.isLoading) {
    return <ShellMessage title="Checking session" message="Loading dashboard..." />;
  }

  if (sessionQuery.isError && isAuthFailure(sessionQuery.error)) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/sign-in?next=${next}`} replace />;
  }

  if (sessionQuery.isError) {
    return (
      <ShellMessage
        title="Session check failed"
        message={errorMessage(sessionQuery.error, "Could not check session.")}
      />
    );
  }

  if (!sessionQuery.data) {
    return <ShellMessage title="Session check failed" message="Could not check session." />;
  }

  return children(sessionQuery.data);
}
