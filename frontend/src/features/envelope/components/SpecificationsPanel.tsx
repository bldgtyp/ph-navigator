import { useEffect, useMemo, useState } from "react";
import {
  formatConductivityFromWmK,
  formatDensityFromKgM3,
  formatSpecificHeatFromJKgK,
  useUnitPreference,
} from "../../../lib/units";
import { ProjectMaterialEditor } from "./ProjectMaterialEditor";
import { sortProjectMaterials, viewerVisibleMaterials } from "../lib";
import type { EnvelopeCommand, ProjectMaterial, SpecificationStatus } from "../types";

const STATUSES: SpecificationStatus[] = ["missing", "question", "complete", "na"];

export function SpecificationsPanel({
  materials,
  isViewer,
  canEdit,
  busy,
  error,
  onCommand,
}: {
  materials: ProjectMaterial[];
  isViewer: boolean;
  canEdit: boolean;
  busy: boolean;
  error: string | null;
  onCommand: (command: EnvelopeCommand) => void;
}) {
  const { unitSystem } = useUnitPreference();
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editingSiteKey, setEditingSiteKey] = useState<string | null>(null);
  const visibleMaterials = useMemo(() => {
    const filtered = isViewer ? viewerVisibleMaterials(materials) : materials;
    return sortProjectMaterials(filtered);
  }, [isViewer, materials]);
  const editingMaterial = visibleMaterials.find((material) => material.id === editingMaterialId);

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
          <div className="use-sites">
            <h3>Use-sites</h3>
            {material.use_sites.length === 0 ? (
              <p>Not used by an assembly.</p>
            ) : (
              <ul>
                {material.use_sites.map((site) => (
                  <UseSiteRow
                    key={`${site.assembly_id}:${site.layer_id}:${site.segment_id}`}
                    siteKey={`${site.assembly_id}:${site.layer_id}:${site.segment_id}`}
                    assemblyName={site.assembly_name}
                    layerOrder={site.layer_order}
                    segmentOrder={site.segment_order}
                    initialNotes={site.use_site_notes}
                    canEdit={canEdit}
                    busy={busy}
                    isEditing={
                      editingSiteKey === `${site.assembly_id}:${site.layer_id}:${site.segment_id}`
                    }
                    onToggleEdit={() =>
                      setEditingSiteKey((current) => {
                        const siteKey = `${site.assembly_id}:${site.layer_id}:${site.segment_id}`;
                        return current === siteKey ? null : siteKey;
                      })
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
                  />
                ))}
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
  assemblyName,
  layerOrder,
  segmentOrder,
  initialNotes,
  canEdit,
  busy,
  isEditing,
  onToggleEdit,
  onSubmit,
}: {
  siteKey: string;
  assemblyName: string;
  layerOrder: number;
  segmentOrder: number;
  initialNotes: string | null;
  canEdit: boolean;
  busy: boolean;
  isEditing: boolean;
  onToggleEdit: () => void;
  onSubmit: (notes: string | null) => void;
}) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  useEffect(() => setNotes(initialNotes ?? ""), [siteKey, initialNotes]);
  const trimmedNotes = notes.trim() || null;
  const canSave = trimmedNotes !== initialNotes && !busy;
  return (
    <li>
      <strong>{assemblyName}</strong>
      <span>
        Layer {layerOrder + 1}, segment {segmentOrder + 1}
      </span>
      {canEdit ? (
        <>
          {initialNotes ? <em>{initialNotes}</em> : null}
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
      ) : initialNotes ? (
        <em>{initialNotes}</em>
      ) : null}
    </li>
  );
}
