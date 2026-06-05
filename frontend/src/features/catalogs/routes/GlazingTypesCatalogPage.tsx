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
import {
  toGlazingTypeRow,
  useGlazingTypesCatalogController,
  type GlazingTypeRow,
} from "../glazing-types/controller";
import {
  GLAZING_TYPES_BUILT_IN_FIELD_DEFS,
  GLAZING_TYPES_FIELD_OVERLAY,
  GLAZING_TYPES_TABLE_KEY,
} from "../glazing-types/fieldDefs";
import { ImportDialog } from "../glazing-types/import_export/ImportDialog";
import { CatalogImportExportMenu } from "../glazing-types/import_export/OverflowMenuItems";
import {
  exportFilename,
  serializeCatalog,
  triggerCatalogDownload,
} from "../glazing-types/import_export/export";
import { useGlazingTypesQuery, useReactivateGlazingTypeMutation } from "../hooks";
import { catalogPath } from "../lib";
import type { CatalogGlazingType } from "../types";

const EMPTY_GLAZING_TYPES: readonly CatalogGlazingType[] = Object.freeze([]);

const PLACEHOLDER_TIMESTAMP = "1970-01-01T00:00:00Z";
function buildEmptyGlazingTypeRow({ rowId }: { rowId: string }): GlazingTypeRow {
  return {
    id: rowId,
    name: "New glazing type",
    manufacturer: null,
    brand: null,
    suffix: null,
    u_value_w_m2k: null,
    g_value: null,
    color: null,
    source: null,
    comments: null,
    is_active: true,
    created_at: PLACEHOLDER_TIMESTAMP,
    updated_at: PLACEHOLDER_TIMESTAMP,
  };
}

const COLUMN_DEFS: DataTableColumnDef<GlazingTypeRow>[] = [
  { id: "name", fieldKey: "name", header: "Name", accessor: (row) => row.name, defaultWidth: 280 },
  {
    id: "manufacturer",
    fieldKey: "manufacturer",
    header: "Manufacturer",
    accessor: (row) => row.manufacturer,
    defaultWidth: 160,
  },
  {
    id: "brand",
    fieldKey: "brand",
    header: "Brand",
    accessor: (row) => row.brand,
    defaultWidth: 260,
  },
  {
    id: "suffix",
    fieldKey: "suffix",
    header: "Suffix",
    accessor: (row) => row.suffix,
    defaultWidth: 110,
  },
  {
    id: "u_value_w_m2k",
    fieldKey: "u_value_w_m2k",
    header: "U-value",
    accessor: (row) => row.u_value_w_m2k,
    className: "numeric-cell",
  },
  {
    id: "g_value",
    fieldKey: "g_value",
    header: "g-value",
    accessor: (row) => row.g_value,
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
    defaultWidth: 200,
  },
  {
    id: "comments",
    fieldKey: "comments",
    header: "Comments",
    accessor: (row) => row.comments,
    defaultWidth: 280,
  },
];

export function GlazingTypesCatalogPage({ session }: { session: AuthSession }) {
  const [includeInactive, setIncludeInactive] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [bulkReactivating, setBulkReactivating] = useState(false);
  const glazingTypesQuery = useGlazingTypesQuery();
  const signOutMutation = useSignOutMutation();
  const reactivateMutation = useReactivateGlazingTypeMutation();

  function handleExport() {
    const file = serializeCatalog(glazingTypes, {
      exportedBy: session.user.email,
      appVersion: (import.meta.env.VITE_APP_VERSION ?? null) as string | null,
    });
    triggerCatalogDownload(file, exportFilename());
  }

  const allGlazingTypes = glazingTypesQuery.data ?? EMPTY_GLAZING_TYPES;
  const glazingTypes = useMemo(
    () => (includeInactive ? allGlazingTypes : allGlazingTypes.filter((g) => g.is_active)),
    [allGlazingTypes, includeInactive],
  );
  const rows = useMemo<GlazingTypeRow[]>(() => glazingTypes.map(toGlazingTypeRow), [glazingTypes]);
  const tableSchema = useMemo(
    () =>
      buildTableSchema({
        tableKey: GLAZING_TYPES_TABLE_KEY,
        fieldDefs: GLAZING_TYPES_BUILT_IN_FIELD_DEFS,
        fieldOverlay: GLAZING_TYPES_FIELD_OVERLAY,
      }),
    [],
  );
  const controller = useGlazingTypesCatalogController({
    userId: session.user.id,
    columns: COLUMN_DEFS,
    fieldDefs: tableSchema.fieldDefs,
    schemaFingerprint: tableSchema.schemaFingerprint,
  });

  const isActiveById = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const glazing of glazingTypes) map.set(glazing.id, glazing.is_active);
    return map;
  }, [glazingTypes]);

  const renderBulkSelectionActions = useCallback(
    (selectedRowIds: ReadonlySet<string>) => {
      const inactiveIds: string[] = [];
      for (const id of selectedRowIds) {
        if (isActiveById.get(id) === false) inactiveIds.push(id);
      }
      if (inactiveIds.length === 0) return null;
      const label =
        inactiveIds.length === 1
          ? "Reactivate 1 glazing type"
          : `Reactivate ${inactiveIds.length} glazing types`;
      return (
        <button
          type="button"
          disabled={bulkReactivating}
          onClick={async () => {
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
      <section className="dashboard-page" aria-label="Window-Glazing catalog">
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
            {rows.length} {rows.length === 1 ? "glazing type" : "glazing types"}
          </span>
        </div>

        {glazingTypesQuery.isError ? (
          <p className="form-error" role="alert">
            {errorMessage(glazingTypesQuery.error, "Could not load glazing types.")}
          </p>
        ) : (
          <DataTable<GlazingTypeRow>
            rows={rows}
            getRowId={(row) => row.id}
            columnDefs={COLUMN_DEFS}
            fieldDefs={tableSchema.fieldDefs}
            view={controller.view}
            onViewChange={controller.onViewChange}
            onResetView={controller.onResetView}
            onWrite={controller.onWrite}
            buildEmptyRow={buildEmptyGlazingTypeRow}
            bulkSelectionActions={renderBulkSelectionActions}
            overflowMenuActions={
              <CatalogImportExportMenu
                onExport={handleExport}
                onImport={() => setImportOpen(true)}
                exportDisabled={glazingTypes.length === 0}
              />
            }
            emptyMessage={
              glazingTypesQuery.isLoading
                ? "Loading glazing types…"
                : "No glazing types yet. Shift-Enter to add one."
            }
          />
        )}
        {/* Conditional mount: closing tears down internal state and any
            in-flight preview/commit mutations so a late preview cannot
            setState on a hidden dialog. */}
        {importOpen ? <ImportDialog onClose={() => setImportOpen(false)} /> : null}
      </section>
    </main>
  );
}
