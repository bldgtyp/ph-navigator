import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/errors";
import { useDocumentationRollupQuery } from "../../documentation/hooks";
import type {
  DocumentationRollupGroup,
  DocumentationRollupSection,
} from "../../documentation/types";
import type { ProjectDetail } from "../../projects/types";
import { StatusAxisRollup, StatusLegend } from "../../project_document/StatusVocabulary";
import {
  evidenceAttentionLabel,
  type StatusAxisCounts,
} from "../../project_document/specification-status";

export function DocumentationProgress({ project }: { project: ProjectDetail }) {
  return <DocumentationProgressForProject key={project.id} project={project} />;
}

function DocumentationProgressForProject({ project }: { project: ProjectDetail }) {
  const query = useDocumentationRollupQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
  );
  const [expanded, setExpanded] = useState<Set<string>>(() => readExpanded(project.id));
  const toggleSection = (sectionKey: string) => {
    setExpanded((current) => {
      const next = toggled(current, sectionKey);
      writeExpanded(project.id, next);
      return next;
    });
  };

  // Attention lives in a heading, right-aligned, and only when there is work
  // left — one rule for the pane and every card in it.
  const heading = (counts?: StatusAxisCounts) => (
    <div className="status-heading status-pane-heading">
      <h2 id="documentation-progress-title">Documentation progress</h2>
      <div className="documentation-progress-heading-status">
        <AttentionCount counts={counts} />
        <StatusLegend />
      </div>
    </div>
  );
  if (!project.active_version_id) {
    return (
      <section className="documentation-progress">
        {heading()}
        <p className="status-section-empty">Create a project version to track documentation.</p>
      </section>
    );
  }
  if (query.isLoading) return <DocumentationProgressSkeleton />;
  if (query.isError || !query.data) {
    return (
      <section className="documentation-progress" aria-labelledby="documentation-progress-title">
        {heading()}
        <div className="status-section-error" role="alert">
          <p>{errorMessage(query.error, "Could not load documentation progress.")}</p>
          <button type="button" className="secondary-button" onClick={() => void query.refetch()}>
            Retry
          </button>
        </div>
      </section>
    );
  }
  return (
    <section className="documentation-progress" aria-labelledby="documentation-progress-title">
      {heading(query.data.counts)}
      <div className="documentation-progress-total">
        <AxisMeters projectId={project.id} counts={query.data.counts} />
      </div>
      <div className="documentation-progress-sections">
        {query.data.sections.map((section) => (
          <SectionRow
            key={section.key}
            projectId={project.id}
            section={section}
            expanded={expanded.has(section.key)}
            onToggle={() => toggleSection(section.key)}
          />
        ))}
      </div>
    </section>
  );
}

function SectionRow({
  projectId,
  section,
  expanded,
  onToggle,
}: {
  projectId: string;
  section: DocumentationRollupSection;
  expanded: boolean;
  onToggle: () => void;
}) {
  const groupsId = `documentation-progress-groups-${section.key}`;
  const titleId = `documentation-progress-section-${section.key}`;
  return (
    <section className="documentation-progress-section" aria-labelledby={titleId}>
      <div className="documentation-progress-section-header">
        <button
          type="button"
          className="documentation-progress-toggle"
          aria-expanded={expanded}
          aria-controls={groupsId}
          onClick={onToggle}
        >
          <span aria-hidden="true">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
          <span id={titleId}>{section.title}</span>
        </button>
        <OpenInDocumentationLink
          projectId={projectId}
          anchor={section.anchor}
          title={section.title}
        />
        <AttentionCount counts={section.counts} />
      </div>
      <AxisMeters projectId={projectId} anchor={section.anchor} counts={section.counts} />
      {expanded ? (
        <div className="documentation-progress-groups" id={groupsId}>
          {section.groups.map((group) => (
            <GroupRow key={group.key} projectId={projectId} group={group} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function GroupRow({ projectId, group }: { projectId: string; group: DocumentationRollupGroup }) {
  return (
    <div className="documentation-progress-group">
      <Link
        className="documentation-progress-group-title"
        to={`/projects/${projectId}/documentation#${group.anchor}`}
      >
        {group.title}
      </Link>
      <AxisMeters projectId={projectId} anchor={group.anchor} counts={group.counts} />
    </div>
  );
}

/**
 * "Take me to the records behind this number." The icon is revealed on hover of
 * its header row and mirrors the Documentation page's record open-owner link,
 * so the same gesture means the same thing on both surfaces.
 */
function OpenInDocumentationLink({
  projectId,
  anchor,
  title,
}: {
  projectId: string;
  anchor: string;
  title: string;
}) {
  return (
    <Link
      className="documentation-progress-open"
      to={`/projects/${projectId}/documentation#${anchor}`}
      aria-label={`Open in Documentation - ${title}`}
      title="Open in Documentation"
    >
      <ExternalLink size={14} aria-hidden="true" />
    </Link>
  );
}

function AxisMeters({
  projectId,
  anchor,
  counts,
}: {
  projectId: string;
  anchor?: string;
  counts: StatusAxisCounts;
}) {
  const hash = anchor ? `#${anchor}` : "";
  return (
    <StatusAxisRollup
      counts={counts}
      linkFor={(axis) => `/projects/${projectId}/documentation?needs=${axis}${hash}`}
    />
  );
}

/** Nothing at all when the work is done — silence is the "complete" state. */
function AttentionCount({ counts }: { counts?: StatusAxisCounts }) {
  const label = counts ? evidenceAttentionLabel(counts) : null;
  if (!label) return null;
  return <span className="chip chip--sm documentation-progress-attention">{label}</span>;
}

function DocumentationProgressSkeleton() {
  return (
    <section className="documentation-progress" aria-label="Loading documentation progress">
      <div className="status-skeleton-line" />
      <div className="status-skeleton-line" />
      <div className="status-skeleton-line" />
    </section>
  );
}

function toggled(current: Set<string>, key: string) {
  const next = new Set(current);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

function storageKey(projectId: string) {
  return `phn:overview-documentation-groups:${projectId}`;
}
function readExpanded(projectId: string): Set<string> {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(storageKey(projectId)) ?? "[]");
    return new Set(
      Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [],
    );
  } catch {
    return new Set();
  }
}
function writeExpanded(projectId: string, expanded: Set<string>) {
  try {
    sessionStorage.setItem(storageKey(projectId), JSON.stringify([...expanded]));
  } catch {
    // Session persistence is best-effort; disclosure still works without it.
  }
}
