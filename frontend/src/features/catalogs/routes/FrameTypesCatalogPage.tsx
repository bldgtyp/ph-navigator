import "../catalogs.css";
import { type ReactNode, useState } from "react";
import {
  formatLengthFromMm,
  formatLinearPsiFromWmK,
  formatUValueFromWm2K,
  useUnitPreference,
} from "../../../lib/units";
import { WorkspaceTopbar, TopbarAccountMenu } from "../../../shared/ui/WorkspaceTopbar";
import { errorMessage } from "../../../shared/lib/errors";
import { useSignOutMutation } from "../../auth/hooks";
import type { AuthSession } from "../../auth/types";
import { CatalogMenu } from "../components/CatalogMenu";
import { FrameTypeEditorModal } from "../components/FrameTypeEditorModal";
import { lengthUnitLabel, psiUnitLabel, uValueUnitLabel } from "../components/unit-labels";
import {
  useDeactivateFrameTypeMutation,
  useFrameTypesQuery,
  useReactivateFrameTypeMutation,
} from "../hooks";
import { catalogPath } from "../lib";
import type { CatalogFrameType } from "../types";

type EditorState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; record: CatalogFrameType };

export function FrameTypesCatalogPage({ session }: { session: AuthSession }) {
  const { unitSystem } = useUnitPreference();
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editor, setEditor] = useState<EditorState>({ kind: "closed" });
  const itemsQuery = useFrameTypesQuery();
  const deactivateMutation = useDeactivateFrameTypeMutation();
  const reactivateMutation = useReactivateFrameTypeMutation();
  const signOutMutation = useSignOutMutation();

  // Fetch the full catalog once; filter the "Show deactivated" toggle in
  // memory rather than refetching with a different query param.
  const allItems = itemsQuery.data ?? [];
  const items = includeInactive ? allItems : allItems.filter((record) => record.is_active);
  const closeEditor = () => setEditor({ kind: "closed" });

  const handleDeactivate = (record: CatalogFrameType) => {
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
      return <p className="form-note">Loading frame types…</p>;
    }
    if (itemsQuery.isError) {
      return (
        <p className="form-error" role="alert">
          {errorMessage(itemsQuery.error, "Could not load frame types.")}
        </p>
      );
    }
    if (items.length === 0) {
      return (
        <section className="empty-state">
          <h2>No frame types yet</h2>
          <p>Add the first frame type to seed the project picker.</p>
          <button type="button" onClick={() => setEditor({ kind: "create" })}>
            Add frame type
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
              <th scope="col">Width ({lengthUnitLabel(unitSystem)})</th>
              <th scope="col">U-value ({uValueUnitLabel(unitSystem)})</th>
              <th scope="col">Ψ-glazing ({psiUnitLabel(unitSystem)})</th>
              <th scope="col">Ψ-install ({psiUnitLabel(unitSystem)})</th>
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
                <td>{formatLengthFromMm(record.width_mm, { unitSystem, showUnit: false })}</td>
                <td>
                  {formatUValueFromWm2K(record.u_value_w_m2k, { unitSystem, showUnit: false })}
                </td>
                <td>
                  {formatLinearPsiFromWmK(record.psi_g_w_mk, { unitSystem, showUnit: false })}
                </td>
                <td>
                  {formatLinearPsiFromWmK(record.psi_install_w_mk, {
                    unitSystem,
                    showUnit: false,
                  })}
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
          { label: "Window-Frame Elements", to: catalogPath("frame-types") },
        ]}
        primaryNav={<CatalogMenu />}
        accountSlot={
          <TopbarAccountMenu
            label={session.user.display_name}
            onSignOut={() => signOutMutation.mutate()}
          />
        }
      />
      <section className="dashboard-page" aria-labelledby="frame-types-catalog-title">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Catalogs</p>
            <h1 id="frame-types-catalog-title">Window-Frame Elements</h1>
            <p className="catalog-description">
              Curated starting library of window-frame products. Picking a frame into a project
              copies the values in; later catalog edits surface through refresh-from-catalog.
            </p>
          </div>
          <button type="button" onClick={() => setEditor({ kind: "create" })}>
            Add frame type
          </button>
        </div>

        <div className="catalog-toolbar">
          <label className="catalog-inactive-toggle">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
            />
            <span>Show deactivated frame types</span>
          </label>
          <span className="catalog-count">
            {items.length} {items.length === 1 ? "frame type" : "frame types"}
          </span>
        </div>

        {renderBody()}

        {editor.kind !== "closed" ? (
          <FrameTypeEditorModal
            record={editor.kind === "edit" ? editor.record : null}
            onClose={closeEditor}
            onSaved={closeEditor}
          />
        ) : null}
      </section>
    </main>
  );
}
