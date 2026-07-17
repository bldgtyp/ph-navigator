import "../catalogs.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DataTable,
  buildTableSchema,
  type DataTableColumnDef,
  type EditCustomFieldBundleConfirmation,
  type EditCustomFieldBundleRequest,
} from "../../../shared/ui/data-table";
import { WorkspaceTopbar, TopbarAccountMenu } from "../../../shared/ui/WorkspaceTopbar";
import { errorMessage } from "../../../shared/lib/errors";
import { useSignOutMutation } from "../../auth/hooks";
import type { AuthSession } from "../../auth/types";
import { CatalogMenu } from "../components/CatalogMenu";
import { CatalogOptionCascadeProgressModal } from "../components/CatalogOptionCascadeModal";
import { previewCatalogOptionCascade } from "../api";
import {
  buildGlazingTypeOptionMaps,
  toGlazingTypeRow,
  useGlazingTypesCatalogController,
  type GlazingTypeRow,
} from "../glazing-types/controller";
import {
  buildGlazingTypesFieldOverlay,
  GLAZING_TYPES_BUILT_IN_FIELD_DEFS,
  GLAZING_TYPES_SINGLE_SELECT_FIELDS,
  GLAZING_TYPES_TABLE_KEY,
} from "../glazing-types/fieldDefs";
import { ImportDialog } from "../glazing-types/import_export/ImportDialog";
import { CatalogImportExportMenu } from "../glazing-types/import_export/OverflowMenuItems";
import {
  exportFilename,
  serializeCatalog,
  triggerCatalogDownload,
} from "../glazing-types/import_export/export";
import {
  useGlazingTypeOptionsQuery,
  useGlazingTypesQuery,
  useReactivateGlazingTypeMutation,
  useUnresolvedCatalogOptionJob,
} from "../hooks";
import { canEditCatalogs, catalogPath } from "../lib";
import { buildCatalogOptionMutation, buildCatalogOptionRenames } from "../legacy-options";
import type { CatalogGlazingType, CatalogOptionJob } from "../types";

const EMPTY_GLAZING_TYPES: readonly CatalogGlazingType[] = Object.freeze([]);
const GLAZING_CONFIG_FIELDS = new Set<string>(GLAZING_TYPES_SINGLE_SELECT_FIELDS);

