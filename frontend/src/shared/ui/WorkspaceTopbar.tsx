import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function WorkspaceTopbar({ children }: { children: ReactNode }) {
  return (
    <header className="topbar">
      <Link className="brand" to="/dashboard" aria-label="PH-Navigator dashboard">
        PH-Nav
      </Link>
      <nav className="topnav" aria-label="Primary">
        <a aria-disabled="true">Catalogs</a>
      </nav>
      <div className="user-menu">{children}</div>
    </header>
  );
}
