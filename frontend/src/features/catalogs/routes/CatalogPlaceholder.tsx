import { Link, Navigate, useParams } from "react-router-dom";
import { WorkspaceTopbar, TopbarAccountMenu } from "../../../shared/ui/WorkspaceTopbar";
import { useSignOutMutation } from "../../auth/hooks";
import type { AuthSession } from "../../auth/types";
import { CatalogMenu } from "../components/CatalogMenu";
import { CATALOGS, catalogBySlug, catalogPath } from "../lib";

export function CatalogPlaceholder({ session }: { session: AuthSession }) {
  const { catalogSlug } = useParams();
  const catalog = catalogBySlug(catalogSlug);
  const signOutMutation = useSignOutMutation();

  if (!catalog) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <main className="workspace-shell">
      <WorkspaceTopbar
        breadcrumbs={[
          { label: "Catalogs" },
          { label: catalog.label, to: catalogPath(catalog.slug) },
        ]}
        primaryNav={<CatalogMenu />}
        accountSlot={
          <TopbarAccountMenu
            label={session.user.display_name}
            onSignOut={() => signOutMutation.mutate()}
          />
        }
      />
      <section className="dashboard-page" aria-labelledby="catalog-title">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Catalogs</p>
            <h1 id="catalog-title">{catalog.label}</h1>
          </div>
        </div>
        <section className="empty-state catalog-placeholder">
          <h2>Catalog manager pending</h2>
          <p>
            This route is reserved for the shared {catalog.label} catalog. Full catalog editing
            lands with the catalog-table slice.
          </p>
          <div className="catalog-roster" aria-label="Available catalog routes">
            {CATALOGS.map((item) => (
              <Link key={item.slug} className="secondary-button" to={catalogPath(item.slug)}>
                {item.label}
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
