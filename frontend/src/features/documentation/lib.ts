import type {
  DocumentationAxisCounts,
  DocumentationRecord,
  DocumentationSection,
  DocumentationSpecStatus,
} from "./types";

export type DocumentationAxis = "spec" | "datasheet" | "photo";

export const SPEC_STATUS_LABELS: Record<DocumentationSpecStatus, string> = {
  needed: "Needed",
  question: "Question",
  complete: "Complete",
  na: "N/A",
  unknown: "Unknown",
};

export function allDocumentationAssetIds(sections: readonly DocumentationSection[]): string[] {
  const ids = new Set<string>();
  const addRecordAssets = (record: DocumentationRecord) => {
    for (const assetId of record.photo_asset_ids) ids.add(assetId);
    for (const assetId of record.datasheet_asset_ids) ids.add(assetId);
  };
  for (const section of sections) {
    for (const record of section.records) addRecordAssets(record);
    for (const group of section.groups) {
      for (const record of group.records) addRecordAssets(record);
    }
  }
  return [...ids];
}

export function sectionRecords(section: DocumentationSection): DocumentationRecord[] {
  return [...section.records, ...section.groups.flatMap((group) => group.records)];
}

export function axisDone(record: DocumentationRecord, axis: DocumentationAxis): boolean {
  if (axis === "spec") return record.spec_status === "complete" || record.spec_status === "na";
  if (axis === "datasheet") {
    return (
      record.datasheet_asset_ids.length > 0 ||
      record.datasheet_not_required ||
      record.spec_status === "na"
    );
  }
  return (
    record.photo_asset_ids.length > 0 || record.photo_not_required || record.spec_status === "na"
  );
}

export function axisMissing(record: DocumentationRecord, axis: DocumentationAxis): boolean {
  return !axisDone(record, axis);
}

export function completeCountLabel(done: number, total: number): string {
  return `${done}/${total}`;
}

export function isCountsComplete(counts: DocumentationAxisCounts): boolean {
  return (
    counts.spec_done === counts.spec_total &&
    counts.ds_done === counts.ds_total &&
    counts.photo_done === counts.photo_total
  );
}

export function filterRecord(
  record: DocumentationRecord,
  activeFilters: ReadonlySet<DocumentationAxis>,
): boolean {
  if (activeFilters.size === 0) return true;
  for (const axis of activeFilters) {
    if (axisMissing(record, axis)) return true;
  }
  return false;
}
