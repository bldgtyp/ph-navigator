import "../catalogs.css";
import { type ReactNode, useState } from "react";
import { WorkspaceTopbar, TopbarAccountMenu } from "../../../shared/ui/WorkspaceTopbar";
import { errorMessage } from "../../../shared/lib/errors";
import { useSignOutMutation } from "../../auth/hooks";
import type { AuthSession } from "../../auth/types";
import { CatalogMenu } from "../components/CatalogMenu";
import { GlazingTypeEditorModal } from "../components/GlazingTypeEditorModal";
import { formatNumber } from "../components/form-helpers";
import {
  useDeactivateGlazingTypeMutation,
  useGlazingTypesQuery,
  useReactivateGlazingTypeMutation,
} from "../hooks";
import { catalogPath } from "../lib";
import type { CatalogGlazingType } from "../types";

type EditorState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; record: CatalogGlazingType };

export function GlazingTypesCatalogPage({ session }: { session: AuthSession }) {
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editor, setEditor] = useState<EditorState>({ kind: "closed" });
  const itemsQuery = useGlazingTypesQuery(includeInactive);
  const deactivateMutation = useDeactivateGlazingTypeMutation();
  const reactivateMutation = useReactivateGlazingTypeMutation();
  const signOutMutation = useSignOutMutation();

  const items = itemsQuery.data ?? [];
  const closeEditor = () => setEditor({ kind: "closed" });

  const handleDeactivate = (record: CatalogGlazingType) => {
    if (
      window.confirm(
        `Deactivate "${record.name}"? It will no longer appear in project pickers, ` +
          "but already-picked entries remain unchanged.",
      )
    ) {
      deactivateMutation.mutate(record.id);
    }
  };

  const renderBody = (): ReactNode => {
    if (itemsQuery.isLoading) {
      return <p className="form-note">Loading glazing types…</p>;
    }
    if (itemsQuery.isError) {
      return (
        <p className="form-error" role="alert">
          {errorMessage(itemsQuery.error, "Could not load glazing types.")}
        </p>
      );
    }
    if (items.length === 0) {
      return (
        <section className="empty-state">
          <h2>No glazing types yet</h2>
          <p>Add the first glazing type to seed the project picker.</p>
          <button type="button" onClick={() => setEditor({ kind: "create" })}>
            Add glazing type
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
              <th scope="col">Manufacturer</th>
              <th scope="col">Brand</th>
              <th scope="col">U-value (W/m²·K)</th>
              <th scope="col">g-value</th>
              <th scope="col">Version</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((record) => (
              <tr key={record.id} className={record.is_active ? "" : "catalog-row-inactive"}>
                <td>{record.name}</td>
                <td>{record.manufacturer ?? "—"}</td>
                <td>{record.brand ?? "—"}</td>
                <td>{formatNumber(record.u_value_w_m2k)}</td>
                <td>{formatNumber(record.g_value, 2)}</td>
                <td>
                  {record.version_label} · {record.version_date}
                </td>
                <td>{record.is_active ? "Active" : "Deactivated"}</td>
                <td>
                  <div className="catalog-row-actions">
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setEditor({ kind: "edit", record })}
                      disabled={!record.is_active}
                    >
                      Edit
                    </button>
                    {record.is_active ? (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => handleDeactivate(record)}
                        disabled={deactivateMutation.isPending}
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => reactivateMutation.mutate(record.id)}
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
        breadcrumbs={[
          { label: "Catalogs" },
          { label: "Window-Glazing", to: catalogPath("glazing-types") },
        ]}
        primaryNav={<CatalogMenu />}
        accountSlot={
          <TopbarAccountMenu
            label={session.user.display_name}
            onSignOut={() => signOutMutation.mutate()}
          />
        }
      />
      <section className="dashboard-page" aria-labelledby="glazing-types-catalog-title">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Catalogs</p>
            <h1 id="glazing-types-catalog-title">Window-Glazing</h1>
            <p className="catalog-description">
              Curated starting library of glazing products. Picking a glazing into a project copies
              the values in; later catalog edits surface through refresh-from-catalog.
            </p>
          </div>
          <button type="button" onClick={() => setEditor({ kind: "create" })}>
            Add glazing type
          </button>
        </div>

        <div className="catalog-toolbar">
          <label className="catalog-inactive-toggle">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
            />
            <span>Show deactivated glazing types</span>
          </label>
          <span className="catalog-count">
            {items.length} {items.length === 1 ? "glazing type" : "glazing types"}
          </span>
        </div>

        {renderBody()}

        {editor.kind !== "closed" ? (
          <GlazingTypeEditorModal
            record={editor.kind === "edit" ? editor.record : null}
            onClose={closeEditor}
            onSaved={closeEditor}
          />
        ) : null}
      </section>
    </main>
  );
}
