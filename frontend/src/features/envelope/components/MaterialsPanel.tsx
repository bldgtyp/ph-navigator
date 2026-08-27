import { useMemo, useState } from "react";
import { Pencil, X } from "lucide-react";
import {
  formatConductivityFromWmK,
  formatDensityFromKgM3,
  formatRPerInFromConductivityWmK,
  formatSpecificHeatFromJKgK,
  useUnitPreference,
} from "../../../lib/units";
import { useAssetUrls } from "../../assets/hooks";
import {
  conductivityUnitLabel,
  densityUnitLabel,
  specificHeatUnitLabel,
} from "../../catalogs/components/unit-labels";
import { StatusSelect } from "../../../shared/ui";
import {
  AttachmentChipCell,
  BulkStatusAction,
  ReportTable,
  StatusFilterChips,
  useReportSelection,
  type ReportStatusKey,
  type ReportTableColumn,
  type StatusFilterOption,
  type StatusFilterValue,
} from "../../../shared/ui/report-table";
import { MaterialDriftFlag, MaterialReviewBanner } from "./MaterialCatalogStatus";
import { ProjectMaterialEditorModal } from "./ProjectMaterialEditorModal";
import { materialNeedsCatalogReview } from "../drift";
import { sortProjectMaterials, viewerVisibleMaterials } from "../lib";
import type {
  EnvelopeAttachmentChange,
  EnvelopeCommand,
  ProjectMaterial,
  ProjectMaterialDriftItem,
  SpecificationStatus,
} from "../types";
import { MaterialExpansion } from "./materials/MaterialExpansion";
import { countGroupedUseSitePhotos } from "./materials/use-site-groups";
import {
  SPECIFICATION_STATUSES,
  SPECIFICATION_STATUS_LABELS,
  SPECIFICATION_STATUS_OPTIONS,
  STATUS_AXIS_LABELS,
  STATUS_AXIS_TOOLTIPS,
} from "../../project_document/specification-status";
import { StatusAxisHeader, StatusRollupSummary } from "../../project_document/StatusVocabulary";

