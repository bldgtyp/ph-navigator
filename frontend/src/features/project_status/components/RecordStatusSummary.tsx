import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/errors";
import { Tooltip } from "../../../shared/ui";
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
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() =>
    readExpandedGroups(project.id),
  );

  useEffect(() => writeExpandedGroups(project.id, expandedNodes), [expandedNodes, project.id]);

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
    setExpandedNodes((current) => {
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
          const expanded = expandedNodes.has(group.key);
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
                  {groupChildren(group.leaves).map((child) =>
                    child.kind === "leaf" ? (
                      <StatusLeaf
                        key={child.leaf.table_name}
                        projectId={project.id}
                        leaf={child.leaf}
                        expanded={expandedNodes.has(leafNodeKey(group.key, child.leaf.table_name))}
                        onToggle={() => toggleGroup(leafNodeKey(group.key, child.leaf.table_name))}
                      />
                    ) : (
                      <StatusSubgroup
                        key={child.key}
                        projectId={project.id}
                        groupKey={group.key}
                        subgroup={child}
                        expandedNodes={expandedNodes}
                        onToggle={toggleGroup}
                      />
                    ),
                  )}
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
    <h2 className="sr-only" id="record-status-title">
      Record status
    </h2>
  );
}

function SummaryCounts({ counts }: { counts: StatusSummaryCounts }) {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const resolved = counts.complete + counts.na;
  const attention = counts.needed + counts.question + counts.unknown;
  const progress = total > 0 ? (resolved / total) * 100 : 0;
  return (
    <div className="record-status-overview" aria-label="Record status totals">
      <div className="record-status-progress-copy">
        <span>
          <strong>{resolved}</strong> of {total} records resolved
        </span>
        <span className="record-status-attention">{attention} need attention</span>
      </div>
      <ProgressBar value={progress} label={`${resolved} of ${total} records resolved`} />
    </div>
  );
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <span
      className="record-status-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
    >
      <span style={{ width: `${value}%` }} />
    </span>
  );
}

function GroupCounts({ counts }: { counts: StatusSummaryCounts }) {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (total === 0) return <span className="record-status-group-empty">No records</span>;
  const resolved = counts.complete + counts.na;
  const attention = counts.needed + counts.question + counts.unknown;
  return (
    <span className="record-status-group-counts">
      {attention > 0 ? <span className="needed">{counts.needed} needed</span> : null}
      <span className="record-status-group-progress-copy">
        {resolved} / {total} resolved
      </span>
      <ProgressBar value={(resolved / total) * 100} label={`${resolved} of ${total} resolved`} />
    </span>
  );
}

function LeafCounts({ counts }: { counts: StatusSummaryCounts }) {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (total === 0) return <span className="record-status-group-empty">No records</span>;
  const resolved = counts.complete + counts.na;
  const attention = counts.needed + counts.question + counts.unknown;
  return (
    <span className="record-status-leaf-counts">
      {attention > 0 ? <span className="needed">{attention} need attention</span> : null}
      <span>{resolved} resolved</span>
    </span>
  );
}

type StatusSummaryChild =
  | { kind: "leaf"; leaf: StatusSummaryLeaf }
  | { kind: "subgroup"; key: string; label: string; leaves: StatusSummaryLeaf[] };

function groupChildren(leaves: StatusSummaryLeaf[]): StatusSummaryChild[] {
  const children: StatusSummaryChild[] = [];
  for (const leaf of leaves) {
    if (!leaf.subgroup_key || !leaf.subgroup_label) {
      children.push({ kind: "leaf", leaf });
      continue;
    }
    const existing = children.find(
      (child): child is Extract<StatusSummaryChild, { kind: "subgroup" }> =>
        child.kind === "subgroup" && child.key === leaf.subgroup_key,
    );
    if (existing) existing.leaves.push(leaf);
    else {
      children.push({
        kind: "subgroup",
        key: leaf.subgroup_key,
        label: leaf.subgroup_label,
        leaves: [leaf],
      });
    }
  }
  return children;
}

