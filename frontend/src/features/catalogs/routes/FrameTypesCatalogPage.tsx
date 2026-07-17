import "../catalogs.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DataTable,
  addRowButton,
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
import { FrameTypeCreateModal } from "../components/FrameTypeCreateModal";
import { previewCatalogOptionCascade } from "../api";
import {
  buildFrameTypeOptionMaps,
  toFrameTypeRow,
  useFrameTypesCatalogController,
  type FrameTypeRow,
} from "../frame-types/controller";
import {
  buildFrameTypesFieldOverlay,
  FRAME_TYPES_BUILT_IN_FIELD_DEFS,
  FRAME_TYPES_SINGLE_SELECT_FIELDS,
  FRAME_TYPES_TABLE_KEY,
} from "../frame-types/fieldDefs";
import { ImportDialog } from "../frame-types/import_export/ImportDialog";
import { CatalogImportExportMenu } from "../frame-types/import_export/OverflowMenuItems";
import {
  exportFilename,
  serializeCatalog,
  triggerCatalogDownload,
} from "../frame-types/import_export/export";
import {
  useFrameTypeOptionsQuery,
  useFrameTypesQuery,
  useReactivateFrameTypeMutation,
  useUnresolvedCatalogOptionJob,
} from "../hooks";
import { canEditCatalogs, catalogPath } from "../lib";
import { buildCatalogOptionMutation, buildCatalogOptionRenames } from "../legacy-options";
import type { CatalogFrameType, CatalogOptionJob } from "../types";

const EMPTY_FRAME_TYPES: readonly CatalogFrameType[] = Object.freeze([]);
const FRAME_CONFIG_FIELDS = new Set<string>(FRAME_TYPES_SINGLE_SELECT_FIELDS);

const PLACEHOLDER_TIMESTAMP = "1970-01-01T00:00:00Z";
function buildEmptyFrameTypeRow({ rowId }: { rowId: string }): FrameTypeRow {
  return {
    id: rowId,
    // `name` is server-derived; an empty row composes to "" until parts fill in.
    name: "",
    manufacturer: null,
    brand: null,
    use: null,
    operation: null,
    location: null,
    mull_type: null,
    prefix: null,
    suffix: null,
    material: null,
    width_mm: null,
    u_value_w_m2k: null,
    psi_g_w_mk: null,
    psi_install_w_mk: null,
    color: null,
    source: null,
    datasheet_url: null,
    comments: null,
    is_active: true,
    created_at: PLACEHOLDER_TIMESTAMP,
    updated_at: PLACEHOLDER_TIMESTAMP,
  };
}

