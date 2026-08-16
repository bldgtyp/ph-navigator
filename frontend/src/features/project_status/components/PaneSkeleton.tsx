/**
 * Loading placeholder for either Overview pane. Both sides of the brief use
 * one skeleton so they cannot go out of step — the same reason the panes share
 * `.status-pane-heading`.
 */
export function PaneSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="pane-skeleton" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <div className="status-skeleton-line" key={index} />
      ))}
    </div>
  );
}
