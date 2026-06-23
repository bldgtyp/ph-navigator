import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import {
  formatConductivityFromWmK,
  formatDensityFromKgM3,
  formatSpecificHeatFromJKgK,
  useUnitPreference,
} from "../../../lib/units";
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { useAssetUrls } from "../../assets/hooks";
import { DATASHEET_ATTACHMENT_CONFIG } from "../../assets/lib";
import {
  conductivityUnitLabel,
  densityUnitLabel,
  specificHeatUnitLabel,
} from "../../catalogs/components/unit-labels";
import { AutocompleteSelect } from "../../../shared/ui/AutocompleteSelect";
import {
  AttachmentChipCell,
  ReportTable,
  StatusDot,
  StatusFilterChips,
  type ReportStatusKey,
  type ReportTableColumn,
  type StatusFilterOption,
  type StatusFilterValue,
} from "../../../shared/ui/report-table";
import { MaterialDriftBadge } from "./MaterialDrift";
import { ProjectMaterialEditorModal } from "./ProjectMaterialEditorModal";
import { materialNeedsCatalogReview } from "../drift";
import { sortProjectMaterials, viewerVisibleMaterials } from "../lib";
import type {
  EnvelopeCommand,
  EnvelopeAttachmentChangeArgs,
  ProjectMaterial,
  ProjectMaterialDriftItem,
  SpecificationStatus,
} from "../types";
import { UseSiteRow } from "./materials/UseSiteRow";

const STATUSES: SpecificationStatus[] = ["missing", "question", "complete", "na"];

const STATUS_LABEL: Record<SpecificationStatus, string> = {
  missing: "Missing",
  question: "Question",
  complete: "Complete",
  na: "N/A",
};

