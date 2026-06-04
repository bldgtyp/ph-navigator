import { useRef, useState, type ReactNode } from "react";
import { CircleUserRound, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { TopbarUnitToggle } from "./TopbarUnitToggle";
import { useOutsidePointerDown } from "./useOutsidePointerDown";

type Breadcrumb = {
  label: string;
  to?: string;
};

export function WorkspaceTopbar({
  breadcrumbs = [],
  pathControls,
  primaryNav,
  documentControls,
  accountSlot,
}: {
  breadcrumbs?: Breadcrumb[];
  pathControls?: ReactNode;
  primaryNav?: ReactNode;
  documentControls?: ReactNode;
  accountSlot?: ReactNode;
}) {
  return (
    <header className="topbar">
      <Link className="brand" to="/dashboard" aria-label="PH-Navigator dashboard">
        PH-NAV
      </Link>
      <div className="topbar-path">
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
        ) : null}
        {pathControls}
      </div>
      {documentControls ? (
        <div className="topbar-document-controls" aria-label="Project controls">
          {documentControls}
        </div>
      ) : null}
      <div className="topbar-global-actions">
        {primaryNav ? (
          <nav className="topnav" aria-label="Primary">
            {primaryNav}
          </nav>
        ) : null}
        <TopbarUnitToggle />
        {accountSlot ? <div className="user-menu">{accountSlot}</div> : null}
      </div>
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
      <summary aria-label={`Account: ${label}`} title={label}>
        <CircleUserRound aria-hidden="true" size={18} strokeWidth={1.8} />
      </summary>
      <div className="account-menu-panel">
        <p className="account-menu-label">{label}</p>
        <button type="button" className="text-button" onClick={onSignOut}>
          <LogOut aria-hidden="true" size={14} strokeWidth={1.8} />
          Sign out
        </button>
      </div>
    </details>
  );
}
