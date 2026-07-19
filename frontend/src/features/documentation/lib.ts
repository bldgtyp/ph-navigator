import type { StatusSelectOption } from "../../shared/ui";
import type {
  DocumentationAxisCounts,
  DocumentationEvidenceStatus,
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

export type DocumentationStatusOption<TValue extends string> = StatusSelectOption<TValue>;

export const SPEC_STATUS_OPTIONS: Array<DocumentationStatusOption<DocumentationSpecStatus>> = [
  { value: "needed", label: SPEC_STATUS_LABELS.needed, tone: "missing" },
  { value: "question", label: SPEC_STATUS_LABELS.question, tone: "question" },
  { value: "complete", label: SPEC_STATUS_LABELS.complete, tone: "complete" },
  { value: "na", label: SPEC_STATUS_LABELS.na, tone: "na" },
];

export const EVIDENCE_STATUS_OPTIONS: Array<
  DocumentationStatusOption<DocumentationEvidenceStatus>
> = [
  { value: "needed", label: "Needed", tone: "missing" },
  { value: "complete", label: "Complete", tone: "complete" },
  { value: "na", label: "N/A", tone: "na" },
];

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

export function documentationSpecStatusValue(record: DocumentationRecord): DocumentationSpecStatus {
  return record.spec_status === "unknown" ? "needed" : record.spec_status;
}

export function documentationEvidenceStatusValue(
  record: DocumentationRecord,
  axis: "datasheet" | "photo",
): DocumentationEvidenceStatus {
  if (record.spec_status === "na") return "na";
  return axis === "datasheet" ? record.datasheet_status : record.photo_status;
}

export function axisDone(record: DocumentationRecord, axis: DocumentationAxis): boolean {
  if (axis === "spec") return record.spec_status === "complete" || record.spec_status === "na";
  if (axis === "datasheet")
    return record.datasheet_status !== "needed" || record.spec_status === "na";
  return record.photo_status !== "needed" || record.spec_status === "na";
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