export function MaterialsPanel({
  materials,
  driftByMaterialId,
  projectId,
  isViewer,
  canEdit,
  busy,
  error,
  onCommand,
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
  onAttachmentChange: (args: EnvelopeAttachmentChangeArgs) => Promise<void> | void;
  onRefreshMaterial: (projectMaterialId: string) => void;
}) {
  const { unitSystem } = useUnitPreference();
  const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null);
  const [editingSiteKey, setEditingSiteKey] = useState<string | null>(null);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue<ReportStatusKey>>("all");

  const visibleMaterials = useMemo(() => {
    const filtered = isViewer ? viewerVisibleMaterials(materials) : materials;
    return sortProjectMaterials(filtered);
  }, [isViewer, materials]);

  const statusCounts = useMemo(() => {
    const counts: Record<SpecificationStatus, number> = {
      missing: 0,
      question: 0,
      complete: 0,
      na: 0,
    };
    for (const material of visibleMaterials) counts[material.specification_status] += 1;
    return counts;
  }, [visibleMaterials]);

  const filteredMaterials = useMemo(() => {
    if (statusFilter === "all") return visibleMaterials;
    return visibleMaterials.filter((m) => m.specification_status === statusFilter);
  }, [statusFilter, visibleMaterials]);
  const { activeMaterials, backgroundMaterials } = useMemo(() => {
    const active: ProjectMaterial[] = [];
    const background: ProjectMaterial[] = [];
    for (const material of filteredMaterials) {
      if (material.specification_status === "na") background.push(material);
      else active.push(material);
    }
    return { activeMaterials: active, backgroundMaterials: background };
  }, [filteredMaterials]);

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
    { value: "missing", status: "missing", label: "Missing", count: statusCounts.missing },
    { value: "question", status: "question", label: "Question", count: statusCounts.question },
    { value: "complete", status: "complete", label: "Complete", count: statusCounts.complete },
    { value: "na", status: "na", label: "N/A", count: statusCounts.na },
  ];

  const columns: ReportTableColumn<ProjectMaterial>[] = [
    {
      key: "material",
      header: "Material",
      primary: true,
      width: "minmax(180px, 2fr)",
      render: (m) => <span title={m.name}>{m.name}</span>,
    },
    {
      key: "category",
      header: "Category",
      width: "minmax(120px, 1.2fr)",
      render: (m) => <span>{m.category ?? "Uncategorized"}</span>,
    },
    {
      key: "lambda",
      header: "Lambda",
      unit: conductivityUnitLabel(unitSystem),
      numeric: true,
      width: "minmax(80px, 0.7fr)",
      render: (m) => (
        <span>
          {formatConductivityFromWmK(m.conductivity_w_mk, { unitSystem, showUnit: false })}
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
      header: "Datasheet",
      width: "80px",
      render: (m) => <AttachmentChipCell count={m.datasheet_asset_ids.length} />,
    },
    {
      key: "photos",
      header: "Photos",
      width: "80px",
      render: (m) => (
        <AttachmentChipCell
          count={m.use_sites.reduce((total, site) => total + site.photo_asset_ids.length, 0)}
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "minmax(120px, 1fr)",
      render: (m) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, width: "100%" }}>
          <StatusDot status={m.specification_status} />
          {canEdit ? (
            <AutocompleteSelect
              ariaLabel="Status"
              value={m.specification_status}
              disabled={busy}
              compact
              listboxPlacement="portal"
              options={STATUSES.map((status) => ({
                value: status,
                label: STATUS_LABEL[status],
              }))}
              onChange={(nextStatus) =>
                onCommand({
                  kind: "update_project_material",
                  project_material_id: m.id,
                  specification_status: nextStatus as SpecificationStatus,
                })
              }
            />
          ) : (
            <span>{STATUS_LABEL[m.specification_status]}</span>
          )}
        </span>
      ),
    },
  ];

  const editingMaterial =
    editingMaterialId !== null
      ? (visibleMaterials.find((m) => m.id === editingMaterialId) ?? null)
      : null;
  const showActiveSection = activeMaterials.length > 0 || statusFilter !== "na";
  const showBackgroundSection = backgroundMaterials.length > 0 || statusFilter === "na";

  const renderMaterialTable = (rows: ProjectMaterial[], emptyMessage: string) => (
    <ReportTable
      rows={rows}
      columns={columns}
      getRowId={(m) => m.id}
      expandedRowId={expandedMaterialId}
      onToggleExpand={(id) => setExpandedMaterialId((current) => (current === id ? null : id))}
      emptyMessage={emptyMessage}
      renderRowAction={
        canEdit
          ? (material) => (
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
            )
          : undefined
      }
      renderExpansion={(material) => {
        const driftItem = driftByMaterialId.get(material.id) ?? null;
        return (
          <div className="spec-expansion">
            <header className="spec-expansion__header">
              <div>
                <MaterialDriftBadge item={driftItem} />
              </div>
              <div className="spec-expansion__header-actions">
                {canEdit && materialNeedsCatalogReview(driftItem) ? (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => onRefreshMaterial(material.id)}
                  >
                    Refresh from catalog
                  </button>
                ) : null}
              </div>
            </header>
            <div className="spec-expansion__columns">
              <div className="spec-expansion__left">
                <section className="spec-evidence" aria-label={`${material.name} datasheets`}>
                  <h3>Datasheets</h3>
                  <AttachmentCell
                    projectId={projectId}
                    value={material.datasheet_asset_ids}
                    config={DATASHEET_ATTACHMENT_CONFIG}
                    readOnly={!canEdit || material.specification_status === "na" || busy}
                    assetUrlById={assetUrlById}
                    showInlineEmptyButton={canEdit && material.specification_status !== "na"}
                    onChange={(nextAssetIds) =>
                      onAttachmentChange({
                        tableKey: "project_materials",
                        rowId: material.id,
                        fieldKey: "datasheet_asset_ids",
                        currentAssetIds: material.datasheet_asset_ids,
                        nextAssetIds,
                      })
                    }
                  />
                </section>
                {!canEdit && material.comments ? (
                  <p className="spec-notes">{material.comments}</p>
                ) : null}
                {canEdit && material.use_sites.length === 0 ? (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => onCommand({ kind: "remove_unused_project_materials" })}
                  >
                    Remove unused project materials
                  </button>
                ) : null}
              </div>
              <div className="spec-expansion__right">
                <section className="spec-evidence" aria-label={`${material.name} site photos`}>
                  <h3>Site photos</h3>
                  {material.use_sites.length === 0 ? (
                    <p className="spec-evidence__empty">Not used by an assembly.</p>
                  ) : (
                    <ul className="spec-expansion__use-sites">
                      {material.use_sites.map((site) => {
                        const siteKey = `${site.assembly_id}:${site.layer_id}:${site.segment_id}`;
                        return (
                          <UseSiteRow
                            key={siteKey}
                            siteKey={siteKey}
                            site={site}
                            projectId={projectId}
                            assetUrlById={assetUrlById}
                            canEdit={canEdit}
                            busy={busy}
                            isEditing={editingSiteKey === siteKey}
                            onToggleEdit={() =>
                              setEditingSiteKey((current) => (current === siteKey ? null : siteKey))
                            }
                            onSubmit={(use_site_notes) =>
                              onCommand({
                                kind: "update_segment_use_site_notes",
                                assembly_id: site.assembly_id,
                                layer_id: site.layer_id,
                                segment_id: site.segment_id,
                                use_site_notes,
                              })
                            }
                            onPhotoChange={(nextAssetIds) =>
                              onAttachmentChange({
                                tableKey: "assembly_segments",
                                rowId: site.segment_id,
                                fieldKey: "photo_asset_ids",
                                currentAssetIds: site.photo_asset_ids,
                                nextAssetIds,
                              })
                            }
                          />
                        );
                      })}
                    </ul>
                  )}
                </section>
              </div>
            </div>
          </div>
        );
      }}
    />
  );

  return (
    <>
      <StatusFilterChips
        options={filterOptions}
        value={statusFilter}
        onChange={setStatusFilter}
        summary={`${resolvedCount}/${totalCount} resolved`}
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
    </>
  );
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
