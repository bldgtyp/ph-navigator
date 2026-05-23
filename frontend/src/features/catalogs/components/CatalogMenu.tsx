import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useOutsidePointerDown } from "../../../shared/ui/useOutsidePointerDown";
import { CATALOGS, catalogPath } from "../lib";

export function CatalogMenu() {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const [open, setOpen] = useState(false);

  useOutsidePointerDown(detailsRef, open, () => {
    if (detailsRef.current) detailsRef.current.open = false;
    setOpen(false);
  });

  return (
    <details
      ref={detailsRef}
      className="catalog-menu"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
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
