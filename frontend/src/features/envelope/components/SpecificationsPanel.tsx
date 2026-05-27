import { useEffect, useMemo, useState } from "react";
import {
  formatConductivityFromWmK,
  formatDensityFromKgM3,
  formatSpecificHeatFromJKgK,
  useUnitPreference,
} from "../../../lib/units";
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { useAssetUrls } from "../../assets/hooks";
import { DATASHEET_ATTACHMENT_CONFIG, SITE_PHOTO_ATTACHMENT_CONFIG } from "../../assets/lib";
import type { AssetUrls } from "../../assets/types";
import { ProjectMaterialEditor } from "./ProjectMaterialEditor";
import { sortProjectMaterials, viewerVisibleMaterials } from "../lib";
import type {
  EnvelopeCommand,
  ProjectMaterial,
  ProjectMaterialUseSite,
  SpecificationStatus,
} from "../types";

const STATUSES: SpecificationStatus[] = ["missing", "question", "complete", "na"];
type AttachmentChangeArgs = {
  tableKey: string;
  rowId: string;
  fieldKey: string;
  currentAssetIds: string[];
  nextAssetIds: string[];
};

export function SpecificationsPanel({
  materials,
  projectId,
  isViewer,
  canEdit,
  busy,
  error,
  onCommand,
  onAttachmentChange,
}: {
  materials: ProjectMaterial[];
  projectId: string;
  isViewer: boolean;
  canEdit: boolean;
  busy: boolean;
  error: string | null;
  onCommand: (command: EnvelopeCommand) => void;
  onAttachmentChange: (args: AttachmentChangeArgs) => Promise<void> | void;
}) {
  const { unitSystem } = useUnitPreference();
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editingSiteKey, setEditingSiteKey] = useState<string | null>(null);
  const visibleMaterials = useMemo(() => {
    const filtered = isViewer ? viewerVisibleMaterials(materials) : materials;
    return sortProjectMaterials(filtered);
  }, [isViewer, materials]);
  const editingMaterial = visibleMaterials.find((material) => material.id === editingMaterialId);
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

  return (
    <div className="specifications-grid">
      {visibleMaterials.map((material) => (
        <article key={material.id} className="spec-card">
          <header>
            <div>
              <h2>{material.name}</h2>
              <p>
                {material.category ?? "Uncategorized"} · {material.specification_status}
              </p>
            </div>
            <span>{material.use_sites.length} uses</span>
          </header>
          {canEdit ? (
            <div className="spec-card-actions">
              <label>
                Status
                <select
                  value={material.specification_status}
                  disabled={busy}
                  onChange={(event) =>
                    onCommand({
                      kind: "update_project_material",
                      project_material_id: material.id,
                      specification_status: event.currentTarget.value as SpecificationStatus,
                    })
                  }
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setEditingMaterialId((current) => (current === material.id ? null : material.id))
                }
              >
                {editingMaterialId === material.id ? "Close editor" : "Edit material"}
              </button>
            </div>
          ) : null}
          <dl className="spec-values">
            <div>
              <dt>Lambda</dt>
              <dd>{formatConductivityFromWmK(material.conductivity_w_mk, { unitSystem })}</dd>
            </div>
            <div>
              <dt>Density</dt>
              <dd>{formatDensityFromKgM3(material.density_kg_m3, { unitSystem })}</dd>
            </div>
            <div>
              <dt>Specific heat</dt>
              <dd>{formatSpecificHeatFromJKgK(material.specific_heat_j_kgk, { unitSystem })}</dd>
            </div>
          </dl>
          {canEdit && editingMaterial?.id === material.id ? (
            <ProjectMaterialEditor
              key={material.id}
              material={material}
              busy={busy}
              error={error}
              onCommand={onCommand}
            />
          ) : material.notes ? (
            <p className="spec-notes">{material.notes}</p>
          ) : null}
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
          <div className="use-sites">
            <h3>Use-sites</h3>
            {material.use_sites.length === 0 ? (
              <p>Not used by an assembly.</p>
            ) : (
              <ul>
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
          </div>
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
        </article>
      ))}
    </div>
  );
}

function UseSiteRow({
  siteKey,
  site,
  projectId,
  assetUrlById,
  canEdit,
  busy,
  isEditing,
  onToggleEdit,
  onSubmit,
  onPhotoChange,
}: {
  siteKey: string;
  site: ProjectMaterialUseSite;
  projectId: string;
  assetUrlById: ReadonlyMap<string, AssetUrls>;
  canEdit: boolean;
  busy: boolean;
  isEditing: boolean;
  onToggleEdit: () => void;
  onSubmit: (notes: string | null) => void;
  onPhotoChange: (nextAssetIds: string[]) => Promise<void> | void;
}) {
  const [notes, setNotes] = useState(site.use_site_notes ?? "");
  useEffect(() => setNotes(site.use_site_notes ?? ""), [siteKey, site.use_site_notes]);
  const trimmedNotes = notes.trim() || null;
  const canSave = trimmedNotes !== site.use_site_notes && !busy;
  return (
    <li>
      <strong>{site.assembly_name}</strong>
      <span>
        Layer {site.layer_order + 1}, segment {site.segment_order + 1}
      </span>
      <div className="use-site-evidence">
        <span>Photos</span>
        <AttachmentCell
          projectId={projectId}
          value={site.photo_asset_ids}
          config={SITE_PHOTO_ATTACHMENT_CONFIG}
          readOnly={!canEdit || busy}
          assetUrlById={assetUrlById}
          showInlineEmptyButton={canEdit}
          onChange={onPhotoChange}
        />
      </div>
      {canEdit ? (
        <>
          {site.use_site_notes ? <em>{site.use_site_notes}</em> : null}
          <button type="button" className="secondary-button" onClick={onToggleEdit}>
            {isEditing ? "Close note" : "Edit note"}
          </button>
          {isEditing ? (
            <div className="use-site-note-editor">
              <textarea value={notes} onChange={(event) => setNotes(event.currentTarget.value)} />
              <button
                type="button"
                className="secondary-button"
                disabled={!canSave}
                onClick={() => onSubmit(trimmedNotes)}
              >
                Save note
              </button>
            </div>
          ) : null}
        </>
      ) : site.use_site_notes ? (
        <em>{site.use_site_notes}</em>
      ) : null}
    </li>
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
