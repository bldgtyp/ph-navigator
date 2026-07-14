import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AUTH_REQUIRED_EVENT } from "../../../shared/api/client";
import { clearSessionAuthentication, wasSessionAuthenticated } from "../session-lifecycle";

const PUBLIC_AUTH_PATHS = new Set(["/sign-in", "/invite", "/reset"]);

/** Redirect a tab that loses an established session without blocking public viewers. */
export function SessionExpiryRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthRequired = () => {
      if (PUBLIC_AUTH_PATHS.has(location.pathname) || !wasSessionAuthenticated()) return;

      const next = `${location.pathname}${location.search}${location.hash}`;
      clearSessionAuthentication();
      navigate(`/sign-in?next=${encodeURIComponent(next)}`, { replace: true });
    };

    window.addEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
  }, [location.hash, location.pathname, location.search, navigate]);

  return null;
}
