import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/errors";
import { PaneSkeleton } from "./PaneSkeleton";
import { useDocumentationRollupQuery } from "../../documentation/hooks";
import type {
  DocumentationRollupGroup,
  DocumentationRollupSection,
} from "../../documentation/types";
import { TAB_LABELS, isProjectTab, projectTabPath } from "../../projects/lib";
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
  // Persist outside the updater: React may replay a state updater, and an
  // updater that writes to sessionStorage is not pure.
  const toggleSection = (sectionKey: string) => {
    const next = toggled(expanded, sectionKey);
    setExpanded(next);
    writeExpanded(project.id, next);
  };

  const rollup = query.data;
  const body = () => {
    if (!project.active_version_id) {
      return (
        <DocumentationProgressEmpty
          title="No project version yet."
          copy="Create a version to start tracking specifications, datasheets, and site photos."
        />
      );
    }
    if (query.isLoading) return <PaneSkeleton />;
    if (query.isError || !rollup) {
      return (
        <div className="status-section-error" role="alert">
          <p>{errorMessage(query.error, "Could not load documentation progress.")}</p>
          <button type="button" className="secondary-button" onClick={() => void query.refetch()}>
            Retry
          </button>
        </div>
      );
    }
    if (rollup.sections.length === 0) {
      return (
        <DocumentationProgressEmpty
          title="Nothing to document yet."
          copy="Sections appear here once this version has materials, apertures, or equipment to evidence."
        />
      );
    }
    return (
      <>
        <div className="documentation-progress-total">
          <AxisMeters projectId={project.id} counts={rollup.counts} />
        </div>
        <div className="documentation-progress-sections">
          {rollup.sections.map((section) => (
            <SectionRow
              key={section.key}
              projectId={project.id}
              section={section}
              expanded={expanded.has(section.key)}
              onToggle={() => toggleSection(section.key)}
            />
          ))}
        </div>
      </>
    );
  };

  // One wrapper for every state, so the heading cannot go missing (or lose its
  // label) in one of them and shift the layout when data lands.
  return (
    <section
      className="documentation-progress"
      aria-labelledby="documentation-progress-title"
      aria-busy={query.isLoading || undefined}
    >
      <ProgressHeading counts={rollup?.counts} />
      {body()}
    </section>
  );
}

/** Attention sits at the far end of the heading, and only while work remains. */
function ProgressHeading({ counts }: { counts?: StatusAxisCounts }) {
  return (
    <div className="status-heading status-pane-heading">
      <h2 id="documentation-progress-title">Documentation progress</h2>
      <div className="documentation-progress-heading-status">
        <AttentionCount counts={counts} />
        <StatusLegend />
      </div>
    </div>
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
        <OpenSectionLink {...sectionDestination(projectId, section)} />
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
 * The header means "go to the thing"; a meter means "go to the evidence". So
 * the header icon opens the section's own tab — Apertures opens Apertures —
 * while the meters keep deep-linking into Documentation with a `?needs=`
 * filter.
 *
 * Section keys are project-tab slugs written with underscores
 * (`thermal_bridges` vs the `thermal-bridges` route), so a future section lands
 * on its tab automatically; one that names no tab falls back to the
 * Documentation anchor rather than 404ing.
 */
function sectionDestination(projectId: string, section: DocumentationRollupSection) {
  const slug = section.key.replace(/_/g, "-");
  if (!isProjectTab(slug)) {
    return {
      to: `/projects/${projectId}/documentation#${section.anchor}`,
      label: `Open in Documentation - ${section.title}`,
    };
  }
  // Through `projectTabPath`, never a hand-built URL: a tab slug is not always
  // its route (`spaces` resolves to `/spaces/rooms`), so building the string
  // here would make the "lands on its tab automatically" promise false for
  // exactly the case it is meant to cover.
  return { to: projectTabPath(projectId, slug), label: `Open ${TAB_LABELS[slug]}` };
}

/** Revealed on hover of its header row, like the Documentation page's record
 *  open-owner link, so the same gesture means the same thing on both. */
function OpenSectionLink({ to, label }: { to: string; label: string }) {
  return (
    <Link className="documentation-progress-open" to={to} aria-label={label} title={label}>
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

/** Same `.status-empty` panel the Roadmap pane uses, so the two sides of the
 *  brief go empty the same way. */
function DocumentationProgressEmpty({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="status-empty">
      <h3>{title}</h3>
      <p>{copy}</p>
    </div>
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