export function MaterialsPanel({
  materials,
  driftByMaterialId,
  projectId,
  isViewer,
  canEdit,
  busy,
  error,
  onCommand,
  onCommandBatch,
  onAttachmentChange,
  onRefreshMaterial,
}: {
  materials: ProjectMaterial[];
  driftByMaterialId: ReadonlyMap<string, ProjectMaterialDriftItem>;
  projectId: string;
  isViewer: boolean;
  canEdit: boolean;
  busy: boolean;
  error: string | null;
  onCommand: (command: EnvelopeCommand) => void;
  onCommandBatch: (commands: EnvelopeCommand[]) => void;
  onAttachmentChange: (args: EnvelopeAttachmentChange) => Promise<void> | void;
  onRefreshMaterial: (projectMaterialId: string) => void;
}) {
  const { unitSystem } = useUnitPreference();
  const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null);
  const [editingSiteKey, setEditingSiteKey] = useState<string | null>(null);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue<ReportStatusKey>>("all");
  const [reviewOnly, setReviewOnly] = useState(false);

  const visibleMaterials = useMemo(() => {
    const filtered = isViewer ? viewerVisibleMaterials(materials) : materials;
    return sortProjectMaterials(filtered);
  }, [isViewer, materials]);

  const statusCounts = useMemo(() => {
    const counts: Record<SpecificationStatus, number> = {
      needed: 0,
      question: 0,
      complete: 0,
      na: 0,
    };
    for (const material of visibleMaterials) counts[material.specification_status] += 1;
    return counts;
  }, [visibleMaterials]);

  const reviewCount = useMemo(
    () =>
      visibleMaterials.filter((m) => materialNeedsCatalogReview(driftByMaterialId.get(m.id)))
        .length,
    [driftByMaterialId, visibleMaterials],
  );

  // Drop the review filter when refreshing the last drifted material empties it.
  const reviewFilterActive = reviewOnly && reviewCount > 0;

  const filteredMaterials = useMemo(() => {
    const byReview = reviewFilterActive
      ? visibleMaterials.filter((m) => materialNeedsCatalogReview(driftByMaterialId.get(m.id)))
      : visibleMaterials;
    if (statusFilter === "all") return byReview;
    return byReview.filter((m) => m.specification_status === statusFilter);
  }, [driftByMaterialId, reviewFilterActive, statusFilter, visibleMaterials]);
  const { activeMaterials, backgroundMaterials, unusedMaterials } = useMemo(() => {
    const active: ProjectMaterial[] = [];
    const background: ProjectMaterial[] = [];
    const unused: ProjectMaterial[] = [];
    for (const material of filteredMaterials) {
      if (material.use_sites.length === 0) unused.push(material);
      else if (material.specification_status === "na") background.push(material);
      else active.push(material);
    }
    return { activeMaterials: active, backgroundMaterials: background, unusedMaterials: unused };
  }, [filteredMaterials]);

  const selectableIds = useMemo(
    () => filteredMaterials.map((material) => material.id),
    [filteredMaterials],
  );
  const { selection, bulkAction } = useReportSelection({
    selectableIds,
    makeStatusCommand: makeMaterialStatusCommand,
    onCommandBatch,
  });

  const attachmentAssetIds = useMemo(
    () => collectSpecificationAssetIds(visibleMaterials),
    [visibleMaterials],
  );
  const assetUrls = useAssetUrls(projectId, attachmentAssetIds);
  const assetUrlById = useMemo(
    () => new Map((assetUrls.data ?? []).map((item) => [item.asset_id, item])),
    [assetUrls.data],
  );

  if (visibleMaterials.length === 0) {
    return (
      <div className="envelope-empty" role="status">
        <h2>No project materials</h2>
        <p>Project material specifications will appear here after assemblies reference them.</p>
      </div>
    );
  }

  const resolvedCount = statusCounts.complete + statusCounts.na;
  const totalCount = visibleMaterials.length;

  const filterOptions: StatusFilterOption<ReportStatusKey>[] = [
    { value: "all", label: "All", count: totalCount },
    ...SPECIFICATION_STATUSES.map((status) => ({
      value: status,
      status,
      label: SPECIFICATION_STATUS_LABELS[status],
      count: statusCounts[status],
    })),
  ];

  const columns: ReportTableColumn<ProjectMaterial>[] = [
    {
      key: "material",
      header: "Material",
      primary: true,
      width: "minmax(180px, 2fr)",
      render: (m) => (
        <span className="materials-panel__name" title={m.name}>
          {m.name}
          <MaterialDriftFlag item={driftByMaterialId.get(m.id) ?? null} />
        </span>
      ),
    },
    {
      key: "category",
      header: "Category",
      width: "minmax(120px, 1.2fr)",
      render: (m) => <span>{m.category ?? "Uncategorized"}</span>,
    },
    {
      // PH designers reason in R-per-inch (resistivity) in IP, conductivity in SI.
      // The stored field is always conductivity_w_mk; resistivity is derived at display.
      key: "lambda",
      header: unitSystem === "IP" ? "Resistivity" : "Lambda",
      unit: unitSystem === "IP" ? "R/inch" : conductivityUnitLabel(unitSystem),
      numeric: true,
      width: "minmax(80px, 0.7fr)",
      render: (m) => (
        <span>
          {unitSystem === "IP"
            ? formatRPerInFromConductivityWmK(m.conductivity_w_mk, { unitSystem, showUnit: false })
            : formatConductivityFromWmK(m.conductivity_w_mk, { unitSystem, showUnit: false })}
        </span>
      ),
    },
    {
      key: "density",
      header: "Density",
      unit: densityUnitLabel(unitSystem),
      numeric: true,
      width: "minmax(80px, 0.7fr)",
      render: (m) => (
        <span>{formatDensityFromKgM3(m.density_kg_m3, { unitSystem, showUnit: false })}</span>
      ),
    },
    {
      key: "specific_heat",
      header: "Spec. Heat",
      unit: specificHeatUnitLabel(unitSystem),
      numeric: true,
      width: "minmax(80px, 0.7fr)",
      render: (m) => (
        <span>
          {formatSpecificHeatFromJKgK(m.specific_heat_j_kgk, { unitSystem, showUnit: false })}
        </span>
      ),
    },
    {
      key: "datasheet",
      header: <StatusAxisHeader axis="datasheet" />,
      width: "80px",
      render: (m) => <AttachmentChipCell count={m.datasheet_asset_ids.length} noun="datasheet" />,
    },
    {
      key: "photos",
      header: <StatusAxisHeader axis="photo" />,
      width: "80px",
      render: (m) => (
        <AttachmentChipCell count={countGroupedUseSitePhotos(m.use_sites)} noun="photo" />
      ),
    },
    {
      key: "status",
      header: <StatusAxisHeader axis="spec" />,
      width: "minmax(120px, 1fr)",
      render: (m) => (
        <StatusSelect
          ariaLabel={STATUS_AXIS_LABELS.spec.column}
          title={STATUS_AXIS_TOOLTIPS.spec}
          value={m.specification_status}
          options={SPECIFICATION_STATUS_OPTIONS}
          disabled={busy}
          readOnly={!canEdit}
          onChange={(nextStatus) =>
            onCommand({
              kind: "update_project_material",
              project_material_id: m.id,
              specification_status: nextStatus,
            })
          }
        />
      ),
    },
  ];

  const editingMaterial =
    editingMaterialId !== null
      ? (visibleMaterials.find((m) => m.id === editingMaterialId) ?? null)
      : null;
  const showActiveSection = activeMaterials.length > 0 || filteredMaterials.length === 0;
  const showBackgroundSection =
    backgroundMaterials.length > 0 || (filteredMaterials.length === 0 && statusFilter === "na");
  const showUnusedSection = unusedMaterials.length > 0;

  const renderMaterialRowAction = (material: ProjectMaterial, unused: boolean) => {
    if (unused) {
      return (
        <button
          type="button"
          className="data-table-toolbar-button data-table-toolbar-button--icon materials-panel__remove-unused"
          aria-label={`Remove unused material ${material.name}`}
          title="Remove unused material from project"
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation();
            onCommand({
              kind: "remove_project_material",
              project_material_id: material.id,
            });
          }}
        >
          <X size={16} aria-hidden="true" />
        </button>
      );
    }

    return (
      <button
        type="button"
        className="data-table-toolbar-button data-table-toolbar-button--icon"
        aria-label="Edit material attributes"
        title="Edit material attributes"
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation();
          setEditingMaterialId(material.id);
        }}
      >
        <Pencil size={16} aria-hidden="true" />
      </button>
    );
  };

  const renderMaterialTable = (
    rows: ProjectMaterial[],
    emptyMessage: string,
    options: { unused?: boolean } = {},
  ) => (
    <ReportTable
      rows={rows}
      columns={columns}
      getRowId={(m) => m.id}
      expandedRowId={expandedMaterialId}
      onToggleExpand={(id) => setExpandedMaterialId((current) => (current === id ? null : id))}
      emptyMessage={emptyMessage}
      selection={canEdit ? selection : undefined}
      getRowLabel={(m) => m.name}
      renderRowAction={
        canEdit
          ? (material) => renderMaterialRowAction(material, options.unused === true)
          : undefined
      }
      renderExpansion={(material) => (
        <MaterialExpansion
          material={material}
          driftItem={driftByMaterialId.get(material.id) ?? null}
          projectId={projectId}
          canEdit={canEdit}
          busy={busy}
          assetUrlById={assetUrlById}
          assetUrlsPending={assetUrls.isPending}
          editingSiteKey={editingSiteKey}
          onToggleEditSite={(siteKey) =>
            setEditingSiteKey((current) => (current === siteKey ? null : siteKey))
          }
          onCommand={onCommand}
          onAttachmentChange={onAttachmentChange}
          onRefreshMaterial={onRefreshMaterial}
        />
      )}
    />
  );

  return (
    <div className="materials-panel">
      {/* Mirrors the assemblies route, where the same `commandError` is shown
          under the canvas unless a dialog is already carrying it. Without this
          a rejected status write reverted its pill and said nothing. */}
      {error && !editingMaterial ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <MaterialReviewBanner
        count={reviewCount}
        filtered={reviewFilterActive}
        onToggleFilter={() => setReviewOnly((current) => !current)}
      />
      <StatusFilterChips
        options={filterOptions}
        value={statusFilter}
        onChange={setStatusFilter}
        summary={
          canEdit && bulkAction.selectedCount > 0 ? (
            <BulkStatusAction {...bulkAction} disabled={busy} />
          ) : (
            <StatusRollupSummary resolved={resolvedCount} total={totalCount} />
          )
        }
      />
      <div className="materials-panel__sections">
        {showActiveSection ? (
          <section className="materials-panel__section" aria-labelledby="materials-active-heading">
            <header className="materials-panel__section-header">
              <h2 id="materials-active-heading">In scope</h2>
              <span>{activeMaterials.length}</span>
            </header>
            {renderMaterialTable(
              activeMaterials,
              "No in-scope materials match the current filter.",
            )}
          </section>
        ) : null}
        {showBackgroundSection ? (
          <section
            className="materials-panel__section materials-panel__section--background"
            aria-labelledby="materials-background-heading"
          >
            <header className="materials-panel__section-header">
              <h2 id="materials-background-heading">N/A</h2>
              <span>{backgroundMaterials.length}</span>
            </header>
            {renderMaterialTable(backgroundMaterials, "No N/A materials match the current filter.")}
          </section>
        ) : null}
        {showUnusedSection ? (
          <section
            className="materials-panel__section materials-panel__section--unused"
            aria-labelledby="materials-unused-heading"
          >
            <header className="materials-panel__section-header">
              <h2 id="materials-unused-heading">Unused</h2>
              <span>{unusedMaterials.length}</span>
            </header>
            {renderMaterialTable(unusedMaterials, "No unused materials match the current filter.", {
              unused: true,
            })}
          </section>
        ) : null}
      </div>
      {editingMaterial ? (
        <ProjectMaterialEditorModal
          material={editingMaterial}
          busy={busy}
          error={error}
          onClose={() => setEditingMaterialId(null)}
          onCommand={onCommand}
        />
      ) : null}
    </div>
  );
}

function makeMaterialStatusCommand(
  project_material_id: string,
  specification_status: SpecificationStatus,
): EnvelopeCommand {
  return { kind: "update_project_material", project_material_id, specification_status };
}

function collectSpecificationAssetIds(materials: ProjectMaterial[]): string[] {
  const ids = new Set<string>();
  for (const material of materials) {
    for (const assetId of material.datasheet_asset_ids) ids.add(assetId);
    for (const site of material.use_sites) {
      for (const assetId of site.photo_asset_ids) ids.add(assetId);
    }
  }
  return [...ids];
}
