import { Link } from "react-router-dom";
import { CATALOGS, catalogPath } from "../lib";

export function CatalogMenu() {
  return (
    <details className="catalog-menu">
      <summary>Catalogs</summary>
      <div className="catalog-menu-panel">
        {CATALOGS.map((catalog) => (
          <Link key={catalog.slug} to={catalogPath(catalog.slug)}>
            {catalog.label}
          </Link>
        ))}
      </div>
    </details>
  );
}
