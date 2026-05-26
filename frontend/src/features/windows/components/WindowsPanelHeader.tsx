export function WindowsPanelHeader({
  canEdit,
  onReviewAll,
  onAdd,
}: {
  canEdit: boolean;
  onReviewAll: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="status-heading">
      <div>
        <h2 id="windows-title">Windows</h2>
        <p>Pick frame and glazing types from the catalogs.</p>
      </div>
      {canEdit ? (
        <div className="windows-header-actions">
          <button type="button" onClick={onReviewAll}>
            Review all
          </button>
          <button type="button" onClick={onAdd}>
            Add window type
          </button>
        </div>
      ) : null}
    </div>
  );
}