const PLACEHOLDER_TIMESTAMP = "1970-01-01T00:00:00Z";
function buildEmptyGlazingTypeRow({ rowId }: { rowId: string }): GlazingTypeRow {
  return {
    id: rowId,
    // `name` is server-derived; an empty row composes to "" until parts fill in.
    name: "",
    manufacturer: null,
    brand: null,
    suffix: null,
    u_value_w_m2k: null,
    g_value: null,
    color: null,
    source: null,
    datasheet_url: null,
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
  const [cascadeJobId, setCascadeJobId] = useState<string | null>(null);
  const glazingTypesQuery = useGlazingTypesQuery();
  const optionsQuery = useGlazingTypeOptionsQuery();
  const signOutMutation = useSignOutMutation();
  const reactivateMutation = useReactivateGlazingTypeMutation();
  const canEditCatalog = canEditCatalogs(session);
  const unresolvedCascadeQuery = useUnresolvedCatalogOptionJob("glazing_types", canEditCatalog);

  useEffect(() => {
    const unresolvedJob = unresolvedCascadeQuery.data;
    if (unresolvedJob) setCascadeJobId((current) => current ?? unresolvedJob.id);
  }, [unresolvedCascadeQuery.data]);

  const optionsByField = useMemo(() => optionsQuery.data ?? {}, [optionsQuery.data]);
  const optionMaps = useMemo(() => buildGlazingTypeOptionMaps(optionsByField), [optionsByField]);

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
  const rows = useMemo<GlazingTypeRow[]>(
    () => glazingTypes.map((glazing) => toGlazingTypeRow(glazing, optionMaps)),
    [glazingTypes, optionMaps],
  );
  const tableSchema = useMemo(
    () =>
      buildTableSchema({
        tableKey: GLAZING_TYPES_TABLE_KEY,
        fieldDefs: GLAZING_TYPES_BUILT_IN_FIELD_DEFS,
        fieldOverlay: buildGlazingTypesFieldOverlay(optionsByField),
      }),
    [optionsByField],
  );
  const prepareOptionCascadeConfirmation = useCallback(
    async (
      request: EditCustomFieldBundleRequest,
    ): Promise<EditCustomFieldBundleConfirmation | null> => {
      const mutation = buildCatalogOptionMutation(
        request,
        tableSchema.fieldDefs,
        GLAZING_CONFIG_FIELDS,
      );
      const operations = buildCatalogOptionRenames(mutation);
      if (operations.length === 0) return null;
      const fieldKey = mutation.after.field_key;
      const preview = await previewCatalogOptionCascade({
        catalog_table: "glazing_types",
        field_key: fieldKey,
        operations,
      });
      const labels = new Set(operations.map((operation) => operation.old_label));
      const catalogRowCount = allGlazingTypes.filter(
        (glazing) =>
          glazing.is_active && labels.has(glazing[fieldKey as keyof CatalogGlazingType] as string),
      ).length;
      const optionLabel = operations.length === 1 ? "option" : "options";
      const catalogLabel = catalogRowCount === 1 ? "catalog row" : "catalog rows";
      const projectLabel = preview.project_count === 1 ? "project" : "projects";
      return {
        title: `Rename ${operations.length} ${optionLabel}?`,
        message: `This updates ${catalogRowCount} ${catalogLabel} and rewrites references in ${preview.project_count} ${projectLabel}. The catalog stays locked until the project cascade finishes.`,
        detail: `Field: ${fieldKey}`,
        confirmLabel: "Rename and update projects",
      };
    },
    [allGlazingTypes, tableSchema.fieldDefs],
  );
  const onCascadeJobCreated = useCallback((job: CatalogOptionJob) => setCascadeJobId(job.id), []);
  const controller = useGlazingTypesCatalogController({
    userId: session.user.id,
    columns: COLUMN_DEFS,
    fieldDefs: tableSchema.fieldDefs,
    schemaFingerprint: tableSchema.schemaFingerprint,
    optionsByField,
    onCascadeJobCreated,
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
            tableName="Glazing Types"
            rows={rows}
            getRowId={(row) => row.id}
            columnDefs={COLUMN_DEFS}
            fieldDefs={tableSchema.fieldDefs}
            view={controller.view}
            onViewChange={controller.onViewChange}
            onResetView={controller.onResetView}
            readOnly={!canEditCatalog}
            onWrite={controller.onWrite}
            onEditCustomFieldBundle={controller.onEditCustomFieldBundle}
            prepareEditCustomFieldBundleConfirmation={prepareOptionCascadeConfirmation}
            canEditFieldConfig={(fieldKey) => GLAZING_CONFIG_FIELDS.has(fieldKey)}
            buildEmptyRow={buildEmptyGlazingTypeRow}
            bulkSelectionActions={renderBulkSelectionActions}
            overflowMenuActions={
              <CatalogImportExportMenu
                onExport={handleExport}
                onImport={canEditCatalog ? () => setImportOpen(true) : undefined}
                exportDisabled={glazingTypes.length === 0}
              />
            }
            emptyMessage={
              glazingTypesQuery.isLoading
                ? "Loading glazing types…"
                : canEditCatalog
                  ? "No glazing types yet. Shift-Enter to add one."
                  : "No glazing types yet."
            }
          />
        )}
        {/* Conditional mount: closing tears down internal state and any
            in-flight preview/commit mutations so a late preview cannot
            setState on a hidden dialog. */}
        {canEditCatalog && importOpen ? (
          <ImportDialog onClose={() => setImportOpen(false)} />
        ) : null}
        {cascadeJobId ? (
          <CatalogOptionCascadeProgressModal
            jobId={cascadeJobId}
            onClose={() => setCascadeJobId(null)}
          />
        ) : null}
      </section>
    </main>
  );
}
