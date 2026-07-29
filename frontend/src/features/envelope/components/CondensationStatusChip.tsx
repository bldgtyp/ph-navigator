import type { AssemblyCondensationResponse } from "../condensation-types";
import { condensationChipPresentation } from "../condensation-chip";

export function CondensationStatusChip({
  result,
  loading,
  unavailable,
  onClick,
}: {
  result: AssemblyCondensationResponse | null;
  loading: boolean;
  unavailable: boolean;
  onClick: () => void;
}) {
  const presentation = condensationChipPresentation(result, loading, unavailable);
  return (
    <button
      type="button"
      className="chip chip--md chip--outline chip--interactive report-status-chip condensation-status-chip"
      data-tone={presentation.tone}
      data-muted={presentation.muted || undefined}
      aria-label={presentation.label}
      onClick={onClick}
    >
      <span className="condensation-status-chip__dot" aria-hidden="true" />
      {presentation.label}
    </button>
  );
}
