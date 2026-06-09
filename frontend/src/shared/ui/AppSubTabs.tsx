import type { ReactNode } from "react";
import { type To, useLocation, useNavigate, useResolvedPath } from "react-router-dom";

export function AppSubTabs({
  id,
  ariaLabel,
  role,
  variant,
  children,
  actions,
}: {
  id?: string;
  ariaLabel: string;
  role?: "tablist";
  variant?: "pills";
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div id={id} className="app-subtabs" data-variant={variant} role={role} aria-label={ariaLabel}>
      <div className="app-subtabs__list">{children}</div>
      {actions ? <div className="app-subtabs__actions">{actions}</div> : null}
    </div>
  );
}

export function AppSubTabButton({
  active,
  children,
  onClick,
  role,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
  role?: "tab";
}) {
  return (
    <button
      type="button"
      role={role}
      aria-selected={role === "tab" ? active : undefined}
      aria-current={role === undefined && active ? "page" : undefined}
      className="app-subtabs__tab"
      data-active={active ? "true" : undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function AppSubTabLink({ to, children }: { to: To; children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const resolved = useResolvedPath(to);
  const active = location.pathname === resolved.pathname;

  return (
    <AppSubTabButton active={active} onClick={() => navigate(to)}>
      {children}
    </AppSubTabButton>
  );
}
