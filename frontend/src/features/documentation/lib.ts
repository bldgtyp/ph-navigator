import type { StatusSelectOption } from "../../shared/ui";
import type {
  DocumentationEvidenceStatus,
  DocumentationRecord,
  DocumentationSection,
  DocumentationSpecStatus,
} from "./types";
import {
  EVIDENCE_STATUSES,
  EVIDENCE_STATUS_LABELS,
  SPECIFICATION_STATUS_LABELS,
  SPECIFICATION_STATUS_OPTIONS,
  type DocumentationStatusAxis,
} from "../project_document/specification-status";

/** Owned by the shared status vocabulary; aliased for local readability. */
export type DocumentationAxis = DocumentationStatusAxis;

export const SPEC_STATUS_LABELS: Record<DocumentationSpecStatus, string> = {
  ...SPECIFICATION_STATUS_LABELS,
  unknown: "Unknown",
};

export type DocumentationStatusOption<TValue extends string> = StatusSelectOption<TValue>;

// `unknown` is response-only (D-7): it is never an editor-selectable option.
export const SPEC_STATUS_OPTIONS: Array<DocumentationStatusOption<DocumentationSpecStatus>> =
  SPECIFICATION_STATUS_OPTIONS;

export const EVIDENCE_STATUS_OPTIONS: Array<
  DocumentationStatusOption<DocumentationEvidenceStatus>
> = EVIDENCE_STATUSES.map((status) => ({
  value: status,
  label: EVIDENCE_STATUS_LABELS[status],
  tone: status,
}));

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
