import { BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { ProgressBar } from "../../../shared/ui";
import type { AssetUrls } from "../../assets/types";
import type { ProjectDetail } from "../../projects/types";
import {
  useDocumentationAttachmentMutation,
  useDocumentationFieldMutation,
  type DocumentationFieldChange,
} from "../hooks";
import {
  completeCountLabel,
  filterRecord,
  isCountsComplete,
  sectionRecords,
  type DocumentationAxis,
} from "../lib";
import type {
  DocumentationAxisCounts,
  DocumentationGroup,
  DocumentationRecord,
  DocumentationSection,
  ProjectDocumentationSummary,
} from "../types";
import { DirectionsModal, RecordDetailModal } from "./DocumentationModals";
import { DocumentationRecordRow } from "./DocumentationRecordViews";

const AXIS_FILTERS: Array<{ axis: DocumentationAxis; label: string }> = [
  { axis: "spec", label: "Missing specs" },
  { axis: "datasheet", label: "Missing datasheets" },
  { axis: "photo", label: "Missing photos" },
];

export function DocumentationSummaryView({
  project,
  summary,
  assetUrlById,
}: {
  project: ProjectDetail;
  summary: ProjectDocumentationSummary;
  assetUrlById: ReadonlyMap<string, AssetUrls>;
}) {
  const location = useLocation();
  const [activeFilters, setActiveFilters] = useState<Set<DocumentationAxis>>(() => new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(() => new Set());
  const [directionsSection, setDirectionsSection] = useState<DocumentationSection | null>(null);
  const [activeRecordKey, setActiveRecordKey] = useState<string | null>(null);
  const attachmentMutation = useDocumentationAttachmentMutation(
    project.id,
    project.active_version_id,
  );
  const fieldMutation = useDocumentationFieldMutation(project.id, project.active_version_id);
  const canEdit = project.access_mode === "editor" && project.active_version?.locked !== true;
  const writeError = attachmentMutation.error ?? fieldMutation.error;
  const isRecordWriting = (record: DocumentationRecord) =>
    (attachmentMutation.isPending &&
      attachmentMutation.variables?.record.table_key === record.table_key &&
      attachmentMutation.variables.record.record_id === record.record_id) ||
    (fieldMutation.isPending &&
      fieldMutation.variables?.record.table_key === record.table_key &&
      fieldMutation.variables.record.record_id === record.record_id);
  const activeRecord = useMemo(() => {
    if (!activeRecordKey) return null;
    for (const section of summary.sections) {
      const match = sectionRecords(section).find(
        (record) => documentationRecordKey(record) === activeRecordKey,
      );
      if (match) return match;
    }
    return null;
  }, [activeRecordKey, summary.sections]);

  useEffect(() => {
    if (!location.hash) return;
    const anchor = location.hash.slice(1);
    const section = summary.sections.find(
      (candidate) =>
        candidate.anchor === anchor || candidate.groups.some((group) => group.anchor === anchor),
    );
    if (!section) return;
    setExpandedSections((current) => setWithToggledValue(current, section.key, true));
    const group = section.groups.find((candidate) => candidate.anchor === anchor);
    if (group) {
      setExpandedGroups((current) =>
        setWithToggledValue(current, documentationGroupKey(section.key, group.key), true),
      );
    }
    window.requestAnimationFrame(() => {
      const target = document.getElementById(anchor);
      if (target && "scrollIntoView" in target) target.scrollIntoView({ block: "start" });
    });
  }, [location.hash, summary.sections, summary.version_etag, summary.draft_etag]);

  const toggleFilter = (axis: DocumentationAxis) => {
    setActiveFilters((current) => {
      const next = new Set(current);
      if (next.has(axis)) next.delete(axis);
      else next.add(axis);
      return next;
    });
  };
  const toggleSection = (sectionKey: string) => {
    setExpandedSections((current) => setWithToggledValue(current, sectionKey));
  };
  const toggleGroup = (sectionKey: string, groupKey: string) => {
    setExpandedGroups((current) =>
      setWithToggledValue(current, documentationGroupKey(sectionKey, groupKey)),
    );
  };
  const toggleRecord = (record: DocumentationRecord) => {
    // Only one record may be open at a time — clicking a record rolls up any other.
    const key = documentationRecordKey(record);
    setExpandedRecords((current) => (current.has(key) ? new Set() : new Set([key])));
  };
  const updateDatasheets = async (record: DocumentationRecord, nextAssetIds: string[]) => {
    await attachmentMutation.mutateAsync({ summary, record, axis: "datasheet", nextAssetIds });
  };
  const updatePhotos = async (record: DocumentationRecord, nextAssetIds: string[]) => {
    await attachmentMutation.mutateAsync({ summary, record, axis: "photo", nextAssetIds });
  };
  const updateField = async (change: DocumentationFieldChange) => {
    await fieldMutation.mutateAsync({ summary, ...change });
  };

  return (
    <section className="tab-panel documentation-page" aria-label="Documentation">
      <header className="documentation-header">
        <div>
          <h1>Documentation status</h1>
          <p>
            Spec sign-off, datasheets, and site photos for every material and piece of equipment in
            the model.
          </p>
          <p className="documentation-attention-line">{attentionLine(summary.counts)}</p>
        </div>
      </header>
      {project.active_version?.locked ? (
        <p className="draft-banner">
          This version is locked. Save As to copy it into a new version.
        </p>
      ) : null}
      {writeError ? (
        <p className="documentation-write-error" role="alert">
          {writeError instanceof Error ? writeError.message : "Documentation write failed."}
        </p>
      ) : null}
      <div className="documentation-filterbar" aria-label="Documentation filters">
        {AXIS_FILTERS.map(({ axis, label }) => (
          <button
            type="button"
            key={axis}
            className="chip chip--md chip--outline chip--interactive documentation-filter-chip"
            data-active={activeFilters.has(axis) ? "true" : "false"}
            aria-pressed={activeFilters.has(axis)}
            onClick={() => toggleFilter(axis)}
          >
            {label}
          </button>
        ))}
      </div>
      {summary.sections.every((section) => sectionRecords(section).length === 0) ? (
        <p className="documentation-empty">
          No documentation records are available for this project version.
        </p>
      ) : (
        <div className="documentation-sections">
          {summary.sections.map((section) => {
            const expanded = expandedSections.has(section.key);
            return (
              <section
                className="documentation-section"
                id={section.anchor}
                key={section.key}
                aria-labelledby={`documentation-section-${section.key}`}
              >
                <div className="documentation-section-header">
                  <button
                    type="button"
                    className="documentation-section-title"
                    onClick={() => toggleSection(section.key)}
                    aria-expanded={expanded}
                    aria-controls={`documentation-section-body-${section.key}`}
                  >
                    <span aria-hidden="true">
                      {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                    <span id={`documentation-section-${section.key}`}>{section.title}</span>
                  </button>
                  <AxisRollup counts={section.counts} />
                  <div className="documentation-section-actions">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`How to photograph - ${section.title}`}
                      title={`How to photograph - ${section.title}`}
                      onClick={() => setDirectionsSection(section)}
                    >
                      <BookOpen size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                {expanded ? (
                  <DocumentationSectionBody
                    id={`documentation-section-body-${section.key}`}
                    projectId={project.id}
                    section={section}
                    activeFilters={activeFilters}
                    assetUrlById={assetUrlById}
                    canEdit={canEdit}
                    isRecordWriting={isRecordWriting}
                    expandedGroups={expandedGroups}
                    expandedRecords={expandedRecords}
                    onToggleGroup={toggleGroup}
                    onToggleRecord={toggleRecord}
                    onDatasheetChange={updateDatasheets}
                    onPhotoChange={updatePhotos}
                    onFieldChange={updateField}
                    onOpenRecord={(record) => setActiveRecordKey(documentationRecordKey(record))}
                  />
                ) : (
                  <p className="documentation-collapsed-stub">
                    {isCountsComplete(section.counts)
                      ? "All visible evidence is complete."
                      : "Expand to review groups."}
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}
      {directionsSection ? (
        <DirectionsModal section={directionsSection} onClose={() => setDirectionsSection(null)} />
      ) : null}
      {activeRecord ? (
        <RecordDetailModal
          projectId={project.id}
          record={activeRecord}
          assetUrlById={assetUrlById}
          canEdit={canEdit}
          writing={isRecordWriting(activeRecord)}
          onDatasheetChange={updateDatasheets}
          onPhotoChange={updatePhotos}
          onFieldChange={updateField}
          onClose={() => setActiveRecordKey(null)}
        />
      ) : null}
    </section>
  );
}

function documentationRecordKey(record: DocumentationRecord): string {
  return `${record.table_key}:${record.record_id}`;
}

function documentationGroupKey(sectionKey: string, groupKey: string): string {
  return `${sectionKey}:${groupKey}`;
}

function setWithToggledValue(current: Set<string>, key: string, force?: boolean): Set<string> {
  const hasKey = current.has(key);
  const shouldAdd = force ?? !hasKey;
  if (hasKey === shouldAdd) return current;
  const next = new Set(current);
  if (shouldAdd) next.add(key);
  else next.delete(key);
  return next;
}

function attentionLine(counts: DocumentationAxisCounts): string {
  const specs = counts.spec_total - counts.spec_done;
  const datasheets = counts.ds_total - counts.ds_done;
  const photos = counts.photo_total - counts.photo_done;
  return `${pluralCount(specs, "spec")}, ${pluralCount(datasheets, "datasheet")}, and ${pluralCount(
    photos,
    "photo",
  )} still need attention.`;
}

function pluralCount(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function AxisRollup({ counts }: { counts: DocumentationAxisCounts }) {
  return (
    <div className="documentation-rollup">
      <AxisMeter label="Spec" done={counts.spec_done} total={counts.spec_total} />
      <AxisMeter label="Datasheets" done={counts.ds_done} total={counts.ds_total} />
      <AxisMeter label="Photos" done={counts.photo_done} total={counts.photo_total} />
    </div>
  );
}

function AxisMeter({ label, done, total }: { label: string; done: number; total: number }) {
  const complete = total === 0 || done >= total;
  const zero = total > 0 && done === 0;
  const progress = total > 0 ? (done / total) * 100 : 100;
  const count = completeCountLabel(done, total);
  return (
    <span className="documentation-axis-meter" data-complete={complete} data-zero={zero}>
      <span className="documentation-axis-meter-copy">
        <span className="documentation-axis-meter-label">{label}</span>{" "}
        <span className="documentation-axis-meter-count">{count}</span>
      </span>
      <ProgressBar
        className="documentation-axis-meter-track"
        value={progress}
        label={`${label} ${count}`}
      />
    </span>
  );
}

function DocumentationSectionBody({
  id,
  projectId,
  section,
  activeFilters,
  assetUrlById,
  canEdit,
  isRecordWriting,
  expandedGroups,
  expandedRecords,
  onToggleGroup,
  onToggleRecord,
  onDatasheetChange,
  onPhotoChange,
  onFieldChange,
  onOpenRecord,
}: {
  id: string;
  projectId: string;
  section: DocumentationSection;
  activeFilters: ReadonlySet<DocumentationAxis>;
  assetUrlById: ReadonlyMap<string, AssetUrls>;
  canEdit: boolean;
  isRecordWriting: (record: DocumentationRecord) => boolean;
  expandedGroups: ReadonlySet<string>;
  expandedRecords: ReadonlySet<string>;
  onToggleGroup: (sectionKey: string, groupKey: string) => void;
  onToggleRecord: (record: DocumentationRecord) => void;
  onDatasheetChange: (record: DocumentationRecord, nextAssetIds: string[]) => Promise<void>;
  onPhotoChange: (record: DocumentationRecord, nextAssetIds: string[]) => Promise<void>;
  onFieldChange: (change: DocumentationFieldChange) => Promise<void>;
  onOpenRecord: (record: DocumentationRecord) => void;
}) {
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
  const visibleGroups = groups.filter((group) => group.records.length > 0);
  if (visibleGroups.length === 0) {
    return <p className="documentation-group-empty">No records are available in this section.</p>;
  }
  return (
    <div className="documentation-section-body" id={id}>
      {visibleGroups.map((group) => (
        <DocumentationGroupView
          key={group.key}
          projectId={projectId}
          sectionKey={section.key}
          group={group}
          activeFilters={activeFilters}
          assetUrlById={assetUrlById}
          canEdit={canEdit}
          isRecordWriting={isRecordWriting}
          expanded={expandedGroups.has(documentationGroupKey(section.key, group.key))}
          expandedRecords={expandedRecords}
          onToggleGroup={onToggleGroup}
          onToggleRecord={onToggleRecord}
          onDatasheetChange={onDatasheetChange}
          onPhotoChange={onPhotoChange}
          onFieldChange={onFieldChange}
          onOpenRecord={onOpenRecord}
        />
      ))}
    </div>
  );
}

function DocumentationGroupView({
  projectId,
  sectionKey,
  group,
  activeFilters,
  assetUrlById,
  canEdit,
  isRecordWriting,
  expanded,
  expandedRecords,
  onToggleGroup,
  onToggleRecord,
  onDatasheetChange,
  onPhotoChange,
  onFieldChange,
  onOpenRecord,
}: {
  projectId: string;
  sectionKey: string;
  group: DocumentationGroup;
  activeFilters: ReadonlySet<DocumentationAxis>;
  assetUrlById: ReadonlyMap<string, AssetUrls>;
  canEdit: boolean;
  isRecordWriting: (record: DocumentationRecord) => boolean;
  expanded: boolean;
  expandedRecords: ReadonlySet<string>;
  onToggleGroup: (sectionKey: string, groupKey: string) => void;
  onToggleRecord: (record: DocumentationRecord) => void;
  onDatasheetChange: (record: DocumentationRecord, nextAssetIds: string[]) => Promise<void>;
  onPhotoChange: (record: DocumentationRecord, nextAssetIds: string[]) => Promise<void>;
  onFieldChange: (change: DocumentationFieldChange) => Promise<void>;
  onOpenRecord: (record: DocumentationRecord) => void;
}) {
  const records = useMemo(
    () => group.records.filter((record) => filterRecord(record, activeFilters)),
    [activeFilters, group.records],
  );
  const groupId = `documentation-group-${sectionKey}-${group.key}`;
  const groupBodyId = `documentation-group-body-${sectionKey}-${group.key}`;
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
        <AxisRollup counts={group.counts} />
      </header>
      {expanded ? (
        <div id={groupBodyId}>
          {records.length === 0 ? (
            <p className="documentation-group-empty">No records match the active filters.</p>
          ) : (
            <div className="documentation-grid" role="list">
              {records.map((record) => (
                <DocumentationRecordRow
                  key={record.record_id}
                  projectId={projectId}
                  record={record}
                  assetUrlById={assetUrlById}
                  canEdit={canEdit}
                  writing={isRecordWriting(record)}
                  expanded={expandedRecords.has(documentationRecordKey(record))}
                  onToggle={() => onToggleRecord(record)}
                  onDatasheetChange={onDatasheetChange}
                  onPhotoChange={onPhotoChange}
                  onFieldChange={onFieldChange}
                  onOpenRecord={onOpenRecord}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
