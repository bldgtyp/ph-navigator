import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import type { AssetUrls } from "../../assets/types";
import { StatusAxisRollup } from "../../project_document/StatusVocabulary";
import type { DocumentationFieldChange } from "../hooks";
import {
  documentationGroupKey,
  documentationRecordKey,
  filterRecord,
  partitionFullyNotApplicableRecords,
  recordsForAudience,
  type DocumentationAudiencePolicy,
  type DocumentationAxis,
} from "../lib";
import type { DocumentationGroup, DocumentationRecord, DocumentationSection } from "../types";
import { DocumentationRecordRow } from "./DocumentationRecordViews";

type RecordListBaseProps = {
  projectId: string;
  assetUrlById: ReadonlyMap<string, AssetUrls>;
  assetUrlsPending: boolean;
  canEdit: boolean;
  isRecordWriting: (record: DocumentationRecord) => boolean;
  expandedRecords: ReadonlySet<string>;
  onToggleRecord: (record: DocumentationRecord) => void;
  onDatasheetChange: (record: DocumentationRecord, nextAssetIds: string[]) => Promise<void>;
  onPhotoChange: (record: DocumentationRecord, nextAssetIds: string[]) => Promise<void>;
  onFieldChange: (change: DocumentationFieldChange) => Promise<void>;
};

type RecordListProps = RecordListBaseProps & { records: readonly DocumentationRecord[] };

type SectionBodyProps = RecordListBaseProps & {
  id: string;
  section: DocumentationSection;
  activeFilters: ReadonlySet<DocumentationAxis>;
  audiencePolicy: DocumentationAudiencePolicy;
  expandedGroups: ReadonlySet<string>;
  expandedNotApplicableGroups: ReadonlySet<string>;
  onToggleGroup: (sectionKey: string, groupKey: string) => void;
  onToggleNotApplicableGroup: (sectionKey: string, groupKey: string) => void;
};

export function DocumentationSectionBody(props: SectionBodyProps) {
  const {
    id,
    section,
    activeFilters,
    audiencePolicy,
    expandedGroups,
    expandedNotApplicableGroups,
    onToggleGroup,
    onToggleNotApplicableGroup,
    ...recordListProps
  } = props;
  const groups = section.groups.length
    ? section.groups
    : [
        {
          key: section.key,
          title: section.title,
          anchor: section.anchor,
          counts: section.counts,
          records: section.records,
        },
      ];
  const visibleGroups = groups.filter((group) =>
    groupHasRecordsForAudience(section.key, group, audiencePolicy),
  );
  if (visibleGroups.length === 0) {
    return <p className="documentation-group-empty">No records are available in this section.</p>;
  }
  return (
    <div className="documentation-section-body" id={id}>
      {visibleGroups.map((group) => (
        <DocumentationGroupView
          {...recordListProps}
          key={group.key}
          sectionKey={section.key}
          group={group}
          activeFilters={activeFilters}
          audiencePolicy={audiencePolicy}
          expanded={expandedGroups.has(documentationGroupKey(section.key, group.key))}
          notApplicableExpanded={expandedNotApplicableGroups.has(
            documentationGroupKey(section.key, group.key),
          )}
          onToggleGroup={onToggleGroup}
          onToggleNotApplicableGroup={onToggleNotApplicableGroup}
        />
      ))}
    </div>
  );
}

function groupHasRecordsForAudience(
  sectionKey: string,
  group: DocumentationGroup,
  audiencePolicy: DocumentationAudiencePolicy,
): boolean {
  return recordsForAudience(sectionKey, group.records, audiencePolicy).length > 0;
}

function DocumentationGroupView({
  sectionKey,
  group,
  activeFilters,
  audiencePolicy,
  expanded,
  notApplicableExpanded,
  onToggleGroup,
  onToggleNotApplicableGroup,
  ...recordListProps
}: RecordListBaseProps & {
  sectionKey: string;
  group: DocumentationGroup;
  activeFilters: ReadonlySet<DocumentationAxis>;
  audiencePolicy: DocumentationAudiencePolicy;
  expanded: boolean;
  notApplicableExpanded: boolean;
  onToggleGroup: (sectionKey: string, groupKey: string) => void;
  onToggleNotApplicableGroup: (sectionKey: string, groupKey: string) => void;
}) {
  const { actionable, notApplicable } = useMemo(() => {
    const audienceRecords = recordsForAudience(sectionKey, group.records, audiencePolicy);
    const filtered = audienceRecords.filter((record) => filterRecord(record, activeFilters));
    if (sectionKey !== "envelope") return { actionable: filtered, notApplicable: [] };
    return partitionFullyNotApplicableRecords(filtered);
  }, [activeFilters, audiencePolicy, group.records, sectionKey]);
  const groupId = `documentation-group-${sectionKey}-${group.key}`;
  const groupBodyId = `documentation-group-body-${sectionKey}-${group.key}`;
  const notApplicableId = `${groupBodyId}-not-applicable`;
  return (
    <section className="documentation-group" id={group.anchor} aria-labelledby={groupId}>
      <header className="documentation-group-header">
        <button
          type="button"
          className="documentation-group-title"
          aria-expanded={expanded}
          aria-controls={groupBodyId}
          onClick={() => onToggleGroup(sectionKey, group.key)}
        >
          <span aria-hidden="true">
            {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </span>
          <span id={groupId}>{group.title}</span>
        </button>
        <StatusAxisRollup counts={group.counts} />
      </header>
      {expanded ? (
        <div className="documentation-group-body" id={groupBodyId}>
          {actionable.length === 0 && notApplicable.length === 0 ? (
            <p className="documentation-group-empty">No records match the active filters.</p>
          ) : null}
          {actionable.length > 0 ? (
            <DocumentationRecordList {...recordListProps} records={actionable} />
          ) : null}
          {notApplicable.length > 0 ? (
            <section className="documentation-na-section" aria-label="Not applicable">
              <button
                type="button"
                className="documentation-na-section__title"
                aria-expanded={notApplicableExpanded}
                aria-controls={notApplicableId}
                onClick={() => onToggleNotApplicableGroup(sectionKey, group.key)}
              >
                <span aria-hidden="true">
                  {notApplicableExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </span>
                <span>Not applicable ({notApplicable.length})</span>
              </button>
              {notApplicableExpanded ? (
                <div id={notApplicableId}>
                  <DocumentationRecordList {...recordListProps} records={notApplicable} />
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function DocumentationRecordList({
  projectId,
  records,
  assetUrlById,
  assetUrlsPending,
  canEdit,
  isRecordWriting,
  expandedRecords,
  onToggleRecord,
  onDatasheetChange,
  onPhotoChange,
  onFieldChange,
}: RecordListProps) {
  return (
    <div className="documentation-grid" role="list">
      {records.map((record) => (
        <DocumentationRecordRow
          key={record.record_id}
          projectId={projectId}
          record={record}
          assetUrlById={assetUrlById}
          assetUrlsPending={assetUrlsPending}
          canEdit={canEdit}
          writing={isRecordWriting(record)}
          expanded={expandedRecords.has(documentationRecordKey(record))}
          onToggle={() => onToggleRecord(record)}
          onDatasheetChange={onDatasheetChange}
          onPhotoChange={onPhotoChange}
          onFieldChange={onFieldChange}
        />
      ))}
    </div>
  );
}
