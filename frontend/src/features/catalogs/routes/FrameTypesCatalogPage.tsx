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
  toFrameTypeRow,
  useFrameTypesCatalogController,
  type FrameTypeRow,
} from "../frame-types/controller";
import {
  FRAME_TYPES_BUILT_IN_FIELD_DEFS,
  FRAME_TYPES_FIELD_OVERLAY,
  FRAME_TYPES_TABLE_KEY,
} from "../frame-types/fieldDefs";
import { useFrameTypesQuery, useReactivateFrameTypeMutation } from "../hooks";
import { catalogPath } from "../lib";
import type { CatalogFrameType } from "../types";

const EMPTY_FRAME_TYPES: readonly CatalogFrameType[] = Object.freeze([]);

const PLACEHOLDER_TIMESTAMP = "1970-01-01T00:00:00Z";
function buildEmptyFrameTypeRow({ rowId }: { rowId: string }): FrameTypeRow {
  return {
    id: rowId,
    name: "New frame type",
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
  const [bulkReactivating, setBulkReactivating] = useState(false);
  const frameTypesQuery = useFrameTypesQuery();
  const signOutMutation = useSignOutMutation();
  const reactivateMutation = useReactivateFrameTypeMutation();

  const allFrameTypes = frameTypesQuery.data ?? EMPTY_FRAME_TYPES;
  const frameTypes = useMemo(
    () => (includeInactive ? allFrameTypes : allFrameTypes.filter((f) => f.is_active)),
    [allFrameTypes, includeInactive],
  );
  const rows = useMemo<FrameTypeRow[]>(() => frameTypes.map(toFrameTypeRow), [frameTypes]);
  const controller = useFrameTypesCatalogController();

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

  const tableSchema = useMemo(
    () =>
      buildTableSchema({
        tableKey: FRAME_TYPES_TABLE_KEY,
        fieldDefs: FRAME_TYPES_BUILT_IN_FIELD_DEFS,
        fieldOverlay: FRAME_TYPES_FIELD_OVERLAY,
      }),
    [],
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
            rows={rows}
            getRowId={(row) => row.id}
            columnDefs={COLUMN_DEFS}
            fieldDefs={tableSchema.fieldDefs}
            view={controller.view}
            onViewChange={controller.onViewChange}
            onResetView={controller.onResetView}
            onWrite={controller.onWrite}
            buildEmptyRow={buildEmptyFrameTypeRow}
            bulkSelectionActions={renderBulkSelectionActions}
            emptyMessage={
              frameTypesQuery.isLoading
                ? "Loading frame types…"
                : "No frame types yet. Shift-Enter to add one."
            }
          />
        )}
      </section>
    </main>
  );
}
