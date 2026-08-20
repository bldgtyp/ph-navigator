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
export type DocumentationAudiencePolicy = "authenticated" | "anonymous-hidden";

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

export function allDocumentationAssetIds(
  sections: readonly DocumentationSection[],
  audiencePolicy: DocumentationAudiencePolicy,
): string[] {
  const ids = new Set<string>();
  const addRecordAssets = (record: DocumentationRecord) => {
    for (const assetId of record.photo_asset_ids) ids.add(assetId);
    for (const assetId of record.datasheet_asset_ids) ids.add(assetId);
  };
  for (const section of sections) {
    for (const record of recordsForAudience(section.key, section.records, audiencePolicy)) {
      addRecordAssets(record);
    }
    for (const group of section.groups) {
      for (const record of recordsForAudience(section.key, group.records, audiencePolicy)) {
        addRecordAssets(record);
      }
    }
  }
  return [...ids];
}

export function sectionRecords(section: DocumentationSection): DocumentationRecord[] {
  return [...section.records, ...section.groups.flatMap((group) => group.records)];
}

export function isFullyNotApplicable(record: DocumentationRecord): boolean {
  return (
    record.spec_status === "na" && record.datasheet_status === "na" && record.photo_status === "na"
  );
}

export function partitionFullyNotApplicableRecords(records: readonly DocumentationRecord[]): {
  actionable: DocumentationRecord[];
  notApplicable: DocumentationRecord[];
} {
  const actionable: DocumentationRecord[] = [];
  const notApplicable: DocumentationRecord[] = [];
  for (const record of records) {
    (isFullyNotApplicable(record) ? notApplicable : actionable).push(record);
  }
  return { actionable, notApplicable };
}

export function recordsForAudience(
  sectionKey: string,
  records: readonly DocumentationRecord[],
  audiencePolicy: DocumentationAudiencePolicy,
): readonly DocumentationRecord[] {
  if (sectionKey !== "envelope" || audiencePolicy === "authenticated") return records;
  return records.filter((record) => !isFullyNotApplicable(record));
}

export function sectionHasRecordsForAudience(
  section: DocumentationSection,
  audiencePolicy: DocumentationAudiencePolicy,
): boolean {
  if (section.key !== "envelope" || audiencePolicy === "authenticated") {
    return section.records.length > 0 || section.groups.some((group) => group.records.length > 0);
  }
  return (
    recordsForAudience(section.key, section.records, audiencePolicy).length > 0 ||
    section.groups.some(
      (group) => recordsForAudience(section.key, group.records, audiencePolicy).length > 0,
    )
  );
}

export function documentationRecordKey(record: DocumentationRecord): string {
  return `${record.table_key}:${record.record_id}`;
}

export function documentationGroupKey(sectionKey: string, groupKey: string): string {
  return `${sectionKey}:${groupKey}`;
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
  if (axis === "datasheet") return record.datasheet_status !== "needed";
  return record.photo_status !== "needed";
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
