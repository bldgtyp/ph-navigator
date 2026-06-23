import type { EnvelopeAttachmentChangeArgs, ProjectMaterialUseSite } from "../../types";

export type MaterialUseSiteGroup = {
  key: string;
  site: ProjectMaterialUseSite;
  sites: ProjectMaterialUseSite[];
  whereLabel: string;
  canEditNotes: boolean;
};

export function groupMaterialUseSites(sites: ProjectMaterialUseSite[]): MaterialUseSiteGroup[] {
  const byAssembly = new Map<string, ProjectMaterialUseSite[]>();
  for (const site of sites) {
    const existing = byAssembly.get(site.assembly_id);
    if (existing) existing.push(site);
    else byAssembly.set(site.assembly_id, [site]);
  }

  return Array.from(byAssembly.entries()).map(([assemblyId, assemblySites]) => {
    const sortedSites = [...assemblySites].sort(compareUseSites);
    const primarySite = sortedSites[0]!;
    return {
      key: assemblyId,
      sites: sortedSites,
      site: {
        ...primarySite,
        photo_asset_ids: uniqueStrings(sortedSites.flatMap((site) => site.photo_asset_ids)),
        use_site_notes: summarizeUseSiteNotes(sortedSites),
      },
      whereLabel: formatUseSiteWhere(sortedSites),
      canEditNotes: sortedSites.length === 1,
    };
  });
}

export function buildUseSitePhotoChanges(
  group: MaterialUseSiteGroup,
  nextAssetIds: string[],
): EnvelopeAttachmentChangeArgs[] {
  const nextGroupAssetIds = uniqueStrings(nextAssetIds);
  const currentGroupAssetIds = group.site.photo_asset_ids;
  const removedAssetIds = new Set(
    currentGroupAssetIds.filter((assetId) => !nextGroupAssetIds.includes(assetId)),
  );
  const addedAssetIds = nextGroupAssetIds.filter(
    (assetId) => !currentGroupAssetIds.includes(assetId),
  );
  if (removedAssetIds.size === 0 && addedAssetIds.length === 0) return [];

  const primarySegmentId = group.sites[0]?.segment_id;
  const changes: EnvelopeAttachmentChangeArgs[] = [];
  for (const site of group.sites) {
    const remainingAssetIds = site.photo_asset_ids.filter(
      (assetId) => !removedAssetIds.has(assetId),
    );
    const siteNextAssetIds =
      site.segment_id === primarySegmentId
        ? uniqueStrings([...remainingAssetIds, ...addedAssetIds])
        : remainingAssetIds;
    if (!sameAssetIds(site.photo_asset_ids, siteNextAssetIds)) {
      changes.push({
        tableKey: "assembly_segments",
        rowId: site.segment_id,
        fieldKey: "photo_asset_ids",
        currentAssetIds: site.photo_asset_ids,
        nextAssetIds: siteNextAssetIds,
      });
    }
  }
  return changes;
}

export function countGroupedUseSitePhotos(sites: ProjectMaterialUseSite[]): number {
  return groupMaterialUseSites(sites).reduce(
    (total, group) => total + group.site.photo_asset_ids.length,
    0,
  );
}

function compareUseSites(a: ProjectMaterialUseSite, b: ProjectMaterialUseSite): number {
  return a.layer_order - b.layer_order || a.segment_order - b.segment_order;
}

function formatUseSiteWhere(sites: ProjectMaterialUseSite[]): string {
  if (sites.length === 1) {
    const site = sites[0]!;
    return `layer ${site.layer_order + 1}, segment ${site.segment_order + 1}`;
  }

  const byLayer = new Map<number, number[]>();
  for (const site of sites) {
    const layer = site.layer_order + 1;
    const segments = byLayer.get(layer) ?? [];
    segments.push(site.segment_order + 1);
    byLayer.set(layer, segments);
  }

  if (byLayer.size === 1) {
    const [layer, segments] = Array.from(byLayer.entries())[0]!;
    return `layer ${layer}, segments ${segments.join(", ")}`;
  }

  return `${sites.length} segments across ${byLayer.size} layers`;
}

function summarizeUseSiteNotes(sites: ProjectMaterialUseSite[]): string | null {
  const notes = uniqueStrings(
    sites.map((site) => site.use_site_notes?.trim() ?? "").filter((note) => note.length > 0),
  );
  if (notes.length === 0) return null;
  if (notes.length === 1) return notes[0]!;
  return `${notes.length} segment notes: ${notes.join(" / ")}`;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function sameAssetIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((assetId, index) => assetId === b[index]);
}
