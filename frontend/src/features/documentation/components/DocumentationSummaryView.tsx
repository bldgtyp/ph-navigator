import { BookOpen, ChevronDown, ChevronRight, Link as LinkIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { AssetUrls } from "../../assets/types";
import type { ProjectDetail } from "../../projects/types";
import {
  useDocumentationFieldMutation,
  useDocumentationPhotoMutation,
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
import {
  DirectionsModal,
  DocumentationRecordRow,
  RecordDetailModal,
} from "./DocumentationRecordViews";

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
  const [expandedCompleteSections, setExpandedCompleteSections] = useState<Set<string>>(
    () => new Set(),
  );
  const [directionsSection, setDirectionsSection] = useState<DocumentationSection | null>(null);
  const [activeRecordKey, setActiveRecordKey] = useState<string | null>(null);
  const photoMutation = useDocumentationPhotoMutation(project.id, project.active_version_id);
  const fieldMutation = useDocumentationFieldMutation(project.id, project.active_version_id);
  const canEdit = project.access_mode === "editor" && project.active_version?.locked !== true;
  const writeError = photoMutation.error ?? fieldMutation.error;
  const isRecordWriting = (record: DocumentationRecord) =>
    (photoMutation.isPending &&
      photoMutation.variables?.record.table_key === record.table_key &&
      photoMutation.variables.record.record_id === record.record_id) ||
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
    const target = document.getElementById(location.hash.slice(1));
    if (target && "scrollIntoView" in target) {
      target.scrollIntoView({ block: "start" });
    }
  }, [location.hash, summary.version_etag, summary.draft_etag]);

  const toggleFilter = (axis: DocumentationAxis) => {
    setActiveFilters((current) => {
      const next = new Set(current);
      if (next.has(axis)) next.delete(axis);
      else next.add(axis);
      return next;
    });
  };
  const toggleCompleteSection = (sectionKey: string) => {
    setExpandedCompleteSections((current) => {
      const next = new Set(current);
      if (next.has(sectionKey)) next.delete(sectionKey);
      else next.add(sectionKey);
      return next;
    });
  };
  const copyAnchor = async (anchor: string) => {
    const nextUrl = `${window.location.origin}${window.location.pathname}${window.location.search}#${anchor}`;
    await navigator.clipboard?.writeText(nextUrl);
  };
  const updatePhotos = async (record: DocumentationRecord, nextAssetIds: string[]) => {
    await photoMutation.mutateAsync({ summary, record, nextAssetIds });
  };
  const updateField = async (change: DocumentationFieldChange) => {
    await fieldMutation.mutateAsync({ summary, ...change });
  };

  return (
    <section className="tab-panel documentation-page" aria-label="Documentation">
      <header className="documentation-header">
        <AxisRollup counts={summary.counts} />
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
            const complete = isCountsComplete(section.counts);
            const collapsed = complete && !expandedCompleteSections.has(section.key);
            return (
              <section
                className="documentation-section"
                id={section.anchor}
                key={section.key}
                aria-labelledby={`documentation-section-${section.key}`}
              >
                <div className="documentation-section-header">
                  {complete ? (
                    <button
                      type="button"
                      className="documentation-section-title"
                      onClick={() => toggleCompleteSection(section.key)}
                      aria-expanded={!collapsed}
                    >
                      <span aria-hidden="true">
                        {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </span>
                      <span id={`documentation-section-${section.key}`}>{section.title}</span>
                    </button>
                  ) : (
                    <h3
                      className="documentation-section-title documentation-section-title--static"
                      id={`documentation-section-${section.key}`}
                    >
                      {section.title}
                    </h3>
                  )}
                  <AxisRollup counts={section.counts} compact />
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
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Copy ${section.title} link`}
                      title={`Copy ${section.title} link`}
                      onClick={() => void copyAnchor(section.anchor)}
                    >
                      <LinkIcon size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                {collapsed ? (
                  <p className="documentation-collapsed-stub">All visible evidence is complete.</p>
                ) : (
                  <DocumentationSectionBody
                    projectId={project.id}
                    section={section}
                    activeFilters={activeFilters}
                    assetUrlById={assetUrlById}
                    canEdit={canEdit}
                    isRecordWriting={isRecordWriting}
                    onPhotoChange={updatePhotos}
                    onFieldChange={updateField}
                    onOpenRecord={(record) => setActiveRecordKey(documentationRecordKey(record))}
                  />
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

function AxisRollup({
  counts,
  compact = false,
}: {
  counts: DocumentationAxisCounts;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact ? "documentation-rollup documentation-rollup--compact" : "documentation-rollup"
      }
    >
      <span className="chip chip--sm documentation-axis-chip">
        Spec {completeCountLabel(counts.spec_done, counts.spec_total)}
      </span>
      <span className="chip chip--sm documentation-axis-chip">
        Datasheets {completeCountLabel(counts.ds_done, counts.ds_total)}
      </span>
      <span className="chip chip--sm documentation-axis-chip">
        Photos {completeCountLabel(counts.photo_done, counts.photo_total)}
      </span>
    </div>
  );
}

function DocumentationSectionBody({
  projectId,
  section,
  activeFilters,
  assetUrlById,
  canEdit,
  isRecordWriting,
  onPhotoChange,
  onFieldChange,
  onOpenRecord,
}: {
  projectId: string;
  section: DocumentationSection;
  activeFilters: ReadonlySet<DocumentationAxis>;
  assetUrlById: ReadonlyMap<string, AssetUrls>;
  canEdit: boolean;
  isRecordWriting: (record: DocumentationRecord) => boolean;
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
    <div className="documentation-section-body">
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
  onPhotoChange: (record: DocumentationRecord, nextAssetIds: string[]) => Promise<void>;
  onFieldChange: (change: DocumentationFieldChange) => Promise<void>;
  onOpenRecord: (record: DocumentationRecord) => void;
}) {
  const records = useMemo(
    () => group.records.filter((record) => filterRecord(record, activeFilters)),
    [activeFilters, group.records],
  );
  if (records.length === 0) {
    return (
      <section className="documentation-group" aria-labelledby={`documentation-group-${group.key}`}>
        <header className="documentation-group-header">
          <h3 id={`documentation-group-${group.key}`}>{group.title}</h3>
          <AxisRollup counts={group.counts} compact />
        </header>
        <p className="documentation-group-empty">No records match the active filters.</p>
      </section>
    );
  }
  return (
    <section className="documentation-group" aria-labelledby={`documentation-group-${group.key}`}>
      <header className="documentation-group-header">
        <h3 id={`documentation-group-${group.key}`}>{group.title}</h3>
        <AxisRollup counts={group.counts} compact />
      </header>
      <div className="documentation-grid" role="list">
        {records.map((record) => (
          <DocumentationRecordRow
            key={record.record_id}
            projectId={projectId}
            sectionKey={sectionKey}
            record={record}
            assetUrlById={assetUrlById}
            canEdit={canEdit}
            writing={isRecordWriting(record)}
            onPhotoChange={onPhotoChange}
            onFieldChange={onFieldChange}
            onOpenRecord={onOpenRecord}
          />
        ))}
      </div>
    </section>
  );
}
