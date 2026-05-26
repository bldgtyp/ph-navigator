import "../catalogs.css";
import { type ReactNode, useState } from "react";
import { WorkspaceTopbar, TopbarAccountMenu } from "../../../shared/ui/WorkspaceTopbar";
import { errorMessage } from "../../../shared/lib/errors";
import { useSignOutMutation } from "../../auth/hooks";
import type { AuthSession } from "../../auth/types";
import { CatalogMenu } from "../components/CatalogMenu";
import { formatNumber } from "../components/form-helpers";
import { MaterialEditorModal } from "../components/MaterialEditorModal";
import {
  useDeactivateMaterialMutation,
  useMaterialsQuery,
  useReactivateMaterialMutation,
} from "../hooks";
import { catalogPath } from "../lib";
import type { CatalogMaterial } from "../types";

type EditorState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; material: CatalogMaterial };

export function MaterialsCatalogPage({ session }: { session: AuthSession }) {
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editor, setEditor] = useState<EditorState>({ kind: "closed" });
  const materialsQuery = useMaterialsQuery(includeInactive);
  const deactivateMutation = useDeactivateMaterialMutation();
  const reactivateMutation = useReactivateMaterialMutation();
  const signOutMutation = useSignOutMutation();

  const items = materialsQuery.data ?? [];
  const closeEditor = () => setEditor({ kind: "closed" });

  const handleDeactivate = (material: CatalogMaterial) => {
    if (
      window.confirm(
        `Deactivate "${material.name}"? It will no longer appear in project pickers, ` +
          "but already-picked entries remain unchanged.",
      )
    ) {
      deactivateMutation.mutate(material.id);
    }
  };

  const renderBody = (): ReactNode => {
    if (materialsQuery.isLoading) {
      return <p className="form-note">Loading materials…</p>;
    }
    if (materialsQuery.isError) {
      return (
        <p className="form-error" role="alert">
          {errorMessage(materialsQuery.error, "Could not load materials.")}
        </p>
      );
    }
    if (items.length === 0) {
      return (
        <section className="empty-state">
          <h2>No materials yet</h2>
          <p>Add the first material to seed the project picker.</p>
          <button type="button" onClick={() => setEditor({ kind: "create" })}>
            Add material
          </button>
        </section>
      );
    }
    return (
      <div className="catalog-table-wrapper">
        <table className="catalog-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Category</th>
              <th scope="col">Conductivity (W/m·K)</th>
              <th scope="col">Density (kg/m³)</th>
              <th scope="col">Specific heat (J/kg·K)</th>
              <th scope="col">Emissivity</th>
              <th scope="col">Version</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((material) => (
              <tr key={material.id} className={material.is_active ? "" : "catalog-row-inactive"}>
                <td>{material.name}</td>
                <td>{material.category}</td>
                <td>{formatNumber(material.conductivity_w_mk)}</td>
                <td>{formatNumber(material.density_kg_m3, 1)}</td>
                <td>{formatNumber(material.specific_heat_j_kgk, 0)}</td>
                <td>{formatNumber(material.emissivity, 2)}</td>
                <td>
                  {material.version_label} · {material.version_date}
                </td>
                <td>{material.is_active ? "Active" : "Deactivated"}</td>
                <td>
                  <div className="catalog-row-actions">
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setEditor({ kind: "edit", material })}
                      disabled={!material.is_active}
                    >
                      Edit
                    </button>
                    {material.is_active ? (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => handleDeactivate(material)}
                        disabled={deactivateMutation.isPending}
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => reactivateMutation.mutate(material.id)}
                        disabled={reactivateMutation.isPending}
                      >
                        Reactivate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <main className="workspace-shell">
      <WorkspaceTopbar
        breadcrumbs={[{ label: "Catalogs" }, { label: "Materials", to: catalogPath("materials") }]}
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
            <h1 id="catalog-title">Materials</h1>
            <p className="catalog-description">
              Curated starting library. Picking a material into a project copies the values in;
              later catalog edits surface through refresh-from-catalog.
            </p>
          </div>
          <button type="button" onClick={() => setEditor({ kind: "create" })}>
            Add material
          </button>
        </div>

        <div className="catalog-toolbar">
          <label className="catalog-inactive-toggle">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
            />
            <span>Show deactivated materials</span>
          </label>
          <span className="catalog-count">
            {items.length} {items.length === 1 ? "material" : "materials"}
          </span>
        </div>

        {renderBody()}

        {editor.kind !== "closed" ? (
          <MaterialEditorModal
            material={editor.kind === "edit" ? editor.material : null}
            onClose={closeEditor}
            onSaved={closeEditor}
          />
        ) : null}
      </section>
    </main>
  );
}
