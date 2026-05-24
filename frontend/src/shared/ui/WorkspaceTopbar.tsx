import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useOutsidePointerDown } from "./useOutsidePointerDown";

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
  primaryNav?: ReactNode;
  accountSlot?: ReactNode;
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
      {primaryNav ? (
        <nav className="topnav" aria-label="Primary">
          {primaryNav}
        </nav>
      ) : null}
      {accountSlot ? <div className="user-menu">{accountSlot}</div> : null}
    </header>
  );
}

export function TopbarAccountMenu({ label, onSignOut }: { label: string; onSignOut: () => void }) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const [open, setOpen] = useState(false);

  useOutsidePointerDown(detailsRef, open, () => {
    if (detailsRef.current) detailsRef.current.open = false;
    setOpen(false);
  });

  return (
    <details
      ref={detailsRef}
      className="account-menu"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{label}</summary>
      <div className="account-menu-panel">
        <button type="button" className="text-button" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </details>
  );
}
