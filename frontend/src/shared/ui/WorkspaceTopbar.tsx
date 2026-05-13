import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type Breadcrumb = {
  label: string;
  to?: string;
};

export function WorkspaceTopbar({
  breadcrumbs = [],
  primaryNav,
  accountSlot,
}: {
  breadcrumbs?: Breadcrumb[];
  primaryNav: ReactNode;
  accountSlot: ReactNode;
}) {
  return (
    <header className="topbar">
      <Link className="brand" to="/dashboard" aria-label="PH-Navigator dashboard">
        PH-Nav
        <span className="brand-version">/ v2</span>
      </Link>
      {breadcrumbs.length > 0 ? (
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          {breadcrumbs.map((breadcrumb, index) => (
            <span key={`${breadcrumb.label}-${index}`} className="breadcrumb-segment">
              {breadcrumb.to ? (
                <Link to={breadcrumb.to}>{breadcrumb.label}</Link>
              ) : (
                breadcrumb.label
              )}
            </span>
          ))}
        </nav>
      ) : (
        <span aria-hidden="true" />
      )}
      <nav className="topnav" aria-label="Primary">
        {primaryNav}
      </nav>
      <div className="user-menu">{accountSlot}</div>
    </header>
  );
}

export function TopbarAccountMenu({ label, onSignOut }: { label: string; onSignOut: () => void }) {
  return (
    <details className="account-menu">
      <summary>{label}</summary>
      <div className="account-menu-panel">
        <button type="button" className="text-button" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </details>
  );
}
