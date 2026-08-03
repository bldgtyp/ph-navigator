import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/errors";
import { ProgressBar } from "../../../shared/ui";
import { useDocumentationRollupQuery } from "../../documentation/hooks";
import { completeCountLabel, type DocumentationAxis } from "../../documentation/lib";
import type {
  DocumentationAxisCounts,
  DocumentationRollupGroup,
  DocumentationRollupSection,
} from "../../documentation/types";
import type { ProjectDetail } from "../../projects/types";
import { StatusLegend } from "../../project_document/StatusVocabulary";
import {
  STATUS_AXIS_LABELS,
  needAttentionLabel,
} from "../../project_document/specification-status";

const AXES: Array<{
  key: DocumentationAxis;
  label: string;
  done: keyof DocumentationAxisCounts;
  total: keyof DocumentationAxisCounts;
}> = [
  { key: "spec", label: STATUS_AXIS_LABELS.spec.meter, done: "spec_done", total: "spec_total" },
  {
    key: "datasheet",
    label: STATUS_AXIS_LABELS.datasheet.meter,
    done: "ds_done",
    total: "ds_total",
  },
  { key: "photo", label: STATUS_AXIS_LABELS.photo.meter, done: "photo_done", total: "photo_total" },
];

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

  const heading = (
    <div className="status-section-heading documentation-progress-heading">
      <div>
        <h2 id="documentation-progress-title">Documentation progress</h2>
        <p>Specification, datasheet, and site-photo evidence.</p>
      </div>
      <StatusLegend />
    </div>
  );
  if (!project.active_version_id) {
    return (
      <section className="documentation-progress">
        {heading}
        <p className="status-section-empty">Create a project version to track documentation.</p>
      </section>
    );
  }
  if (query.isLoading) return <DocumentationProgressSkeleton />;
  if (query.isError || !query.data) {
    return (
      <section className="documentation-progress" aria-labelledby="documentation-progress-title">
        {heading}
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
      {heading}
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
  return (
    <section className="documentation-progress-section">
      <div className="documentation-progress-section-header">
        <button
          type="button"
          className="documentation-progress-toggle"
          aria-expanded={expanded}
          onClick={onToggle}
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span>{section.title}</span>
        </button>
        <Link to={`/projects/${projectId}/documentation#${section.anchor}`}>Open section</Link>
      </div>
      <MeterRow projectId={projectId} anchor={section.anchor} counts={section.counts} />
      {expanded ? (
        <div className="documentation-progress-groups">
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
      <Link to={`/projects/${projectId}/documentation#${group.anchor}`}>{group.title}</Link>
      <MeterRow projectId={projectId} anchor={group.anchor} counts={group.counts} />
    </div>
  );
}

function MeterRow({
  projectId,
  anchor,
  counts,
}: {
  projectId: string;
  anchor: string;
  counts: DocumentationAxisCounts;
}) {
  const attention =
    counts.spec_total -
    counts.spec_done +
    counts.ds_total -
    counts.ds_done +
    counts.photo_total -
    counts.photo_done;
  return (
    <div className="documentation-progress-meters">
      {AXES.map((axis) => {
        const done = counts[axis.done];
        const total = counts[axis.total];
        return (
          <Link
            key={axis.key}
            className="documentation-progress-meter"
            to={`/projects/${projectId}/documentation?needs=${axis.key}#${anchor}`}
          >
            <span>
              {axis.label} {completeCountLabel(done, total)}
            </span>
            <ProgressBar
              className="documentation-progress-meter-track"
              value={total > 0 ? (done / total) * 100 : 100}
              label={`${axis.label} ${done} of ${total}`}
            />
          </Link>
        );
      })}
      {attention > 0 ? (
        <span className="documentation-progress-attention">{needAttentionLabel(attention)}</span>
      ) : null}
    </div>
  );
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
