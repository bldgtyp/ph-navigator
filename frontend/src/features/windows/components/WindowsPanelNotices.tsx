export function WindowsPanelNotices({
  canEdit,
  reviewableCount,
  isLocked,
  source,
  actionError,
  onReviewAll,
}: {
  canEdit: boolean;
  reviewableCount: number;
  isLocked: boolean;
  source: "draft" | "version";
  actionError: string | null;
  onReviewAll: () => void;
}) {
  return (
    <>
      {canEdit && reviewableCount > 0 ? (
        <p className="draft-banner">
          {reviewableCount} {reviewableCount === 1 ? "entry" : "entries"} drifted from catalog.{" "}
          <button type="button" className="text-button refresh-slot-button" onClick={onReviewAll}>
            Review all
          </button>
        </p>
      ) : null}
      {isLocked ? (
        <p className="draft-banner">
          This version is locked. Save As to copy it into a new version.
        </p>
      ) : null}
      {source === "draft" ? <p className="draft-banner">Window Types draft restored</p> : null}
      {actionError ? (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      ) : null}
    </>
  );
}