function StatusSubgroup({
  projectId,
  groupKey,
  subgroup,
  expandedNodes,
  onToggle,
}: {
  projectId: string;
  groupKey: string;
  subgroup: Extract<StatusSummaryChild, { kind: "subgroup" }>;
  expandedNodes: Set<string>;
  onToggle: (key: string) => void;
}) {
  const nodeKey = subgroupNodeKey(groupKey, subgroup.key);
  const expanded = expandedNodes.has(nodeKey);
  const counts = sumCounts(subgroup.leaves.map((leaf) => leaf.counts));
  return (
    <section className="record-status-subgroup">
      <button
        type="button"
        className="record-status-leaf-toggle record-status-subgroup-toggle"
        aria-expanded={expanded}
        aria-controls={`record-status-subgroup-${subgroup.key}`}
        onClick={() => onToggle(nodeKey)}
      >
        <span className="record-status-leaf-chevron" aria-hidden="true">
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </span>
        <span className="record-status-leaf-name">{subgroup.label}</span>
        <LeafCounts counts={counts} />
      </button>
      {expanded ? (
        <div
          className="record-status-subgroup-content"
          id={`record-status-subgroup-${subgroup.key}`}
        >
          {subgroup.leaves.map((leaf) => (
            <StatusLeaf
              key={leaf.table_name}
              projectId={projectId}
              leaf={leaf}
              expanded={expandedNodes.has(leafNodeKey(groupKey, leaf.table_name))}
              onToggle={() => onToggle(leafNodeKey(groupKey, leaf.table_name))}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function sumCounts(counts: StatusSummaryCounts[]): StatusSummaryCounts {
  return counts.reduce(
    (total, count) => ({
      needed: total.needed + count.needed,
      question: total.question + count.question,
      complete: total.complete + count.complete,
      na: total.na + count.na,
      unknown: total.unknown + count.unknown,
    }),
    { needed: 0, question: 0, complete: 0, na: 0, unknown: 0 },
  );
}

function StatusLeaf({
  projectId,
  leaf,
  expanded,
  onToggle,
}: {
  projectId: string;
  leaf: StatusSummaryLeaf;
  expanded: boolean;
  onToggle: () => void;
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
      <div className="record-status-leaf-header">
        <button
          type="button"
          className="record-status-leaf-toggle"
          aria-expanded={expanded}
          aria-controls={`record-status-leaf-${leaf.table_name}`}
          onClick={onToggle}
        >
          <span className="record-status-leaf-chevron" aria-hidden="true">
            {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </span>
          <span className="record-status-leaf-name">{leaf.label}</span>
          <LeafCounts counts={leaf.counts} />
        </button>
        <Tooltip content="Open table" hoverDelay={300} placement="top">
          <Link
            className="record-status-open-table"
            to={statusSummaryDestinationPath(projectId, leaf.destination)}
            aria-label="Open table"
          >
            <ExternalLink size={14} aria-hidden="true" />
          </Link>
        </Tooltip>
      </div>
      {expanded ? (
        <div className="record-status-leaf-content" id={`record-status-leaf-${leaf.table_name}`}>
          {leaf.records.length === 0 ? (
            <p className="record-status-leaf-empty">No records.</p>
          ) : (
            <>
              <div className="record-status-records">
                {visibleAttention.map((record) => (
                  <StatusRecordRow
                    key={record.id}
                    projectId={projectId}
                    leaf={leaf}
                    record={record}
                  />
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
                    {showAllAttention
                      ? "Show fewer"
                      : `Show all ${attention.length} attention items`}
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
        </div>
      ) : null}
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

function leafNodeKey(groupKey: string, tableName: string) {
  return `${groupKey}:${tableName}`;
}

function subgroupNodeKey(groupKey: string, subgroupKey: string) {
  return `${groupKey}:group:${subgroupKey}`;
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