// Column order follows PRD §Risks: identity → categorization → performance
// → color/source/comments. Rarely-populated columns (prefix, material,
// psi_install_w_mk) keep a narrow default width and may be hidden via the
// view controls once the AirTable seed shows the real fill rate.
const COLUMN_DEFS: DataTableColumnDef<FrameTypeRow>[] = [
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
    defaultWidth: 140,
  },
  { id: "use", fieldKey: "use", header: "Use", accessor: (row) => row.use, defaultWidth: 110 },
  {
    id: "operation",
    fieldKey: "operation",
    header: "Operation",
    accessor: (row) => row.operation,
    defaultWidth: 120,
  },
  {
    id: "location",
    fieldKey: "location",
    header: "Location",
    accessor: (row) => row.location,
    defaultWidth: 110,
  },
  {
    id: "mull_type",
    fieldKey: "mull_type",
    header: "Mull type",
    accessor: (row) => row.mull_type,
    defaultWidth: 110,
  },
  {
    id: "prefix",
    fieldKey: "prefix",
    header: "Prefix",
    accessor: (row) => row.prefix,
    defaultWidth: 100,
  },
  {
    id: "suffix",
    fieldKey: "suffix",
    header: "Suffix",
    accessor: (row) => row.suffix,
    defaultWidth: 100,
  },
  {
    id: "material",
    fieldKey: "material",
    header: "Material",
    accessor: (row) => row.material,
    defaultWidth: 120,
  },
  {
    id: "width_mm",
    fieldKey: "width_mm",
    header: "Width",
    accessor: (row) => row.width_mm,
    className: "numeric-cell",
    defaultWidth: 100,
  },
  {
    id: "u_value_w_m2k",
    fieldKey: "u_value_w_m2k",
    header: "U-value",
    accessor: (row) => row.u_value_w_m2k,
    className: "numeric-cell",
  },
  {
    id: "psi_g_w_mk",
    fieldKey: "psi_g_w_mk",
    header: "Ψ-glazing",
    accessor: (row) => row.psi_g_w_mk,
    className: "numeric-cell",
  },
  {
    id: "psi_install_w_mk",
    fieldKey: "psi_install_w_mk",
    header: "Ψ-install",
    accessor: (row) => row.psi_install_w_mk,
    className: "numeric-cell",
  },
  {
    id: "color",
    fieldKey: "color",
    header: "Color",
    accessor: (row) => row.color,
    defaultWidth: 100,
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

export function FrameTypesCatalogPage({ session }: { session: AuthSession }) {
  const [includeInactive, setIncludeInactive] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  // Row to scroll-and-highlight after a modal create lands in the table.
  const [focusRowId, setFocusRowId] = useState<string | null>(null);
  const [bulkReactivating, setBulkReactivating] = useState(false);
  const [cascadeJobId, setCascadeJobId] = useState<string | null>(null);
  const frameTypesQuery = useFrameTypesQuery();
  const optionsQuery = useFrameTypeOptionsQuery();
  const signOutMutation = useSignOutMutation();
  const reactivateMutation = useReactivateFrameTypeMutation();
  const canEditCatalog = canEditCatalogs(session);
  const unresolvedCascadeQuery = useUnresolvedCatalogOptionJob("frame_types", canEditCatalog);

  useEffect(() => {
    const unresolvedJob = unresolvedCascadeQuery.data;
    if (unresolvedJob) setCascadeJobId((current) => current ?? unresolvedJob.id);
  }, [unresolvedCascadeQuery.data]);

  const optionsByField = useMemo(() => optionsQuery.data ?? {}, [optionsQuery.data]);
  const optionMaps = useMemo(() => buildFrameTypeOptionMaps(optionsByField), [optionsByField]);

  function handleExport() {
    const file = serializeCatalog(frameTypes, {
      exportedBy: session.user.email,
      appVersion: (import.meta.env.VITE_APP_VERSION ?? null) as string | null,
    });
    triggerCatalogDownload(file, exportFilename());
  }

  const allFrameTypes = frameTypesQuery.data ?? EMPTY_FRAME_TYPES;
  const frameTypes = useMemo(
    () => (includeInactive ? allFrameTypes : allFrameTypes.filter((f) => f.is_active)),
    [allFrameTypes, includeInactive],
  );
  const rows = useMemo<FrameTypeRow[]>(
    () => frameTypes.map((frame) => toFrameTypeRow(frame, optionMaps)),
    [frameTypes, optionMaps],
  );
  const tableSchema = useMemo(
    () =>
      buildTableSchema({
        tableKey: FRAME_TYPES_TABLE_KEY,
        fieldDefs: FRAME_TYPES_BUILT_IN_FIELD_DEFS,
        fieldOverlay: buildFrameTypesFieldOverlay(optionsByField),
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
        FRAME_CONFIG_FIELDS,
      );
      const operations = buildCatalogOptionRenames(mutation);
      if (operations.length === 0) return null;
      const fieldKey = mutation.after.field_key;
      const preview = await previewCatalogOptionCascade({
        catalog_table: "frame_types",
        field_key: fieldKey,
        operations,
      });
      const labels = new Set(operations.map((operation) => operation.old_label));
      const catalogRowCount = allFrameTypes.filter(
        (frame) =>
          frame.is_active && labels.has(frame[fieldKey as keyof CatalogFrameType] as string),
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
    [allFrameTypes, tableSchema.fieldDefs],
  );
  const onCascadeJobCreated = useCallback((job: CatalogOptionJob) => setCascadeJobId(job.id), []);
  const controller = useFrameTypesCatalogController({
    userId: session.user.id,
    columns: COLUMN_DEFS,
    fieldDefs: tableSchema.fieldDefs,
    schemaFingerprint: tableSchema.schemaFingerprint,
    optionsByField,
    onCascadeJobCreated,
  });

  const isActiveById = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const frame of frameTypes) map.set(frame.id, frame.is_active);
    return map;
  }, [frameTypes]);

  const renderBulkSelectionActions = useCallback(
    (selectedRowIds: ReadonlySet<string>) => {
      const inactiveIds: string[] = [];
      for (const id of selectedRowIds) {
        if (isActiveById.get(id) === false) inactiveIds.push(id);
      }
      if (inactiveIds.length === 0) return null;
      const label =
        inactiveIds.length === 1
          ? "Reactivate 1 frame type"
          : `Reactivate ${inactiveIds.length} frame types`;
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
      <section className="dashboard-page" aria-label="Window-Frame Elements catalog">
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
            {rows.length} {rows.length === 1 ? "frame type" : "frame types"}
          </span>
        </div>

        {frameTypesQuery.isError ? (
          <p className="form-error" role="alert">
            {errorMessage(frameTypesQuery.error, "Could not load frame types.")}
          </p>
        ) : (
          <DataTable<FrameTypeRow>
            tableName="Frame Types"
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
            canEditFieldConfig={(fieldKey) => FRAME_CONFIG_FIELDS.has(fieldKey)}
            buildEmptyRow={buildEmptyFrameTypeRow}
            focusRowId={focusRowId}
            // The footer "+" opens the create modal instead of silently
            // appending a blank row (the Shift-Enter grid path remains).
            footerAction={addRowButton("Add frame type", canEditCatalog, () => setCreateOpen(true))}
            bulkSelectionActions={renderBulkSelectionActions}
            overflowMenuActions={
              <CatalogImportExportMenu
                onExport={handleExport}
                onImport={canEditCatalog ? () => setImportOpen(true) : undefined}
                exportDisabled={frameTypes.length === 0}
              />
            }
            emptyMessage={
              frameTypesQuery.isLoading
                ? "Loading frame types…"
                : canEditCatalog
                  ? "No frame types yet. Shift-Enter to add one."
                  : "No frame types yet."
            }
          />
        )}
        {/* Conditional mount: closing tears down internal state and any
            in-flight preview/commit mutations so a late preview cannot
            setState on a hidden dialog. */}
        {canEditCatalog && importOpen ? (
          <ImportDialog onClose={() => setImportOpen(false)} />
        ) : null}
        {canEditCatalog && createOpen ? (
          <FrameTypeCreateModal
            optionsByField={optionsByField}
            onClose={() => setCreateOpen(false)}
            onCreated={(created) => {
              setCreateOpen(false);
              setFocusRowId(created.id);
            }}
          />
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
