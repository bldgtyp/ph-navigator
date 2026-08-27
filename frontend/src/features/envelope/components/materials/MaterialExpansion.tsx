// The expanded body of one Materials row: catalog-review action, datasheet
// evidence, and per-use-site photos and notes. Split out of `MaterialsPanel`
// so the panel stays a table-composition surface.
import { AttachmentCell } from "../../../assets/components/AttachmentCell";
import { DATASHEET_ATTACHMENT_CONFIG } from "../../../assets/lib";
import type { AssetUrls } from "../../../assets/types";
import { materialHasCatalogAction } from "../../drift";
import type {
  EnvelopeAttachmentChange,
  EnvelopeCommand,
  ProjectMaterial,
  ProjectMaterialDriftItem,
} from "../../types";
import { MaterialCatalogAction } from "../MaterialCatalogStatus";
import { UseSiteRow } from "./UseSiteRow";
import { buildUseSitePhotoChanges, groupMaterialUseSites } from "./use-site-groups";

export function MaterialExpansion({
  material,
  driftItem,
  projectId,
  canEdit,
  busy,
  assetUrlById,
  assetUrlsPending,
  editingSiteKey,
  onToggleEditSite,
  onCommand,
  onAttachmentChange,
  onRefreshMaterial,
}: {
  material: ProjectMaterial;
  driftItem: ProjectMaterialDriftItem | null;
  projectId: string;
  canEdit: boolean;
  busy: boolean;
  assetUrlById: ReadonlyMap<string, AssetUrls>;
  assetUrlsPending: boolean;
  editingSiteKey: string | null;
  onToggleEditSite: (siteKey: string) => void;
  onCommand: (command: EnvelopeCommand) => void;
  onAttachmentChange: (args: EnvelopeAttachmentChange) => Promise<void> | void;
  onRefreshMaterial: (projectMaterialId: string) => void;
}) {
  const useSiteGroups = groupMaterialUseSites(material.use_sites);
  return (
    <div className="spec-expansion">
      {materialHasCatalogAction(driftItem) ? (
        <header className="spec-expansion__header">
          <MaterialCatalogAction
            item={driftItem}
            canEdit={canEdit}
            busy={busy}
            onReview={() => onRefreshMaterial(material.id)}
          />
        </header>
      ) : null}
      <div className="spec-expansion__columns">
        <div className="spec-expansion__left">
          <section className="spec-evidence" aria-label={`${material.name} datasheets`}>
            <h3>Datasheet</h3>
            <AttachmentCell
              projectId={projectId}
              value={material.datasheet_asset_ids}
              config={DATASHEET_ATTACHMENT_CONFIG}
              readOnly={!canEdit || material.specification_status === "na" || busy}
              assetUrlById={assetUrlById}
              assetUrlsPending={assetUrlsPending}
              variant="card"
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
          {!canEdit && material.comments ? <p className="spec-notes">{material.comments}</p> : null}
        </div>
        <div className="spec-expansion__right">
          <section className="spec-evidence" aria-label={`${material.name} site photos`}>
            <h3>Site Photos</h3>
            {material.use_sites.length === 0 ? (
              <p className="spec-evidence__empty">Not used by an assembly.</p>
            ) : (
              <ul className="spec-expansion__use-sites">
                {useSiteGroups.map((group) => (
                  <UseSiteRow
                    key={group.key}
                    siteKey={group.key}
                    site={group.site}
                    whereLabel={group.whereLabel}
                    projectId={projectId}
                    assetUrlById={assetUrlById}
                    assetUrlsPending={assetUrlsPending}
                    canEdit={canEdit}
                    canEditNote={group.canEditNotes}
                    busy={busy}
                    isEditing={editingSiteKey === group.key}
                    onToggleEdit={() => onToggleEditSite(group.key)}
                    onSubmit={(use_site_notes) =>
                      onCommand({
                        kind: "update_segment_use_site_notes",
                        assembly_id: group.site.assembly_id,
                        layer_id: group.site.layer_id,
                        segment_id: group.site.segment_id,
                        use_site_notes,
                      })
                    }
                    onPhotoChange={(nextAssetIds) => {
                      const changes = buildUseSitePhotoChanges(group, nextAssetIds);
                      if (changes.length === 0) return undefined;
                      return onAttachmentChange(changes.length === 1 ? changes[0]! : changes);
                    }}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
