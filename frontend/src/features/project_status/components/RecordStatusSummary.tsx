import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/errors";
import type { ProjectDetail } from "../../projects/types";
import {
  statusSummaryDestinationPath,
  useProjectStatusSummaryQuery,
  type StatusSummaryCounts,
  type StatusSummaryLeaf,
  type StatusSummaryRecord,
  type StatusSummaryState,
} from "../summary";

const ATTENTION_LIMIT = 10;
const STATE_LABELS: Record<StatusSummaryState, string> = {
  needed: "Needed",
  question: "Question",
  complete: "Complete",
  na: "N/A",
  unknown: "Unknown",
};
const STATUS_ORDER: Record<StatusSummaryState, number> = {
  needed: 0,
  question: 1,
  unknown: 2,
  complete: 3,
  na: 4,
};

export function RecordStatusSummary({ project }: { project: ProjectDetail }) {
  return <RecordStatusSummaryForProject key={project.id} project={project} />;
}

function RecordStatusSummaryForProject({ project }: { project: ProjectDetail }) {
  const query = useProjectStatusSummaryQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() =>
    readExpandedGroups(project.id),
  );

  useEffect(() => writeExpandedGroups(project.id, expandedGroups), [expandedGroups, project.id]);

  if (!project.active_version_id) {
    return (
      <section className="record-status" aria-labelledby="record-status-title">
        <SummaryHeading />
        <p className="status-section-empty">Create a project version to track record status.</p>
      </section>
    );
  }

  if (query.isLoading) return <RecordStatusSkeleton />;

  if (query.isError || !query.data) {
    return (
      <section className="record-status" aria-labelledby="record-status-title">
        <SummaryHeading />
        <div className="status-section-error" role="alert">
          <p>{errorMessage(query.error, "Could not load record status.")}</p>
          <button type="button" className="secondary-button" onClick={() => void query.refetch()}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  return (
    <section className="record-status" aria-labelledby="record-status-title">
      <SummaryHeading />
      <SummaryCounts counts={query.data.counts} />
      <div className="record-status-groups">
        {query.data.groups.map((group) => {
          const expanded = expandedGroups.has(group.key);
          return (
            <section className="record-status-group" key={group.key}>
              <button
                type="button"
                className="record-status-group-toggle"
                aria-expanded={expanded}
                aria-controls={`record-status-group-${group.key}`}
                onClick={() => toggleGroup(group.key)}
              >
                <span className="record-status-group-chevron" aria-hidden="true">
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
                <span className="record-status-group-name">{group.label}</span>
                <GroupCounts counts={group.counts} />
              </button>
              {expanded ? (
                <div
                  className="record-status-group-content"
                  id={`record-status-group-${group.key}`}
                >
                  {group.leaves.map((leaf) => (
                    <StatusLeaf
                      key={leaf.table_name}
                      projectId={project.id}
                      leaf={leaf}
                      showHeading={group.leaves.length > 1}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </section>
  );
}

function SummaryHeading() {
  return (
    <div className="status-section-heading">
      <div>
        <h2 id="record-status-title">Record status</h2>
        <p>Equipment and documentation that still need attention.</p>
      </div>
    </div>
  );
}

function SummaryCounts({ counts }: { counts: StatusSummaryCounts }) {
  return (
    <div className="record-status-totals" aria-label="Record status totals">
      <Count label="needed" value={counts.needed} state="needed" />
      <Count label="questions" value={counts.question} state="question" />
      <Count label="complete" value={counts.complete} state="complete" />
      <Count label="N/A" value={counts.na} state="na" />
      {counts.unknown > 0 ? <Count label="unknown" value={counts.unknown} state="unknown" /> : null}
    </div>
  );
}

function Count({
  label,
  value,
  state,
}: {
  label: string;
  value: number;
  state: StatusSummaryState;
}) {
  return (
    <span className={`record-status-total record-status-total--${state}`}>
      <strong>{value}</strong> {label}
    </span>
  );
}

function GroupCounts({ counts }: { counts: StatusSummaryCounts }) {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (total === 0) return <span className="record-status-group-empty">No records</span>;
  return (
    <span className="record-status-group-counts">
      {counts.needed > 0 ? <span className="needed">{counts.needed} needed</span> : null}
      {counts.question > 0 ? <span className="question">{counts.question} questions</span> : null}
      <span>{total} total</span>
    </span>
  );
}

function StatusLeaf({
  projectId,
  leaf,
  showHeading,
}: {
  projectId: string;
  leaf: StatusSummaryLeaf;
  showHeading: boolean;
}) {
  const [showAllAttention, setShowAllAttention] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const sorted = useMemo(
    () => [...leaf.records].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]),
    [leaf.records],
  );
  const attention = sorted.filter((record) => !["complete", "na"].includes(record.status));
  const resolved = sorted.filter((record) => ["complete", "na"].includes(record.status));
  const visibleAttention = showAllAttention ? attention : attention.slice(0, ATTENTION_LIMIT);

  return (
    <section className="record-status-leaf">
      <div className="record-status-leaf-heading">
        {showHeading ? <h3>{leaf.label}</h3> : <span />}
        <Link
          className="text-link record-status-open-table"
          to={statusSummaryDestinationPath(projectId, leaf.destination)}
        >
          Open table <ExternalLink size={13} aria-hidden="true" />
        </Link>
      </div>
      {leaf.records.length === 0 ? (
        <p className="record-status-leaf-empty">No records.</p>
      ) : (
        <>
          <div className="record-status-records">
            {visibleAttention.map((record) => (
              <StatusRecordRow key={record.id} projectId={projectId} leaf={leaf} record={record} />
            ))}
            {showResolved
              ? resolved.map((record) => (
                  <StatusRecordRow
                    key={record.id}
                    projectId={projectId}
                    leaf={leaf}
                    record={record}
                  />
                ))
              : null}
          </div>
          <div className="record-status-disclosure-actions">
            {attention.length > ATTENTION_LIMIT ? (
              <button
                type="button"
                className="text-link"
                onClick={() => setShowAllAttention((value) => !value)}
              >
                {showAllAttention ? "Show fewer" : `Show all ${attention.length} attention items`}
              </button>
            ) : null}
            {resolved.length > 0 ? (
              <button
                type="button"
                className="text-link"
                onClick={() => setShowResolved((value) => !value)}
              >
                {showResolved ? "Hide resolved" : `Show ${resolved.length} resolved`}
              </button>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

function StatusRecordRow({
  projectId,
  leaf,
  record,
}: {
  projectId: string;
  leaf: StatusSummaryLeaf;
  record: StatusSummaryRecord;
}) {
  const [notesExpanded, setNotesExpanded] = useState(false);
  return (
    <article className="record-status-record">
      <div className="record-status-record-main">
        <Link to={statusSummaryDestinationPath(projectId, leaf.destination, record.id)}>
          {record.display_name}
        </Link>
        <span className={`record-status-chip record-status-chip--${record.status}`}>
          {STATE_LABELS[record.status]}
        </span>
      </div>
      {record.notes ? (
        <div className="record-status-notes">
          <p className={notesExpanded ? "expanded" : ""}>{record.notes}</p>
          {record.notes.length > 120 ? (
            <button
              type="button"
              className="text-link"
              onClick={() => setNotesExpanded((value) => !value)}
            >
              {notesExpanded ? "Show less" : "Read note"}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function RecordStatusSkeleton() {
  return (
    <section className="record-status" aria-labelledby="record-status-title">
      <SummaryHeading />
      <p className="sr-only" role="status">
        Loading record status...
      </p>
      <div className="record-status-skeleton" aria-hidden="true">
        <div className="status-skeleton-line status-skeleton-line--counts" />
        {Array.from({ length: 7 }, (_, index) => (
          <div className="status-skeleton-line" key={index} />
        ))}
      </div>
    </section>
  );
}

function expandedStorageKey(projectId: string) {
  return `phn:status-summary:expanded:${projectId}`;
}

function readExpandedGroups(projectId: string): Set<string> {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(expandedStorageKey(projectId)) ?? "[]");
    return new Set(
      Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [],
    );
  } catch {
    return new Set();
  }
}

function writeExpandedGroups(projectId: string, groups: Set<string>) {
  try {
    window.sessionStorage.setItem(expandedStorageKey(projectId), JSON.stringify([...groups]));
  } catch {
    // Session persistence is best-effort; disclosure still works without it.
  }
}
