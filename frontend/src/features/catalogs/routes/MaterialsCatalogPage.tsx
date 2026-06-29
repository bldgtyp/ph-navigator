import "../catalogs.css";
import { useCallback, useMemo, useState } from "react";
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
import { MaterialEditorModal } from "../components/MaterialEditorModal";
import { useMaterialsQuery, useReactivateMaterialMutation } from "../hooks";
import { canEditCatalogs, catalogPath } from "../lib";
import type { CatalogMaterial } from "../types";
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
import { ImportDialog } from "../materials/import_export/ImportDialog";
import { CatalogImportExportMenu } from "../materials/import_export/OverflowMenuItems";
import {
  exportFilename,
  serializeCatalog,
  triggerCatalogDownload,
} from "../materials/import_export/export";

type EditorState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; record: CatalogMaterial };

// Optimistic placeholder row used by Shift-Enter on an empty grid. The
// controller's `rowInsert` handler POSTs the row with safe defaults
// (name "New material", category "insulation"); the optimistic row
// disappears on the refetch that follows.
// Module-level frozen empty array so loading-state renders reuse the
// same reference; `materialsQuery.data ?? EMPTY_MATERIALS` is stable
// across renders when data is undefined, keeping the `rows` useMemo
// and DataTable's row identity stable.
const EMPTY_MATERIALS: readonly CatalogMaterial[] = Object.freeze([]);

const PLACEHOLDER_TIMESTAMP = "1970-01-01T00:00:00Z";
function buildEmptyMaterialRow({ rowId }: { rowId: string }): MaterialRow {
  return {
    id: rowId,
    name: "New material",
    category: "opt_insulation",
    density_kg_m3: null,
    specific_heat_j_kgk: null,
    conductivity_w_mk: null,
    emissivity: null,
    color: null,
    source: null,
    url: null,
    comments: null,
    is_active: true,
    created_at: PLACEHOLDER_TIMESTAMP,
    updated_at: PLACEHOLDER_TIMESTAMP,
  };
}

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
  const [importOpen, setImportOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>({ kind: "closed" });
  const [bulkReactivating, setBulkReactivating] = useState(false);
  const materialsQuery = useMaterialsQuery();
  const signOutMutation = useSignOutMutation();
  const reactivateMutation = useReactivateMaterialMutation();
  const canEditCatalog = canEditCatalogs(session);

  // Fetch the full catalog once and filter the "Show deactivated" toggle
  // client-side. Keeps the toggle off the network and lets the row identity
  // stay stable across other re-renders.
  const allMaterials = materialsQuery.data ?? EMPTY_MATERIALS;
  const materials = useMemo(
    () => (includeInactive ? allMaterials : allMaterials.filter((m) => m.is_active)),
    [allMaterials, includeInactive],
  );
  const rows = useMemo<MaterialRow[]>(() => materials.map(toMaterialRow), [materials]);
  const tableSchema = useMemo(
    () =>
      buildTableSchema({
        tableKey: MATERIALS_TABLE_KEY,
        fieldDefs: MATERIALS_BUILT_IN_FIELD_DEFS,
        fieldOverlay: MATERIALS_FIELD_OVERLAY,
      }),
    [],
  );
  const controller = useMaterialsCatalogController({
    userId: session.user.id,
    columns: COLUMN_DEFS,
    fieldDefs: tableSchema.fieldDefs,
    schemaFingerprint: tableSchema.schemaFingerprint,
  });
  const closeEditor = () => setEditor({ kind: "closed" });

  // Map id → is_active for O(1) lookups when the bulk-action renderer
  // walks the live selection set on every selection change.
  const isActiveById = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const material of materials) map.set(material.id, material.is_active);
    return map;
  }, [materials]);

  function handleExport() {
    const file = serializeCatalog(materials, {
      exportedBy: session.user.email,
      appVersion: (import.meta.env.VITE_APP_VERSION ?? null) as string | null,
    });
    triggerCatalogDownload(file, exportFilename());
  }

  const renderBulkSelectionActions = useCallback(
    (selectedRowIds: ReadonlySet<string>) => {
      const inactiveIds: string[] = [];
      for (const id of selectedRowIds) {
        if (isActiveById.get(id) === false) inactiveIds.push(id);
      }
      if (inactiveIds.length === 0) return null;
      const label =
        inactiveIds.length === 1
          ? "Reactivate 1 material"
          : `Reactivate ${inactiveIds.length} materials`;
      return (
        <button
          type="button"
          disabled={bulkReactivating}
          onClick={async () => {
            // Fan out reactivations in parallel and only re-enable the
            // button once every request settles — relying on the shared
            // mutation's isPending would flip back to false as soon as
            // the first response landed. Selection auto-clears when the
            // new rows array identity arrives.
            setBulkReactivating(true);
            try {
              await Promise.allSettled(inactiveIds.map((id) => reactivateMutation.mutateAsync(id)));
            } finally {
              setBulkReactivating(false);
            }
          }}
        >
          {label}
        </button>
      );
    },
    [bulkReactivating, isActiveById, reactivateMutation],
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
      <section className="dashboard-page" aria-label="Materials catalog">
        {canEditCatalog ? (
          <div className="page-heading">
            <button type="button" onClick={() => setEditor({ kind: "create" })}>
              New Material +
            </button>
          </div>
        ) : null}

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
            tableName="Materials"
            rows={rows}
            getRowId={(row) => row.id}
            columnDefs={COLUMN_DEFS}
            fieldDefs={tableSchema.fieldDefs}
            view={controller.view}
            onViewChange={controller.onViewChange}
            onResetView={controller.onResetView}
            readOnly={!canEditCatalog}
            onWrite={controller.onWrite}
            onRowOpen={
              canEditCatalog
                ? (row) => {
                    const record = materials.find((material) => material.id === row.id);
                    if (record) setEditor({ kind: "edit", record });
                  }
                : undefined
            }
            buildEmptyRow={buildEmptyMaterialRow}
            bulkSelectionActions={renderBulkSelectionActions}
            overflowMenuActions={
              <CatalogImportExportMenu
                onExport={handleExport}
                onImport={canEditCatalog ? () => setImportOpen(true) : undefined}
                exportDisabled={materials.length === 0}
              />
            }
            emptyMessage={
              materialsQuery.isLoading
                ? "Loading materials…"
                : canEditCatalog
                  ? "No materials yet. Shift-Enter to add one."
                  : "No materials yet."
            }
          />
        )}
        {/*
          Conditional mount, not an `open` prop: closing the dialog
          tears down its internal state and any in-flight preview /
          commit mutations, so a late-resolving preview cannot
          setState on a hidden dialog and surface a stale report on
          the next open.
        */}
        {canEditCatalog && importOpen ? (
          <ImportDialog onClose={() => setImportOpen(false)} />
        ) : null}
        {editor.kind !== "closed" ? (
          <MaterialEditorModal
            record={editor.kind === "edit" ? editor.record : null}
            onClose={closeEditor}
            onSaved={closeEditor}
          />
        ) : null}
      </section>
    </main>
  );
}
