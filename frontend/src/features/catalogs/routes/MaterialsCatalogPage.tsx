import "../catalogs.css";
import { useMemo, useState } from "react";
import {
  DataTable,
  buildTableSchema,
  type DataTableColumnDef,
} from "../../../shared/ui/data-table";
import { WorkspaceTopbar, TopbarAccountMenu } from "../../../shared/ui/WorkspaceTopbar";
import { errorMessage } from "../../../shared/lib/errors";
import { useSignOutMutation } from "../../auth/hooks";
import type { AuthSession } from "../../auth/types";
import { CatalogMenu } from "../components/CatalogMenu";
import { useMaterialsQuery } from "../hooks";
import { catalogPath } from "../lib";
import {
  toMaterialRow,
  useMaterialsCatalogController,
  type MaterialRow,
} from "../materials/controller";
import {
  MATERIALS_BUILT_IN_FIELD_DEFS,
  MATERIALS_FIELD_OVERLAY,
  MATERIALS_TABLE_KEY,
} from "../materials/fieldDefs";

const COLUMN_DEFS: DataTableColumnDef<MaterialRow>[] = [
  { id: "name", fieldKey: "name", header: "Name", accessor: (row) => row.name, defaultWidth: 240 },
  {
    id: "category",
    fieldKey: "category",
    header: "Category",
    accessor: (row) => row.category,
    defaultWidth: 200,
  },
  {
    id: "density_kg_m3",
    fieldKey: "density_kg_m3",
    header: "Density",
    accessor: (row) => row.density_kg_m3,
    className: "numeric-cell",
  },
  {
    id: "specific_heat_j_kgk",
    fieldKey: "specific_heat_j_kgk",
    header: "Specific Heat",
    accessor: (row) => row.specific_heat_j_kgk,
    className: "numeric-cell",
  },
  {
    id: "conductivity_w_mk",
    fieldKey: "conductivity_w_mk",
    header: "Conductivity",
    accessor: (row) => row.conductivity_w_mk,
    className: "numeric-cell",
  },
  {
    id: "emissivity",
    fieldKey: "emissivity",
    header: "Emissivity",
    accessor: (row) => row.emissivity,
    className: "numeric-cell",
    defaultWidth: 110,
  },
  {
    id: "color",
    fieldKey: "color",
    header: "Color",
    accessor: (row) => row.color,
    defaultWidth: 110,
  },
  {
    id: "source",
    fieldKey: "source",
    header: "Source",
    accessor: (row) => row.source,
    defaultWidth: 220,
  },
  { id: "url", fieldKey: "url", header: "URL", accessor: (row) => row.url, defaultWidth: 240 },
  {
    id: "comments",
    fieldKey: "comments",
    header: "Comments",
    accessor: (row) => row.comments,
    defaultWidth: 280,
  },
];

export function MaterialsCatalogPage({ session }: { session: AuthSession }) {
  const [includeInactive, setIncludeInactive] = useState(false);
  const materialsQuery = useMaterialsQuery(includeInactive);
  const signOutMutation = useSignOutMutation();

  const rows = useMemo<MaterialRow[]>(
    () => (materialsQuery.data ?? []).map(toMaterialRow),
    [materialsQuery.data],
  );
  const controller = useMaterialsCatalogController();

  const tableSchema = useMemo(
    () =>
      buildTableSchema({
        tableKey: MATERIALS_TABLE_KEY,
        fieldDefs: MATERIALS_BUILT_IN_FIELD_DEFS,
        fieldOverlay: MATERIALS_FIELD_OVERLAY,
      }),
    [],
  );

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
            {rows.length} {rows.length === 1 ? "material" : "materials"}
          </span>
        </div>

        {materialsQuery.isError ? (
          <p className="form-error" role="alert">
            {errorMessage(materialsQuery.error, "Could not load materials.")}
          </p>
        ) : (
          <DataTable<MaterialRow>
            rows={rows}
            getRowId={(row) => row.id}
            columnDefs={COLUMN_DEFS}
            fieldDefs={tableSchema.fieldDefs}
            view={controller.view}
            onViewChange={controller.onViewChange}
            onResetView={controller.onResetView}
            onWrite={controller.onWrite}
            emptyMessage={
              materialsQuery.isLoading
                ? "Loading materials…"
                : "No materials yet. Shift-Enter to add one."
            }
          />
        )}
      </section>
    </main>
  );
}
