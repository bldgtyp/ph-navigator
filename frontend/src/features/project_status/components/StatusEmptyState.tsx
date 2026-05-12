import { Link } from "react-router-dom";

export function StatusEmptyState({
  isEditor,
  projectId,
  onApplyTemplate,
  onAddItem,
}: {
  isEditor: boolean;
  projectId: string;
  onApplyTemplate: () => void;
  onAddItem: () => void;
}) {
  return (
    <section className="status-empty" aria-label="Empty project status">
      <h3>Track this project's lifecycle milestones.</h3>
      <p>
        CAD files received, design model complete, cert review complete, certification complete.
      </p>
      {isEditor ? (
        <div className="status-empty-actions">
          <button type="button" onClick={onApplyTemplate}>
            Apply BLDGTYP default template
          </button>
          <button type="button" className="secondary-button" onClick={onAddItem}>
            Add custom item
          </button>
          <Link className="text-link" to={`/projects/${projectId}/envelope`}>
            Skip to Envelope
          </Link>
        </div>
      ) : null}
    </section>
  );
}
