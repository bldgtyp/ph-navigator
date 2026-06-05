// Re-pick nudge rendered under the operation row when one or more
// picked frames carry a catalog ``operation`` that no longer matches
// the element's current operation. Dismissible per-element, per-tab —
// the dismissed set lives in the Zustand store and clears on
// aperture-type or version switch.

export type OperationWarningBannerProps = {
  mismatchedSides: string[];
  onDismiss: () => void;
};

export function OperationWarningBanner({
  mismatchedSides,
  onDismiss,
}: OperationWarningBannerProps) {
  if (mismatchedSides.length === 0) return null;
  return (
    <div
      className="aperture-operation-warning"
      role="status"
      data-testid="operation-warning-banner"
    >
      <span>
        Operation changed — picked frames may no longer match. Re-pick to clear. (
        {mismatchedSides.join(", ")})
      </span>
      <button
        type="button"
        className="aperture-operation-warning__dismiss"
        onClick={onDismiss}
        aria-label="Dismiss operation warning"
      >
        ✕
      </button>
    </div>
  );
}
